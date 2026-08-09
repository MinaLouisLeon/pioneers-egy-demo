import { Alert, ScrollView, View } from "react-native";

import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@pioneers/core/roles";

import { Badge, Body, Button, Card, Divider, Heading, Muted, Screen } from "@/components/ui";
import { clearDatabase } from "@/lib/db/schema";
import { useSession } from "@/lib/session";
import { unregisterBackgroundSync } from "@/lib/sync/background";
import { useSync } from "@/lib/sync/provider";
import { spacing } from "@/theme";

export default function SettingsScreen() {
  const { profile, signOut } = useSession();
  const { isOnline, isSyncing, pending, syncNow, retryFailed, refreshCounts } = useSync();

  const totalPending = pending.outbox + pending.photos;

  function confirmSignOut() {
    // Signing out wipes the local database, so anything not yet uploaded would
    // be lost. Warn explicitly rather than silently discarding a day's work.
    const message =
      totalPending > 0
        ? `You have ${totalPending} item${totalPending === 1 ? "" : "s"} that have not synced yet. Signing out will discard them permanently.`
        : "Your local data will be removed from this device.";

    Alert.alert("Sign out?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await unregisterBackgroundSync();
          await clearDatabase();
          await signOut();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.sm }}>
          <Heading>{profile?.full_name}</Heading>
          <Muted>{profile?.email}</Muted>
          {profile ? (
            <>
              <Badge label={ROLE_LABELS[profile.role]} tone="primary" />
              <Muted>{ROLE_DESCRIPTIONS[profile.role]}</Muted>
            </>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Heading>Sync</Heading>

          <View style={{ gap: spacing.xs }}>
            <Row label="Connection" value={isOnline ? "Online" : "Offline"} />
            <Divider />
            <Row label="Waiting to upload" value={String(pending.outbox)} />
            <Divider />
            <Row label="Photos queued" value={String(pending.photos)} />
            {pending.failed > 0 ? (
              <>
                <Divider />
                <Row label="Failed" value={String(pending.failed)} />
              </>
            ) : null}
          </View>

          <Muted>
            Your work is saved on this device first and uploaded automatically when you have signal.
            You can keep working with no connection at all.
          </Muted>

          <Button
            title={isSyncing ? "Syncing…" : "Sync now"}
            variant="secondary"
            loading={isSyncing}
            disabled={!isOnline}
            onPress={async () => {
              await syncNow();
              await refreshCounts();
            }}
          />

          {pending.failed > 0 ? (
            <Button title="Retry failed items" onPress={() => void retryFailed()} />
          ) : null}
        </Card>

        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Muted>{label}</Muted>
      <Body>{value}</Body>
    </View>
  );
}
