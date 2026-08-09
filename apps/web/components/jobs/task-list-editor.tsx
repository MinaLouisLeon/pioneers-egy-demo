"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SUBTYPE_LABELS, CATEGORY_LABELS } from "@pioneers/core/schemas";
import { dataFieldsFor } from "@pioneers/core/forms";
import { Badge } from "@pioneers/ui/components/badge";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent } from "@pioneers/ui/components/card";

import { EmptyState } from "@/components/empty-state";
import {
  TaskEditorDialog,
  newEditableTask,
  type EditableTask,
} from "@/components/jobs/task-editor";
import { deleteTask } from "@/app/(app)/dashboard/jobs/actions";

/**
 * Step 2 of the wizard: the list of tasks on this job.
 *
 * A job can carry any number of tasks of different types — that is the whole
 * point of the second dropdown — so this is a list, not a single form.
 */
export function TaskListEditor({
  jobId,
  initialTasks,
}: {
  jobId: string;
  initialTasks: EditableTask[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState<EditableTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openNew() {
    setEditing(newEditableTask(tasks.length));
    setDialogOpen(true);
  }

  function openExisting(task: EditableTask) {
    setEditing(task);
    setDialogOpen(true);
  }

  function handleSaved(saved: EditableTask) {
    setTasks((current) => {
      const index = current.findIndex((task) => task.clientId === saved.clientId);
      if (index === -1) return [...current, saved];
      const next = [...current];
      next[index] = saved;
      return next;
    });

    // Keep the dialog's `task` prop pointing at the now-persisted row so the
    // photo uploader unlocks without the user having to reopen it.
    setEditing(saved);
    router.refresh();
  }

  async function handleDelete(task: EditableTask) {
    if (!task.taskId) {
      setTasks((current) => current.filter((item) => item.clientId !== task.clientId));
      return;
    }

    const result = await deleteTask(jobId, task.taskId);
    if (!result.ok) {
      toast.error("Could not remove the task", { description: result.error });
      return;
    }

    setTasks((current) => current.filter((item) => item.clientId !== task.clientId));
    toast.success("Task removed");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks on this job yet"
          description="A job can contain several tasks of different types — lifting, NDT, testing or environmental."
          action={
            <Button onClick={openNew}>
              <Plus /> Add first task
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {tasks.map((task, index) => (
              <li key={task.clientId}>
                <Card>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{CATEGORY_LABELS[task.category]}</Badge>
                        <Badge variant="outline">{SUBTYPE_LABELS[task.subtype]}</Badge>
                        {task.photos.length > 0 ? (
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                            <ImageIcon className="size-3" />
                            {task.photos.length}
                          </span>
                        ) : null}
                      </div>

                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {dataFieldsFor(task.subtype)
                          .slice(0, 4)
                          .map((field) => (
                            <div key={field.name} className="flex gap-1.5">
                              <dt className="text-muted-foreground shrink-0">{field.label}:</dt>
                              <dd className="break-anywhere line-clamp-1">
                                {formatValue(task.data[field.name])}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openExisting(task)}
                        aria-label={`Edit task ${index + 1}`}
                      >
                        <Pencil /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(task)}
                        aria-label={`Remove task ${index + 1}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <Button variant="outline" onClick={openNew} className="self-start">
            <Plus /> Add another task
          </Button>
        </>
      )}

      <div className="mt-2 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        <Button variant="outline" asChild>
          <a href={`/dashboard/jobs/${jobId}/edit?step=details`}>
            <ArrowLeft /> Back to job details
          </a>
        </Button>
        <Button
          disabled={tasks.length === 0}
          onClick={() => router.push(`/dashboard/jobs/${jobId}/edit?step=review`)}
        >
          Review and submit <ArrowRight />
        </Button>
      </div>

      <TaskEditorDialog
        jobId={jobId}
        task={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isNaN(value) ? "—" : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
