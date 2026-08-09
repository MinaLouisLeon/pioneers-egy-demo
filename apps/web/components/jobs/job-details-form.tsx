"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { jobDetailsSchema, type JobDetails } from "@pioneers/core/schemas";
import { toDateInput } from "@pioneers/core/format";
import { Alert, AlertDescription } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent } from "@pioneers/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@pioneers/ui/components/form";
import { Input } from "@pioneers/ui/components/input";
import { Textarea } from "@pioneers/ui/components/textarea";

import { createJob, updateJobDetails } from "@/app/(app)/dashboard/jobs/actions";

/**
 * Step 1 of the wizard.
 *
 * `useForm` is given three generics — input, context, output — because
 * `jobDetailsSchema` has a defaulted field, which makes the schema's input type
 * differ from its output type. Without this, react-hook-form cannot reconcile
 * the resolver with the field values.
 */
type JobDetailsFormValues = z.input<typeof jobDetailsSchema>;

export function JobDetailsForm({
  jobId,
  defaultValues,
}: {
  /** Null when creating; set when editing an existing draft. */
  jobId: string | null;
  defaultValues?: Partial<JobDetails>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<JobDetailsFormValues, unknown, JobDetails>({
    resolver: zodResolver(jobDetailsSchema),
    defaultValues: {
      project_name: defaultValues?.project_name ?? "",
      company_name: defaultValues?.company_name ?? "",
      visit_date: defaultValues?.visit_date ?? toDateInput(),
      notes: defaultValues?.notes ?? "",
    },
  });

  async function onSubmit(values: JobDetails) {
    setFormError(null);

    const result = jobId ? await updateJobDetails(jobId, values) : await createJob(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(field as keyof JobDetailsFormValues, { message: messages[0] });
        }
      }
      return;
    }

    const targetId = jobId ?? (result.data as { jobId: string }).jobId;
    if (!jobId) toast.success("Draft job created");

    router.push(`/dashboard/jobs/${targetId}/edit?step=tasks`);
  }

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2">
            {formError ? (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Project name<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Damietta Port Crane Overhaul" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Company name<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Delta Marine Services" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visit_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Date of visit<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" className="w-full" {...field} />
                  </FormControl>
                  <FormDescription>The day the site visit took place.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Job notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Scope, access constraints, who was present…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {jobId ? "Save and continue" : "Create and add tasks"}
                <ArrowRight />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
