import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { useGoogleAuth } from "@/lib/providers";

interface Props {
  onError: (message: string) => void;
}

export function GoogleAuthButton({ onError }: Props) {
  const { t } = useTranslation();
  const google = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await google.signIn();
    } catch (e: any) {
      onError(e?.message ?? t("auth.social.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      label={google.label}
      variant="outline"
      disabled={loading || google.loading}
      onPress={handle}
    />
  );
}
