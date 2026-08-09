import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { useRouter } from "expo-router";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { toDateInput } from "@pioneers/core/format";
import { jobDetailsSchema, type JobDetails } from "@pioneers/core/schemas";

import { Button, Field, Input, Muted, Screen } from "@/components/ui";
import { createLocalJob } from "@/lib/db/jobs";
import { useSession } from "@/lib/session";
import { useSync } from "@/lib/sync/provider";
import { spacing } from "@/theme";

type JobDetailsFormValues = z.input<typeof jobDetailsSchema>;

/** Step 1 of the wizard, native edition. Writes locally and returns to the job. */
export default function NewJobScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const { refreshCounts, syncNow } = useSync();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<JobDetailsFormValues, unknown, JobDetails>({
    resolver: zodResolver(jobDetailsSchema),
    defaultValues: {
      project_name: "",
      company_name: "",
      visit_date: toDateInput(),
      notes: "",
    },
  });

  async function onSubmit(values: JobDetails) {
    if (!profile) return;
    setError(null);

    try {
      const clientId = await createLocalJob(values, profile.id);
      await refreshCounts();
      // Fire and forget — the job is already safe on disk.
      void syncNow();
      router.replace(`/(app)/jobs/${clientId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the job.");
    }
  }

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
          <Muted>
            Saved to this device straight away. It uploads on its own once you have signal.
          </Muted>

          {error ? <Muted style={{ color: "#c8372d" }}>{error}</Muted> : null}

          <Controller
            control={form.control}
            name="project_name"
            render={({ field, fieldState }) => (
              <Field label="Project name" required error={fieldState.error?.message}>
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="e.g. Damietta Port Crane Overhaul"
                  hasError={!!fieldState.error}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="company_name"
            render={({ field, fieldState }) => (
              <Field label="Company name" required error={fieldState.error?.message}>
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="e.g. Delta Marine Services"
                  hasError={!!fieldState.error}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="visit_date"
            render={({ field, fieldState }) => (
              <Field
                label="Date of visit"
                required
                hint="YYYY-MM-DD"
                error={fieldState.error?.message}
              >
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="2026-08-09"
                  keyboardType="numbers-and-punctuation"
                  hasError={!!fieldState.error}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field label="Job notes" error={fieldState.error?.message}>
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Scope, access constraints, who was present…"
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 96, textAlignVertical: "top", paddingTop: spacing.md }}
                />
              </Field>
            )}
          />

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              title="Create job"
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
