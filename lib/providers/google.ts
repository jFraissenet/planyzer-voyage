import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../supabase";
import type { OAuthProvider } from "./types";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(): OAuthProvider & { loading: boolean } {
  // Sur le web, on utilise le OAuth Supabase (redirect flow)
  // Sur mobile, on utilise expo-auth-session + signInWithIdToken
  if (Platform.OS === "web") {
    return {
      label: "Continuer avec Google",
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
      throw new Error("Connexion Google annulée");
    }

    const idToken = result.params.id_token;
    if (!idToken) {
      throw new Error("Impossible de récupérer le token Google");
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;
  }

  return {
    label: "Continuer avec Google",
    signIn,
    loading: !request,
  };
}
