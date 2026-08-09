import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSync } from "@/lib/sync/provider";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Persistent sync status strip.
 *
 * An offline-first app that says nothing about its state is untrustworthy: the
 * inspector needs to know, before leaving site, whether their work has actually
 * left the device. It stays hidden when everything is synced and online, so it
 * only ever appears when it has something to say.
 */
export function SyncBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnline, isSyncing, pending, syncNow, retryFailed } = useSync();

  const totalPending = pending.outbox + pending.photos;
  const hasFailures = pending.failed > 0;

  if (isOnline && !isSyncing && totalPending === 0 && !hasFailures) return null;

  const { background, foreground, message, action, onPress } = (() => {
    if (hasFailures) {
      return {
        background: theme.colors.dangerBg,
        foreground: theme.colors.danger,
        message: `${pending.failed} item${pending.failed === 1 ? "" : "s"} failed to sync`,
        action: "Retry",
        onPress: retryFailed,
      };
    }
    if (!isOnline) {
      return {
        background: theme.colors.warningBg,
        foreground: theme.colors.warning,
        message:
          totalPending > 0
            ? `Offline · ${totalPending} item${totalPending === 1 ? "" : "s"} waiting to sync`
            : "Offline · your work is saved on this device",
        action: null,
        onPress: null,
      };
    }
    if (isSyncing) {
      return {
        background: theme.colors.surfaceAlt,
        foreground: theme.colors.textMuted,
        message: "Syncing…",
        action: null,
        onPress: null,
      };
    }
    return {
      background: theme.colors.surfaceAlt,
      foreground: theme.colors.textMuted,
      message: `${totalPending} item${totalPending === 1 ? "" : "s"} waiting to sync`,
      action: "Sync now",
      onPress: syncNow,
    };
  })();

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: background,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      {isSyncing ? <ActivityIndicator size="small" color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{message}</Text>
      {action && onPress ? (
        <Pressable onPress={() => void onPress()} hitSlop={8}>
          <Text
            style={{
              color: foreground,
              fontSize: 13,
              fontWeight: "700",
              textDecorationLine: "underline",
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
