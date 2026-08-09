import { Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";

import { can } from "@pioneers/core/roles";

import { SyncBanner } from "@/components/sync-banner";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/use-theme";

/**
 * Bottom tabs.
 *
 * The Accounts tab is only rendered for admins. That is presentation only —
 * the screen itself re-checks the role, and RLS is the real boundary.
 */
export default function AppLayout() {
  const theme = useTheme();
  const { profile } = useSession();

  const showAccounts = can(profile?.role, "accounts.manage");

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SyncBanner />

      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "600" },
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          sceneStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Jobs",
            tabBarIcon: ({ color }) => <TabGlyph label="J" color={color} />,
          }}
        />
        <Tabs.Screen
          name="certificates"
          options={{
            title: "Certificates",
            tabBarIcon: ({ color }) => <TabGlyph label="C" color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color }) => <TabGlyph label="Q" color={color} />,
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: "Accounts",
            href: showAccounts ? undefined : null,
            tabBarIcon: ({ color }) => <TabGlyph label="A" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => <TabGlyph label="S" color={color} />,
          }}
        />

        {/*
          Detail routes are reachable by navigation but must not appear in the
          tab bar. `href: null` hides them; the names match the file paths, so
          jobs/[id]/index.tsx is "jobs/[id]/index".
        */}
        <Tabs.Screen name="jobs/new" options={{ href: null, title: "New job" }} />
        <Tabs.Screen name="jobs/[id]/index" options={{ href: null, title: "Job" }} />
        <Tabs.Screen name="jobs/[id]/task" options={{ href: null, title: "Task" }} />
      </Tabs>
    </View>
  );
}

/**
 * Placeholder tab glyphs.
 *
 * The template's icon set was removed with the rest of the scaffold; these keep
 * the tab bar legible without pulling in an icon font. Swap for @expo/vector-icons
 * when the brand icon set is finalised.
 */
function TabGlyph({ label, color }: { label: string; color: ColorValue }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
