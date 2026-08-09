import { useEffect } from "react";

import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Loading } from "@/components/ui";
import { SessionProvider, useSession } from "@/lib/session";
import { registerBackgroundSync } from "@/lib/sync/background";
import { SyncProvider } from "@/lib/sync/provider";
import { useTheme } from "@/theme/use-theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <SyncProvider>
            <RootNavigator />
          </SyncProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Route guard.
 *
 * Expo Router has no server to redirect from, so this watches the session and
 * the current segment and pushes the user into the right group.
 */
function RootNavigator() {
  const { session, profile, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  const isAuthenticated = Boolean(session && profile);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(app)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  useEffect(() => {
    if (isAuthenticated) void registerBackgroundSync();
  }, [isAuthenticated]);

  if (isLoading) {
    return <Loading label="Loading…" />;
  }

  return (
    <>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
