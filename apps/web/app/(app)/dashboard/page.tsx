import Link from "next/link";
import type { Metadata } from "next";

import { ArrowRight, ClipboardList, FileWarning, Plus, TriangleAlert } from "lucide-react";

import { certificateStatus, formatDate } from "@pioneers/core";
import { can } from "@pioneers/core/roles";
import { Alert, AlertDescription, AlertTitle } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pioneers/ui/components/card";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { NAV_ICONS, navItemsForRole } from "@/lib/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await requireUser();
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();

  // RLS already scopes these: an inspector sees only their own jobs, staff see
  // everything. No role branching needed in the query.
  const [{ data: recentJobs }, { data: certificates }, { count: jobCount }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, project_name, company_name, visit_date, status")
      .is("deleted_at", null)
      .order("visit_date", { ascending: false })
      .limit(5),
    supabase
      .from("certificates")
      .select("id, title, expiry_date")
      .is("deleted_at", null)
      .not("expiry_date", "is", null)
      .order("expiry_date", { ascending: true })
      .limit(50),
    supabase.from("jobs").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const expiringSoon = (certificates ?? []).filter((certificate) => {
    const status = certificateStatus(certificate.expiry_date);
    return status === "expiring" || status === "expired";
  });

  // "Overview" is the page we are on, so it is dropped from the section cards.
  const sections = navItemsForRole(profile.role).filter((item) => item.href !== "/dashboard");

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Create inspection jobs, manage certificates, and — for administrators — company accounts."
        actions={
          can(profile.role, "jobs.create") ? (
            <Button asChild>
              <Link href="/dashboard/jobs/new">
                <Plus /> New inspection job
              </Link>
            </Button>
          ) : null
        }
      />

      {params.denied ? (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>That section is restricted to administrators.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = NAV_ICONS[section.icon];
          return (
            <Card key={section.href} className="hover:border-primary/40 group transition-colors">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-1 flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </div>
                <CardTitle>{section.label}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="px-0 hover:bg-transparent">
                  <Link href={section.href}>
                    Open
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent inspection jobs</CardTitle>
            <CardDescription>
              {jobCount ?? 0} job{jobCount === 1 ? "" : "s"} visible to you.
            </CardDescription>
            <CardAction>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/jobs">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentJobs && recentJobs.length > 0 ? (
              <ul className="divide-y">
                {recentJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/dashboard/jobs/${job.id}`}
                      className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{job.project_name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {job.company_name} · {formatDate(job.visit_date)}
                        </div>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No inspection jobs yet"
                description="Create your first job to start recording site visits."
                action={
                  can(profile.role, "jobs.create") ? (
                    <Button asChild size="sm">
                      <Link href="/dashboard/jobs/new">
                        <Plus /> New inspection job
                      </Link>
                    </Button>
                  ) : null
                }
                className="border-0 py-10"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificates needing attention</CardTitle>
            <CardDescription>Expired, or expiring within 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringSoon.length > 0 ? (
              <ul className="space-y-3">
                {expiringSoon.slice(0, 6).map((certificate) => (
                  <li key={certificate.id}>
                    <Link
                      href={`/dashboard/certificates?search=${encodeURIComponent(certificate.title)}`}
                      className="hover:bg-muted/50 -mx-2 block rounded-md px-2 py-1.5"
                    >
                      <div className="truncate text-sm font-medium">{certificate.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {certificateStatus(certificate.expiry_date) === "expired"
                          ? "Expired"
                          : "Expires"}{" "}
                        {formatDate(certificate.expiry_date)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={FileWarning}
                title="Nothing expiring"
                description="No certificates expire in the next 30 days."
                className="border-0 py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
