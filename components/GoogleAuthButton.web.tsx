import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not in browser"));
  const w = window as any;
  if (w.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashed = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

interface Props {
  onError: (message: string) => void;
}

export function GoogleAuthButton({ onError }: Props) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadGsi();
        if (cancelled || !containerRef.current) return;

        const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          onError("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set");
          return;
        }

        const { raw, hashed } = await generateNonce();
        if (cancelled || !containerRef.current) return;

        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) {
              onError(t("auth.social.errorGoogleNoToken"));
              return;
            }
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: raw,
            });
            if (error) onError(error.message);
          },
          nonce: hashed,
          use_fedcm_for_prompt: true,
        });

        containerRef.current.innerHTML = "";
        const measured = containerRef.current.offsetWidth || 320;
        const width = Math.min(400, Math.max(200, measured));

        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
          locale: i18n.language,
        });
      } catch (e: any) {
        if (!cancelled) onError(e?.message ?? t("auth.social.errorGeneric"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [i18n.language, onError, t]);

  return <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center", minHeight: 40 }} />;
}
