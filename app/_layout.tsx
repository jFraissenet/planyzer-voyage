import "../global.css";
import "@/lib/i18n";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { consumePendingInvite } from "@/lib/pendingInvite";
import { SessionProvider, useSession } from "@/lib/useSession";

const TABLET_BREAKPOINT = 1024;

function WebFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== "web") return <>{children}</>;
  const isWide = width >= TABLET_BREAKPOINT;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        backgroundColor: isWide ? "#EDE7DD" : "#FAF7F2",
      }}
    >
      <View
        style={{
          flex: 1,
          width: isWide ? "80%" : "100%",
          backgroundColor: "#FAF7F2",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isWide ? 0.1 : 0,
          shadowRadius: 32,
          elevation: 0,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inInviteGroup = segments[0] === "invite";

    if (!session && !inAuthGroup && !inInviteGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      void consumePendingInvite().then((token) => {
        if (token) router.replace(`/invite/${token}`);
        else router.replace("/(tabs)");
      });
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <WebFrame>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" />
        </View>
      </WebFrame>
    );
  }

  return (
    <WebFrame>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="invite/[token]" />
      </Stack>
    </WebFrame>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </SessionProvider>
  );
}
