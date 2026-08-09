import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { SUBTYPE_LABELS, CATEGORY_LABELS, type TaskSubtype } from "@pioneers/core/schemas";
import { dataFieldsFor } from "@pioneers/core/forms";
import { formatDate } from "@pioneers/core/format";

import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
  Heading,
  Loading,
  Muted,
  Screen,
  Title,
} from "@/components/ui";
import {
  deleteLocalTask,
  getLocalJob,
  listLocalPhotos,
  listLocalTasks,
  submitLocalJob,
  type LocalJob,
  type LocalTask,
} from "@/lib/db/jobs";
import { useSync } from "@/lib/sync/provider";
import { spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

type TaskWithPhotoCount = LocalTask & { photoCount: number };

export default function JobDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { syncNow, refreshCounts } = useSync();

  const [job, setJob] = useState<LocalJob | null>(null);
  const [tasks, setTasks] = useState<TaskWithPhotoCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;

    const [loadedJob, loadedTasks] = await Promise.all([getLocalJob(id), listLocalTasks(id)]);

    const withCounts = await Promise.all(
      loadedTasks.map(async (task) => ({
        ...task,
        photoCount: (await listLocalPhotos(task.client_id)).length,
      })),
    );

    setJob(loadedJob);
    setTasks(withCounts);
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSubmit() {
    if (!id || tasks.length === 0) return;

    Alert.alert(
      "Submit this job?",
      "It will be marked as complete and uploaded when you have signal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            await submitLocalJob(id);
            await refreshCounts();
            void syncNow();
            await load();
          },
        },
      ],
    );
  }

  function confirmDeleteTask(task: TaskWithPhotoCount) {
    Alert.alert("Remove this task?", "Its photos will be removed too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteLocalTask(task.client_id);
          await load();
        },
      },
    ]);
  }

  if (isLoading) return <Loading />;
  if (!job) {
    return (
      <Screen>
        <EmptyState title="Job not found" description="It may have been removed." />
      </Screen>
    );
  }

  const isDraft = job.status === "draft";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Title>{job.project_name}</Title>
          <Muted>{job.company_name}</Muted>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
            <Badge label={isDraft ? "Draft" : "Submitted"} tone={isDraft ? "neutral" : "success"} />
            {job.sync_state !== "synced" ? (
              <Badge
                label={job.sync_state === "failed" ? "Sync failed" : "Not synced"}
                tone={job.sync_state === "failed" ? "danger" : "warning"}
              />
            ) : null}
          </View>
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Row label="Date of visit" value={formatDate(job.visit_date)} />
          <Divider />
          <Row label="Tasks" value={String(tasks.length)} />
          {job.notes ? (
            <>
              <Divider />
              <View style={{ gap: 2 }}>
                <Muted>Notes</Muted>
                <Body>{job.notes}</Body>
              </View>
            </>
          ) : null}
        </Card>

        <View style={{ gap: spacing.md }}>
          <Heading>Inspection tasks</Heading>

          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="A job can hold several tasks of different types."
            />
          ) : (
            tasks.map((task, index) => (
              <Card key={task.client_id} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Badge label={CATEGORY_LABELS[task.category]} tone="primary" />
                  <Badge label={SUBTYPE_LABELS[task.subtype as TaskSubtype]} />
                  {task.photoCount > 0 ? (
                    <Muted>
                      {task.photoCount} photo{task.photoCount === 1 ? "" : "s"}
                    </Muted>
                  ) : null}
                </View>

                <TaskPreview task={task} />

                {isDraft ? (
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable
                      onPress={() =>
                        router.push(`/(app)/jobs/${job.client_id}/task?taskId=${task.client_id}`)
                      }
                      hitSlop={8}
                    >
                      <Body style={{ color: theme.colors.primary, fontWeight: "600" }}>Edit</Body>
                    </Pressable>
                    <Pressable onPress={() => confirmDeleteTask(task)} hitSlop={8}>
                      <Body style={{ color: theme.colors.danger, fontWeight: "600" }}>Remove</Body>
                    </Pressable>
                  </View>
                ) : null}

                {index < tasks.length - 1 ? null : null}
              </Card>
            ))
          )}
        </View>

        {isDraft ? (
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Add task"
              variant="secondary"
              onPress={() => router.push(`/(app)/jobs/${job.client_id}/task`)}
            />
            <Button
              title="Submit job"
              onPress={() => void handleSubmit()}
              disabled={tasks.length === 0}
            />
            {tasks.length === 0 ? (
              <Muted style={{ textAlign: "center" }}>
                Add at least one task before submitting.
              </Muted>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function TaskPreview({ task }: { task: LocalTask }) {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(task.data) as Record<string, unknown>;
  } catch {
    // A corrupt blob should not take the screen down.
  }

  return (
    <View style={{ gap: 2 }}>
      {dataFieldsFor(task.subtype as TaskSubtype)
        .slice(0, 3)
        .map((field) => (
          <View key={field.name} style={{ flexDirection: "row", gap: spacing.xs }}>
            <Muted>{field.label}:</Muted>
            <Muted style={{ flex: 1 }} numberOfLines={1}>
              {formatValue(data[field.name])}
            </Muted>
          </View>
        ))}
    </View>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isNaN(value) ? "—" : String(value);
  return String(value);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Muted>{label}</Muted>
      <Body>{value}</Body>
    </View>
  );
}
