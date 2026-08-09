import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";

import { formatDate } from "@pioneers/core/format";

import { Badge, Body, Button, EmptyState, Input, Muted, Screen } from "@/components/ui";
import { listLocalJobs, type LocalJob } from "@/lib/db/jobs";
import { useSync } from "@/lib/sync/provider";
import { radius, spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Jobs list.
 *
 * Reads exclusively from the local database, so it renders instantly and works
 * with the radio off. `useFocusEffect` re-reads on every focus, which is how
 * changes made by the sync engine become visible.
 */
export default function JobsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { syncNow, isSyncing } = useSync();

  const [jobs, setJobs] = useState<LocalJob[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (term: string) => {
    setJobs(await listLocalJobs(term));
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(search);
    }, [load, search]),
  );

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Input
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            void load(text);
          }}
          placeholder="Search project or company…"
          autoCorrect={false}
        />
        <Button title="New inspection job" onPress={() => router.push("/(app)/jobs/new")} />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(job) => job.client_id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={() => void syncNow()}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              title={search ? "No matching jobs" : "No inspection jobs yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Create a job to record a site visit. You can do this with no signal — it syncs when you reconnect."
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/jobs/${item.client_id}`)}
            style={({ pressed }) => ({
              backgroundColor: theme.colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: spacing.lg,
              opacity: pressed ? 0.75 : 1,
              gap: spacing.xs,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "600" }}>{item.project_name}</Body>
                <Muted>{item.company_name}</Muted>
              </View>
              <Badge
                label={item.status === "submitted" ? "Submitted" : "Draft"}
                tone={item.status === "submitted" ? "success" : "neutral"}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginTop: spacing.xs,
              }}
            >
              <Muted>{formatDate(item.visit_date)}</Muted>
              {item.sync_state !== "synced" ? (
                <Badge
                  label={item.sync_state === "failed" ? "Sync failed" : "Not synced"}
                  tone={item.sync_state === "failed" ? "danger" : "warning"}
                />
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
