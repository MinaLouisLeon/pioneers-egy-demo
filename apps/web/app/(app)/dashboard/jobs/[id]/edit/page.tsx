import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { canEditJob } from "@pioneers/core/roles";
import type { TaskSubtype } from "@pioneers/core/schemas";

import { JobDetailsForm } from "@/components/jobs/job-details-form";
import { JobReview } from "@/components/jobs/job-review";
import { TaskListEditor } from "@/components/jobs/task-list-editor";
import type { EditableTask } from "@/components/jobs/task-editor";
import { WizardSteps, type WizardStepId } from "@/components/jobs/wizard-steps";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getJobWithTasks } from "@/lib/jobs";

export const metadata: Metadata = { title: "Edit inspection job" };

const STEPS: WizardStepId[] = ["details", "tasks", "review"];

export default async function EditJobPage({
  params,
  searchParams,
}: PageProps<"/dashboard/jobs/[id]/edit">) {
  const profile = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const job = await getJobWithTasks(id);

  // Managers can read every job but only edit their own; sending them to the
  // read-only view is friendlier than a bare 403.
  if (!canEditJob(profile.role, profile.id, job)) {
    redirect(`/dashboard/jobs/${id}`);
  }

  const stepParam = typeof query.step === "string" ? query.step : "details";
  if (!STEPS.includes(stepParam as WizardStepId)) notFound();
  const step = stepParam as WizardStepId;

  const tasks: EditableTask[] = job.job_tasks.map((task) => ({
    taskId: task.id,
    clientId: task.client_id,
    category: task.category,
    subtype: task.subtype as TaskSubtype,
    sortOrder: task.sort_order,
    data: (task.data ?? {}) as Record<string, unknown>,
    photos: task.task_photos.map((photo) => ({
      clientId: photo.client_id,
      fileName: photo.file_name,
      contentType: photo.content_type,
      sizeBytes: photo.size_bytes,
      r2Key: photo.r2_key,
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={job.project_name}
        description={`${job.company_name} · ${job.status === "draft" ? "Draft" : "Submitted"}`}
      />
      <WizardSteps current={step} />

      {step === "details" ? (
        <JobDetailsForm
          jobId={job.id}
          defaultValues={{
            project_name: job.project_name,
            company_name: job.company_name,
            visit_date: job.visit_date,
            notes: job.notes ?? "",
          }}
        />
      ) : null}

      {step === "tasks" ? <TaskListEditor jobId={job.id} initialTasks={tasks} /> : null}

      {step === "review" ? <JobReview job={job} /> : null}
    </div>
  );
}
