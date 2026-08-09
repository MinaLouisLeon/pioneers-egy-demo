import Link from "next/link";
import type { Metadata } from "next";

import { ClipboardList, Plus } from "lucide-react";

import { formatDate } from "@pioneers/core/format";
import { can } from "@pioneers/core/roles";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent } from "@pioneers/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pioneers/ui/components/table";

import { EmptyState } from "@/components/empty-state";
import { JobFilters } from "@/components/jobs/job-filters";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";

export const metadata: Metadata = { title: "Inspection jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/dashboard/jobs">) {
  const profile = await requireUser();
  const query = await searchParams;

  const search = typeof query.search === "string" ? query.search : "";
  const status = query.status === "draft" || query.status === "submitted" ? query.status : "all";
  const page = Number(query.page) > 0 ? Number(query.page) : 1;

  const { jobs, total, pageCount } = await listJobs({ search, status, page });

  const isFiltered = search !== "" || status !== "all";

  return (
    <>
      <PageHeader
        title="Inspection jobs"
        description={
          can(profile.role, "jobs.read.all")
            ? "Every job recorded across the company."
            : "Jobs you have created."
        }
        actions={
          can(profile.role, "jobs.create") ? (
            <Button asChild>
              <Link href="/dashboard/jobs/new">
                <Plus /> New job
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        <JobFilters search={search} status={status} />

        {jobs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={isFiltered ? "No jobs match those filters" : "No inspection jobs yet"}
            description={
              isFiltered
                ? "Try a different search term or clear the status filter."
                : "Create a job to record a site visit and its inspection tasks."
            }
            action={
              !isFiltered && can(profile.role, "jobs.create") ? (
                <Button asChild>
                  <Link href="/dashboard/jobs/new">
                    <Plus /> New job
                  </Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {total} job{total === 1 ? "" : "s"}
            </p>

            {/* Table on md+, cards below — a six-column table is unusable on a phone. */}
            <Card className="hidden overflow-hidden py-0 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Visit date</TableHead>
                    <TableHead className="text-center">Tasks</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="hover:underline focus-visible:underline"
                        >
                          {job.project_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.company_name}</TableCell>
                      <TableCell>{formatDate(job.visit_date)}</TableCell>
                      <TableCell className="text-center">{job.job_tasks.length}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.created_by_profile?.full_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <ul className="grid gap-3 md:hidden">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/dashboard/jobs/${job.id}`}>
                    <Card className="hover:border-primary/40 transition-colors">
                      <CardContent>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-anywhere font-medium">{job.project_name}</p>
                            <p className="text-muted-foreground break-anywhere text-sm">
                              {job.company_name}
                            </p>
                          </div>
                          <JobStatusBadge status={job.status} />
                        </div>
                        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>{formatDate(job.visit_date)}</span>
                          <span>
                            {job.job_tasks.length} task{job.job_tasks.length === 1 ? "" : "s"}
                          </span>
                          {job.created_by_profile?.full_name ? (
                            <span>{job.created_by_profile.full_name}</span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>

            {pageCount > 1 ? (
              <nav className="flex items-center justify-between" aria-label="Pagination">
                <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                  <Link
                    href={buildHref({ search, status, page: page - 1 })}
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Previous
                  </Link>
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {page} of {pageCount}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildHref({ search, status, page: page + 1 })}
                    aria-disabled={page >= pageCount}
                    className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
                  >
                    Next
                  </Link>
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function buildHref({
  search,
  status,
  page,
}: {
  search: string;
  status: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/jobs?${query}` : "/dashboard/jobs";
}
