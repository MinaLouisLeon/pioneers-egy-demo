import Link from "next/link";
import type { Metadata } from "next";

import { ArrowLeft, Calendar, Building2, Pencil, User } from "lucide-react";

import { formatDate, formatDateTime } from "@pioneers/core/format";
import { canEditJob } from "@pioneers/core/roles";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent } from "@pioneers/ui/components/card";
import { Separator } from "@pioneers/ui/components/separator";

import { JobActions } from "@/components/jobs/job-actions";
import { TaskSummary } from "@/components/jobs/task-summary";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getJobWithTasks } from "@/lib/jobs";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobWithTasks(id);
  return { title: job.project_name };
}

export default async function JobDetailPage({ params }: PageProps<"/dashboard/jobs/[id]">) {
  const profile = await requireUser();
  const { id } = await params;

  const job = await getJobWithTasks(id);
  const canEdit = canEditJob(profile.role, profile.id, job);

  const photoCount = job.job_tasks.reduce((total, task) => total + task.task_photos.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/dashboard/jobs">
          <ArrowLeft /> All jobs
        </Link>
      </Button>

      <PageHeader
        title={job.project_name}
        description={job.company_name}
        actions={
          <div className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            {canEdit ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/jobs/${job.id}/edit?step=details`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
                <JobActions jobId={job.id} status={job.status} role={profile.role} />
              </>
            ) : null}
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta icon={Building2} label="Company" value={job.company_name} />
            <Meta icon={Calendar} label="Date of visit" value={formatDate(job.visit_date)} />
            <Meta icon={User} label="Inspector" value={job.created_by_profile?.full_name ?? "—"} />
            <Meta
              icon={Calendar}
              label={job.status === "submitted" ? "Submitted" : "Created"}
              value={formatDateTime(job.submitted_at ?? job.created_at)}
            />
          </dl>

          {job.notes ? (
            <>
              <Separator className="my-4" />
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Job notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{job.notes}</dd>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Inspection tasks ({job.job_tasks.length})</h2>
        <span className="text-muted-foreground text-xs">
          {photoCount} photo{photoCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {job.job_tasks.map((task, index) => (
          <TaskSummary key={task.id} task={task} index={index} />
        ))}
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
        <dd className="break-anywhere text-sm">{value}</dd>
      </div>
    </div>
  );
}
