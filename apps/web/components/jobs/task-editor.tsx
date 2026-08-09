"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  CATEGORY_LABELS,
  SUBTYPES_BY_CATEGORY,
  SUBTYPE_LABELS,
  TASK_CATEGORIES,
  TASK_DATA_SCHEMAS,
  categoryForSubtype,
  isSubtypeInCategory,
  isTaskCategory,
  isTaskSubtype,
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
  FormItem,
  FormLabel,
} from "@pioneers/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import { Separator } from "@pioneers/ui/components/separator";
import { cn } from "@pioneers/ui/lib/utils";

import { DynamicField } from "@/components/forms/dynamic-field";
import { PhotoUploader, type UploadedPhoto } from "@/components/jobs/photo-uploader";
import { saveTask, saveTaskPhotos } from "@/app/(app)/dashboard/jobs/actions";

export type EditableTask = {
  taskId: string | null;
  clientId: string;
  category: TaskCategory;
  subtype: TaskSubtype;
  sortOrder: number;
  data: Record<string, unknown>;
  photos: UploadedPhoto[];
};

/** Which pane of the dialog is showing. */
export type TaskEditorStep = "details" | "photos";

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
 * Add/edit dialog for a single inspection task, in two steps.
 *
 *   1. Details — the two cascading dropdowns and the subtype's fields.
 *   2. Photos  — the uploader.
 *
 * They are separate because an R2 object key, and the server-side permission
 * check that guards it, are both derived from the task id. Photos therefore
 * cannot be uploaded until the task row exists. Rather than showing the user a
 * disabled uploader and asking them to save first, step 1 creates the row and
 * step 2 is simply the next thing they do.
 *
 * Everything under the dropdowns comes from TASK_FORM_SPECS — this component
 * contains no knowledge of what a lifting or NDT form looks like.
 */
