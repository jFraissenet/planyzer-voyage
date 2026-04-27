import { supabase } from "./supabase";

const BUCKET = "user-avatars";
const STALE_MS = 7 * 24 * 3600 * 1000;

/**
 * Mirror the current user's external avatar (e.g. Google CDN) into our own
 * Supabase Storage bucket so the rendered URL stays stable, public, and
 * isn't subject to upstream rate limits / cookie checks. Idempotent: skips
 * the work if the source URL hasn't changed and the last sync is recent.
 */
export async function syncMyAvatar(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const metaSource =
      (user.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data: row } = await supabase
      .from("users")
      .select("avatar_source_url, avatar_synced_at, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (!row) return;

    const sourceUrl = metaSource ?? row.avatar_source_url ?? null;
    if (!sourceUrl) return;

    const syncedAt = row.avatar_synced_at
      ? new Date(row.avatar_synced_at).getTime()
      : 0;
    const neverSynced = syncedAt === 0;
    const isStale = neverSynced || Date.now() - syncedAt > STALE_MS;
    const sourceChanged =
      !!metaSource && metaSource !== row.avatar_source_url;

    if (!sourceChanged && !isStale) return;

    // Cheap path: source unchanged, mirror still in our bucket — just bump
    // the sync timestamp so we don't re-hit the upstream for nothing.
    const alreadyMirrored = row.avatar_url?.includes(`/${BUCKET}/`) === true;
    if (!sourceChanged && alreadyMirrored && !neverSynced) {
      await supabase
        .from("users")
        .update({ avatar_synced_at: new Date().toISOString() })
        .eq("id", user.id);
      return;
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) return;
    const buf = await res.arrayBuffer();

    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png")
      ? "png"
      : ct.includes("webp")
        ? "webp"
        : ct.includes("gif")
          ? "gif"
          : "jpg";
    const path = `${user.id}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { upsert: true, contentType: ct });
    if (upErr) {
      // eslint-disable-next-line no-console
      console.error("avatar upload failed:", upErr);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust so the new image is fetched even if the path is the same.
    const newUrl = `${pub.publicUrl}?v=${Date.now()}`;

    await supabase
      .from("users")
      .update({
        avatar_url: newUrl,
        avatar_source_url: sourceUrl,
        avatar_synced_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("syncMyAvatar failed:", e);
  }
}
