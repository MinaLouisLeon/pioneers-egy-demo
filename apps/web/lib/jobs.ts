import "server-only";

import { notFound } from "next/navigation";

import type { TaskCategory, TaskSubtype } from "@pioneers/core/schemas";

import { getSupabaseServerClient } from "./supabase/server";

export type JobPhoto = {
  id: string;
  client_id: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sort_order: number;
};

export type JobTask = {
  id: string;
  client_id: string;
  category: TaskCategory;
  subtype: TaskSubtype;
  sort_order: number;
  data: unknown;
  task_photos: JobPhoto[];
};

export type JobWithTasks = {
  id: string;
  client_id: string;
  project_name: string;
  company_name: string;
  visit_date: string;
  status: "draft" | "submitted";
  notes: string | null;
  created_by: string;
  created_at: string;
  submitted_at: string | null;
  job_tasks: JobTask[];
  created_by_profile: { full_name: string; email: string } | null;
};

const JOB_WITH_TASKS_SELECT = `
  id, client_id, project_name, company_name, visit_date, status, notes,
  created_by, created_at, submitted_at,
  created_by_profile:profiles!jobs_created_by_fkey ( full_name, email ),
  job_tasks (
    id, client_id, category, subtype, sort_order, data,
    task_photos ( id, client_id, r2_key, file_name, content_type, size_bytes, sort_order )
  )
`;

/**
 * Load a job with its tasks and photos in one round trip.
 *
 * RLS decides visibility, so a job belonging to another inspector simply comes
 * back empty and surfaces as a 404 — which is also the right answer for an
 * unauthorised request, since it leaks nothing about whether the id exists.
 */
export async function getJobWithTasks(jobId: string): Promise<JobWithTasks> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_WITH_TASKS_SELECT)
    .eq("id", jobId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) notFound();

  const job = data as unknown as JobWithTasks;

  job.job_tasks.sort((a, b) => a.sort_order - b.sort_order);
  for (const task of job.job_tasks) {
    task.task_photos.sort((a, b) => a.sort_order - b.sort_order);
  }

  return job;
}

export type JobListFilters = {
  search?: string;
  status?: "draft" | "submitted" | "all";
  page?: number;
  pageSize?: number;
};

export async function listJobs(filters: JobListFilters = {}) {
  const { search = "", status = "all", page = 1, pageSize = 20 } = filters;

  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("jobs")
    .select(
      `id, project_name, company_name, visit_date, status, created_at, created_by,
       created_by_profile:profiles!jobs_created_by_fkey ( full_name ),
       job_tasks ( id )`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (status !== "all") query = query.eq("status", status);

  if (search.trim()) {
    // Escape the PostgREST `or` delimiters so a comma or paren in the search
    // box cannot break out of the filter expression.
    const term = search.trim().replace(/[,()]/g, " ");
    query = query.or(`project_name.ilike.%${term}%,company_name.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;

  const { data, count, error } = await query
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);

  return {
    jobs: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}