export function TaskEditorDialog({
  jobId,
  task,
  open,
  initialStep = "details",
  onOpenChange,
  onSaved,
}: {
  jobId: string;
  task: EditableTask | null;
  open: boolean;
  /** Pass "photos" to jump straight to the uploader for an existing task. */
  initialStep?: TaskEditorStep;
  onOpenChange: (open: boolean) => void;
  onSaved: (task: EditableTask) => void;
}) {
  const [step, setStep] = useState<TaskEditorStep>(initialStep);
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "inspection");
  const [subtype, setSubtype] = useState<TaskSubtype>(task?.subtype ?? "lifting");
  const [photos, setPhotos] = useState<UploadedPhoto[]>(task?.photos ?? []);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(task?.taskId ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);

  /**
   * Whether this dialog was opened to create a task, captured once when it
   * opens. Derived state would flip to "edit" the moment step 1 saves, renaming
   * the dialog under the user mid-flow.
   */
  const [isNew, setIsNew] = useState(!task?.taskId);

  const spec = TASK_FORM_SPECS[subtype];

  // A wrapper object keeps every field name under `data.`, which is also how
  // the shared taskDraftSchema reports its errors.
  const schema = useMemo(() => z.object({ data: TASK_DATA_SCHEMAS[subtype] }), [subtype]);

  const form = useForm<{ data: Record<string, unknown> }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { data: task?.data ?? createTaskDefaults(subtype) },
  });

  /**
   * Load a task into the dialog — but only once per task.
   *
   * Saving step 1 calls `onSaved`, which hands a new `task` object back down as
   * a prop. Re-running this effect on every such change would reset `step`
   * straight back to "details" and strand the user on step 1 forever. Keying on
   * clientId (which survives the save) makes it run when a genuinely different
   * task is opened, and not otherwise.
   */
  const loadedClientId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      loadedClientId.current = null;
      return;
    }

    const next = task ?? newEditableTask(0);
    if (loadedClientId.current === next.clientId) return;
    loadedClientId.current = next.clientId;

    setIsNew(!next.taskId);
    setStep(next.taskId ? initialStep : "details");
    setCategory(next.category);
    setSubtype(next.subtype);
    setPhotos(next.photos);
    setSavedTaskId(next.taskId);
    setFormError(null);
    form.reset({ data: next.data });
  }, [open, task, initialStep, form]);

  function handleCategoryChange(value: string) {
    if (!isTaskCategory(value)) return;
    setCategory(value);

    // Jump to the first type in the new category so the form is never left
    // showing fields that do not belong to the selected category.
    const firstSubtype = SUBTYPES_BY_CATEGORY[value][0]!;
    setSubtype(firstSubtype);
    form.reset({ data: createTaskDefaults(firstSubtype) });
  }

  function handleSubtypeChange(value: string) {
    /*
     * Radix emits onValueChange("") when its current value is not among its
     * items. That happened for one render after the category switched — the
     * type list had not been re-rendered yet — and the empty string used to
     * reach createTaskDefaults and crash the dialog. The `key` on the trigger
     * below prevents the transient state; this guard makes it impossible to
     * regress.
     */
    if (!isTaskSubtype(value) || !isSubtypeInCategory(value, category)) return;

    setSubtype(value);
    // Field sets are disjoint between subtypes, so carrying values across would
    // leave stale keys in the JSONB blob.
    form.reset({ data: createTaskDefaults(value) });
  }

  /** Step 1 submit — persists the task row, then moves to photos. */
  async function onSubmitDetails(values: { data: Record<string, unknown> }) {
    setFormError(null);

    const result = await saveTask(jobId, {
      taskId: savedTaskId,
      clientId: task?.clientId ?? newClientId(),
      subtype,
      sortOrder: task?.sortOrder ?? 0,
      data: values.data,
    });

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setSavedTaskId(result.data.taskId);

    onSaved({
      taskId: result.data.taskId,
      clientId: task?.clientId ?? newClientId(),
      category,
      subtype,
      sortOrder: task?.sortOrder ?? 0,
      data: values.data,
      photos,
    });

    setStep("photos");
  }

  /**
   * Persist photo rows as soon as the set changes. The bytes are already in R2,
   * so waiting until the dialog closes would risk orphaning them.
   */
  async function handlePhotosChange(next: UploadedPhoto[]) {
    setPhotos(next);
    if (!savedTaskId) return;

    setIsSavingPhotos(true);
    const result = await saveTaskPhotos(jobId, savedTaskId, next);
    setIsSavingPhotos(false);

    if (!result.ok) {
      toast.error("Could not save the photos", { description: result.error });
      return;
    }

    onSaved({
      taskId: savedTaskId,
      clientId: task?.clientId ?? newClientId(),
      category,
      subtype,
      sortOrder: task?.sortOrder ?? 0,
      data: form.getValues("data"),
      photos: next,
    });
  }

  const isBusy = form.formState.isSubmitting || isSavingPhotos;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return; // don't abandon an in-flight save
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add inspection task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            {step === "details"
              ? "Choose what kind of task this is; the form below adapts to your selection."
              : "Attach photographs of what you inspected. They upload as you choose them."}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} onBack={() => setStep("details")} canGoBack={!isBusy} />

        {step === "details" ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmitDetails)}
              className="grid gap-5 sm:grid-cols-2"
            >
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
                {/*
                  Keyed on the category so the whole Select remounts when the
                  category changes. Without this it re-renders once holding the
                  new value against the old item list, which makes Radix reset
                  the value to "".
                */}
                <Select key={category} value={subtype} onValueChange={handleSubtypeChange}>
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

              <DialogFooter className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  {isNew ? "Save and add photos" : "Save and continue"}
                  <ArrowRight />
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground font-medium">
                {CATEGORY_LABELS[category]} · {SUBTYPE_LABELS[subtype]}
              </span>
              <span>saved.</span>
            </div>

            {savedTaskId ? (
              <PhotoUploader
                jobId={jobId}
                taskId={savedTaskId}
                value={photos}
                onChange={(next) => void handlePhotosChange(next)}
                maxFiles={
                  spec.fields.find((field) => field.kind === "photos")?.maxFiles ?? undefined
                }
              />
            ) : null}

            <p className="text-muted-foreground text-balance text-sm">
              Photos are saved to this task as soon as each upload finishes — you can close this
              dialog at any point without losing them.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("details")}
                disabled={isBusy}
              >
                <ArrowLeft /> Back to details
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)} disabled={isBusy}>
                {isSavingPhotos ? <Loader2 className="animate-spin" /> : <Check />}
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Two-dot progress header, matching the job wizard's step styling. */
function StepIndicator({
  step,
  onBack,
  canGoBack,
}: {
  step: TaskEditorStep;
  onBack: () => void;
  canGoBack: boolean;
}) {
  const steps = [
    { id: "details" as const, label: "Task details", icon: null },
    { id: "photos" as const, label: "Photos", icon: ImagePlus },
  ];

  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <ol className="mb-1 flex items-center gap-2">
      {steps.map((item, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={item.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              // Only the completed step is clickable, and only when idle.
              onClick={isComplete && canGoBack ? onBack : undefined}
              disabled={!isComplete || !canGoBack}
              className={cn(
                "flex items-center gap-2 rounded-md text-sm",
                isComplete && canGoBack && "hover:text-foreground cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isComplete && !isCurrent && "text-muted-foreground",
                )}
                aria-hidden
              >
                {isComplete ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={cn("font-medium", !isCurrent && !isComplete && "text-muted-foreground")}
              >
                {item.label}
                {isCurrent ? <span className="sr-only"> (current step)</span> : null}
              </span>
            </button>

            {index < steps.length - 1 ? (
              <div
                className={cn("h-px flex-1", isComplete ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export { categoryForSubtype };
