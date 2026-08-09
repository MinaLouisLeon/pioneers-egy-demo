"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@pioneers/core/format";
import { Alert, AlertDescription } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pioneers/ui/components/card";

import { TaskSummary } from "@/components/jobs/task-summary";
import { submitJob } from "@/app/(app)/dashboard/jobs/actions";
import type { JobWithTasks } from "@/lib/jobs";

/** Step 3: everything the inspector entered, then submit. */
export function JobReview({ job }: { job: JobWithTasks }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const photoCount = job.job_tasks.reduce((total, task) => total + task.task_photos.length, 0);

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await submitJob(job.id);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error("Could not submit the job", { description: result.error });
      return;
    }

    toast.success("Job submitted");
    router.push(`/dashboard/jobs/${job.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Detail label="Project" value={job.project_name} />
            <Detail label="Company" value={job.company_name} />
            <Detail label="Date of visit" value={formatDate(job.visit_date)} />
            <Detail
              label="Contents"
              value={`${job.job_tasks.length} task${job.job_tasks.length === 1 ? "" : "s"}, ${photoCount} photo${photoCount === 1 ? "" : "s"}`}
            />
            {job.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs font-medium">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm">{job.notes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium">Inspection tasks</h2>
        <div className="flex flex-col gap-4">
          {job.job_tasks.map((task, index) => (
            <TaskSummary key={task.id} task={task} index={index} />
          ))}
        </div>
      </div>

      {job.job_tasks.length === 0 ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>
            This job has no tasks yet. Go back and add at least one before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/jobs/${job.id}/edit?step=tasks`)}
        >
          <ArrowLeft /> Back to tasks
        </Button>

        {job.status === "submitted" ? (
          <Button variant="secondary" onClick={() => router.push(`/dashboard/jobs/${job.id}`)}>
            <CheckCircle2 /> Already submitted — view job
          </Button>
        ) : (
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || job.job_tasks.length === 0}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Submit job
          </Button>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="break-anywhere mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
