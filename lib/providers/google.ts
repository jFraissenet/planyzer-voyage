import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import i18n from "@/lib/i18n";
import { supabase } from "../supabase";
import type { OAuthProvider } from "./types";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(): OAuthProvider & { loading: boolean } {
  const t = i18n.t.bind(i18n);

  if (Platform.OS === "web") {
    return {
      label: t("auth.social.continueWithGoogle"),
      loading: false,
      signIn: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      },
    };
  }

  const redirectUri = makeRedirectUri();

  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
  });

  async function signIn() {
    const result = await promptAsync();

    if (result.type !== "success") {
      throw new Error(t("auth.social.errorGoogleCancelled"));
    }

    const idToken = result.params.id_token;
    if (!idToken) {
      throw new Error(t("auth.social.errorGoogleNoToken"));
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;
  }

  return {
    label: t("auth.social.continueWithGoogle"),
    signIn,
    loading: !request,
  };
}
