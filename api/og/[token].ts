// Vercel serverless function: returns an HTML page with Open Graph tags for
// a share token, then meta-refreshes to the SPA invite route.
//
// URL:      /e/:token  (rewritten to /api/og/:token via vercel.json)
// Purpose:  when a WhatsApp/Messenger/Telegram/etc. bot scrapes the URL,
//           it finds og:* tags and renders a rich preview card instead of
//           a bare link. Human visitors are redirected to /invite/:token.

type EventPreview = {
  event_id: string;
  event_title: string;
  event_description: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  organizer_name: string | null;
  organizer_avatar_url: string | null;
  participant_count: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", opts);
  if (start && end) {
    const s = fmt(start);
    const e = fmt(end);
    return s === e ? s : `${s} — ${e}`;
  }
  return fmt((start ?? end) as string);
}

async function fetchPreview(
  supabaseUrl: string,
  anonKey: string,
  token: string,
): Promise<EventPreview | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_event_by_share_token`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as EventPreview[] | EventPreview;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function renderHtml(opts: {
  title: string;
  description: string;
  url: string;
  redirectUrl: string;
  image?: string | null;
}): string {
  const { title, description, url, redirectUrl, image } = opts;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeUrl = escapeHtml(url);
  const safeRedirect = escapeHtml(redirectUrl);
  const imgTag = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" />`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${safeDesc}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:site_name" content="Planyzer" />
  ${imgTag}

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />

  <meta http-equiv="refresh" content="0; url=${safeRedirect}" />
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
  <style>
    body { font-family: system-ui, sans-serif; padding: 32px; color: #1A1A1A; background: #FAF7F2; }
    a { color: #6050DC; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  <p><a href="${safeRedirect}">Ouvrir l'invitation</a></p>
</body>
</html>`;
}

export default async function handler(
  req: { query: { token?: string | string[] }; headers: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => { send: (body: string) => void; end: () => void };
    setHeader: (name: string, value: string) => void;
  },
) {
  const rawToken = req.query.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers.host as string | undefined) ??
    "planyzer.app";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const shareUrl = `${proto}://${host}/e/${token ?? ""}`;
  const redirectUrl = `${proto}://${host}/invite/${token ?? ""}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");

  if (!token || !supabaseUrl || !anonKey) {
    res.status(200).send(
      renderHtml({
        title: "Planyzer",
        description: "Organise tes événements avec tes proches.",
        url: shareUrl,
        redirectUrl,
      }),
    );
    return;
  }

  const preview = await fetchPreview(supabaseUrl, anonKey, token);

  if (!preview) {
    res.status(200).send(
      renderHtml({
        title: "Invitation Planyzer",
        description: "Ce lien n'est plus valide.",
        url: shareUrl,
        redirectUrl,
      }),
    );
    return;
  }

  const range = formatDateRange(
    preview.event_start_date,
    preview.event_end_date,
  );
  const parts = [
    preview.organizer_name ? `Par ${preview.organizer_name}` : null,
    range,
    preview.event_description,
  ].filter(Boolean);
  const description = parts.join(" · ") || "Rejoins cet événement sur Planyzer.";

  res.status(200).send(
    renderHtml({
      title: preview.event_title,
      description,
      url: shareUrl,
      redirectUrl,
      image: preview.organizer_avatar_url,
    }),
  );
}
