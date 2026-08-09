import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { TASK_FORM_SPECS, createTaskDefaults, MAX_PHOTOS_PER_TASK } from "@pioneers/core/forms";
import {
  CATEGORY_LABELS,
  SUBTYPES_BY_CATEGORY,
  SUBTYPE_LABELS,
  TASK_CATEGORIES,
  TASK_DATA_SCHEMAS,
  categoryForSubtype,
  type TaskCategory,
  type TaskSubtype,
} from "@pioneers/core/schemas";

import { DynamicField } from "@/components/dynamic-field";
import { Badge, Body, Button, Divider, Field, Label, Muted, Screen } from "@/components/ui";
import { capturePhoto, pickPhotos } from "@/lib/photos";
import {
  addLocalPhoto,
  listLocalPhotos,
  listLocalTasks,
  removeLocalPhoto,
  saveLocalTask,
  type LocalPhoto,
} from "@/lib/db/jobs";
import { useSync } from "@/lib/sync/provider";
import { radius, spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Add/edit an inspection task.
 *
 * Everything below the two dropdowns is generated from TASK_FORM_SPECS — the
 * same registry the web app renders — so lifting, NDT, testing and the
 * environmental placeholders all work here with no type-specific code.
 */
export default function TaskEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id: jobClientId, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const { syncNow, refreshCounts } = useSync();

  const [category, setCategory] = useState<TaskCategory>("inspection");
  const [subtype, setSubtype] = useState<TaskSubtype>("lifting");
  const [savedTaskId, setSavedTaskId] = useState<string | null>(taskId ?? null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [isReady, setIsReady] = useState(!taskId);

  const spec = TASK_FORM_SPECS[subtype];

  const schema = useMemo(() => z.object({ data: TASK_DATA_SCHEMAS[subtype] }), [subtype]);

  const form = useForm<{ data: Record<string, unknown> }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { data: createTaskDefaults(subtype) },
  });

  const loadPhotos = useCallback(async (client: string) => {
    setPhotos(await listLocalPhotos(client));
  }, []);

  // Load an existing task when editing.
  useEffect(() => {
    if (!taskId || !jobClientId) return;

    void (async () => {
      const tasks = await listLocalTasks(jobClientId);
      const existing = tasks.find((task) => task.client_id === taskId);

      if (existing) {
        setCategory(existing.category);
        setSubtype(existing.subtype);
        try {
          form.reset({ data: JSON.parse(existing.data) as Record<string, unknown> });
        } catch {
          form.reset({ data: createTaskDefaults(existing.subtype) });
        }
        await loadPhotos(existing.client_id);
      }
      setIsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, jobClientId]);

  function changeCategory(next: TaskCategory) {
    setCategory(next);
    const firstSubtype = SUBTYPES_BY_CATEGORY[next][0]!;
    setSubtype(firstSubtype);
    form.reset({ data: createTaskDefaults(firstSubtype) });
  }

  function changeSubtype(next: TaskSubtype) {
    setSubtype(next);
    // Field sets are disjoint, so carrying values over would leave stale keys.
    form.reset({ data: createTaskDefaults(next) });
  }

  /**
   * Photos need a task row to hang off, so an unsaved task is persisted first.
   * That is invisible to the user and means a photo is never lost because the
   * form had not been submitted yet.
   */
  async function ensureTaskSaved(): Promise<string | null> {
    if (savedTaskId) return savedTaskId;
    if (!jobClientId) return null;

    const existingTasks = await listLocalTasks(jobClientId);
    const clientId = await saveLocalTask({
      jobClientId,
      category,
      subtype,
      sortOrder: existingTasks.length,
      data: form.getValues("data"),
    });

    setSavedTaskId(clientId);
    return clientId;
  }

  async function handleAddPhotos(source: "camera" | "library") {
    const target = await ensureTaskSaved();
    if (!target) return;

    const remaining = MAX_PHOTOS_PER_TASK - photos.length;
    if (remaining <= 0) return;

    const captured = source === "camera" ? await capturePhoto() : await pickPhotos(remaining);

    for (const [index, photo] of captured.entries()) {
      await addLocalPhoto({
        taskClientId: target,
        localUri: photo.uri,
        fileName: photo.fileName,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        sortOrder: photos.length + index,
      });
    }

    await loadPhotos(target);
    await refreshCounts();
  }

  async function onSubmit(values: { data: Record<string, unknown> }) {
    if (!jobClientId) return;

    const existingTasks = await listLocalTasks(jobClientId);
    const sortOrder = savedTaskId
      ? (existingTasks.find((task) => task.client_id === savedTaskId)?.sort_order ??
        existingTasks.length)
      : existingTasks.length;

    await saveLocalTask({
      clientId: savedTaskId ?? undefined,
      jobClientId,
      category,
      subtype,
      sortOrder,
      data: values.data,
    });

    await refreshCounts();
    void syncNow();
    router.back();
  }

  if (!isReady) return null;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Category" required>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {TASK_CATEGORIES.map((value) => (
                <Chip
                  key={value}
                  label={CATEGORY_LABELS[value]}
                  selected={category === value}
                  onPress={() => changeCategory(value)}
                />
              ))}
            </View>
          </Field>

          <Field label="Type" required hint={spec.description}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {SUBTYPES_BY_CATEGORY[category].map((value) => (
                <Chip
                  key={value}
                  label={SUBTYPE_LABELS[value]}
                  selected={subtype === value}
                  onPress={() => changeSubtype(value)}
                />
              ))}
            </View>
          </Field>

          <Divider />

          {/* Generated from the shared spec — no per-subtype code here. */}
          {spec.fields.map((field) => (
            <DynamicField key={field.name} spec={field} control={form.control} namePrefix="data." />
          ))}

          <View style={{ gap: spacing.sm }}>
            <Label>Photos</Label>
            <Muted>Stored on this device and uploaded automatically once you have signal.</Muted>

            {photos.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {photos.map((photo) => (
                  <View key={photo.client_id} style={{ width: 92 }}>
                    <Pressable
                      onLongPress={async () => {
                        await removeLocalPhoto(photo.client_id);
                        if (savedTaskId) await loadPhotos(savedTaskId);
                      }}
                    >
                      <Image
                        source={{ uri: photo.local_uri ?? undefined }}
                        style={{
                          width: 92,
                          height: 92,
                          borderRadius: radius.md,
                          backgroundColor: theme.colors.surfaceAlt,
                        }}
                      />
                    </Pressable>
                    <View style={{ marginTop: 4 }}>
                      <Badge
                        label={
                          photo.upload_state === "uploaded"
                            ? "Uploaded"
                            : photo.upload_state === "failed"
                              ? "Failed"
                              : "Queued"
                        }
                        tone={
                          photo.upload_state === "uploaded"
                            ? "success"
                            : photo.upload_state === "failed"
                              ? "danger"
                              : "warning"
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {photos.length > 0 ? <Muted>Long-press a photo to remove it.</Muted> : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Take photo"
                  variant="secondary"
                  onPress={() => void handleAddPhotos("camera")}
                  disabled={photos.length >= MAX_PHOTOS_PER_TASK}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="From library"
                  variant="secondary"
                  onPress={() => void handleAddPhotos("library")}
                  disabled={photos.length >= MAX_PHOTOS_PER_TASK}
                />
              </View>
            </View>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              title={savedTaskId ? "Save task" : "Add task"}
              onPress={form.handleSubmit(onSubmit)}
              loading={form.formState.isSubmitting}
            />
            <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        paddingVertical: 11,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1.5,
        minHeight: 46,
        justifyContent: "center",
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected
          ? theme.dark
            ? theme.colors.surfaceAlt
            : "#e4edf9"
          : theme.colors.surface,
      }}
    >
      <Body
        style={{
          color: selected ? theme.colors.primary : theme.colors.text,
          fontWeight: selected ? "600" : "400",
          fontSize: 14,
        }}
      >
        {label}
      </Body>
    </Pressable>
  );
}

export { categoryForSubtype };
