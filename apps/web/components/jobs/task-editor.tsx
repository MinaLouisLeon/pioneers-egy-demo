"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { TASK_FORM_SPECS, createTaskDefaults } from "@pioneers/core/forms";
import { newClientId } from "@pioneers/core/ids";
import { Alert, AlertDescription } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pioneers/ui/components/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@pioneers/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import { Separator } from "@pioneers/ui/components/separator";

import { DynamicField } from "@/components/forms/dynamic-field";
import { PhotoUploader, type UploadedPhoto } from "@/components/jobs/photo-uploader";
import { saveTask } from "@/app/(app)/dashboard/jobs/actions";

export type EditableTask = {
  taskId: string | null;
  clientId: string;
  category: TaskCategory;
  subtype: TaskSubtype;
  sortOrder: number;
  data: Record<string, unknown>;
  photos: UploadedPhoto[];
};

export function newEditableTask(sortOrder: number): EditableTask {
  return {
    taskId: null,
    clientId: newClientId(),
    category: "inspection",
    subtype: "lifting",
    sortOrder,
    data: createTaskDefaults("lifting"),
    photos: [],
  };
}

/**
 * Add/edit dialog for a single inspection task.
 *
 * The two dropdowns cascade: choosing a category narrows the type list, and
 * choosing a type swaps in that subtype's schema and fields. Everything below
 * the dropdowns comes from TASK_FORM_SPECS — this component contains no
 * knowledge of what a lifting or NDT form looks like.
 */
export function TaskEditorDialog({
  jobId,
  task,
  open,
  onOpenChange,
  onSaved,
}: {
  jobId: string;
  task: EditableTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (task: EditableTask) => void;
}) {
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "inspection");
  const [subtype, setSubtype] = useState<TaskSubtype>(task?.subtype ?? "lifting");
  const [photos, setPhotos] = useState<UploadedPhoto[]>(task?.photos ?? []);
  const [formError, setFormError] = useState<string | null>(null);

  const spec = TASK_FORM_SPECS[subtype];

  // A wrapper object keeps every field name under `data.`, which is also how
  // the shared taskDraftSchema reports its errors.
  const schema = useMemo(() => z.object({ data: TASK_DATA_SCHEMAS[subtype] }), [subtype]);

  const form = useForm<{ data: Record<string, unknown> }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { data: task?.data ?? createTaskDefaults(subtype) },
  });

  // Reset whenever a different task is opened.
  useEffect(() => {
    if (!open) return;
    const next = task ?? newEditableTask(0);
    setCategory(next.category);
    setSubtype(next.subtype);
    setPhotos(next.photos);
    setFormError(null);
    form.reset({ data: next.data });
  }, [open, task, form]);

  function handleCategoryChange(value: string) {
    const nextCategory = value as TaskCategory;
    setCategory(nextCategory);

    // Jump to the first type in the new category so the form is never left
    // showing fields that do not belong to the selected category.
    const firstSubtype = SUBTYPES_BY_CATEGORY[nextCategory][0]!;
    setSubtype(firstSubtype);
    form.reset({ data: createTaskDefaults(firstSubtype) });
  }

  function handleSubtypeChange(value: string) {
    const nextSubtype = value as TaskSubtype;
    setSubtype(nextSubtype);
    // Field sets are disjoint between subtypes, so carrying values across would
    // leave stale keys in the JSONB blob.
    form.reset({ data: createTaskDefaults(nextSubtype) });
  }

  async function onSubmit(values: { data: Record<string, unknown> }) {
    setFormError(null);

    const payload: EditableTask = {
      taskId: task?.taskId ?? null,
      clientId: task?.clientId ?? newClientId(),
      category,
      subtype,
      sortOrder: task?.sortOrder ?? 0,
      data: values.data,
      photos,
    };

    const result = await saveTask(jobId, {
      taskId: payload.taskId,
      clientId: payload.clientId,
      subtype: payload.subtype,
      sortOrder: payload.sortOrder,
      data: payload.data,
      photos: payload.photos,
    });

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    onSaved({ ...payload, taskId: result.data.taskId });
    onOpenChange(false);
  }

  // A task must exist before photos can be uploaded, because the R2 key and the
  // server-side permission check are both keyed on the task id.
  const canUploadPhotos = Boolean(task?.taskId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task?.taskId ? "Edit task" : "Add inspection task"}</DialogTitle>
          <DialogDescription>
            Choose what kind of task this is; the form below adapts to your selection.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2">
            {formError ? (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <FormItem>
              <FormLabel>
                Category<span className="text-destructive">*</span>
              </FormLabel>
              <Select value={category} onValueChange={handleCategoryChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TASK_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>

            <FormItem>
              <FormLabel>
                Type<span className="text-destructive">*</span>
              </FormLabel>
              <Select value={subtype} onValueChange={handleSubtypeChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUBTYPES_BY_CATEGORY[category].map((value) => (
                    <SelectItem key={value} value={value}>
                      {SUBTYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{spec.description}</FormDescription>
            </FormItem>

            <Separator className="sm:col-span-2" />

            {/* Every field below is rendered from the shared spec. */}
            {spec.fields
              .filter((field) => field.kind !== "photos")
              .map((field) => (
                <DynamicField
                  key={field.name}
                  spec={field}
                  control={form.control}
                  namePrefix="data."
                />
              ))}

            <FormField
              control={form.control}
              name="data"
              render={() => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Photos</FormLabel>
                  {canUploadPhotos ? (
                    <PhotoUploader
                      jobId={jobId}
                      taskId={task!.taskId!}
                      value={photos}
                      onChange={setPhotos}
                    />
                  ) : (
                    <p className="text-muted-foreground text-balance rounded-md border border-dashed p-4 text-sm">
                      Save this task first — photos are stored against it, so it needs to exist
                      before they can be uploaded.
                    </p>
                  )}
                </FormItem>
              )}
            />

            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {task?.taskId ? "Save task" : "Add task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { categoryForSubtype };
