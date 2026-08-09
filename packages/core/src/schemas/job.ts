import { z } from "zod";

import { isoDateSchema, optionalText, requiredText, uuidSchema } from "./primitives";
import { taskDraftSchema } from "./task";

export const JOB_STATUSES = ["draft", "submitted"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
};

/** Step 1 of the wizard: who and when. */
export const jobDetailsSchema = z.object({
  project_name: requiredText("Project name", 200),
  company_name: requiredText("Company name", 200),
  visit_date: isoDateSchema,
  notes: optionalText(2000),
});

export type JobDetails = z.infer<typeof jobDetailsSchema>;

/** The whole job as held in wizard state, including its tasks. */
export const jobDraftSchema = jobDetailsSchema.extend({
  clientId: uuidSchema,
  tasks: z.array(taskDraftSchema).default([]),
});

export type JobDraft = z.infer<typeof jobDraftSchema>;

/** Step 3: a job cannot be submitted without at least one task. */
export const jobSubmissionSchema = jobDraftSchema.refine((job) => job.tasks.length > 0, {
  error: "Add at least one inspection task before submitting.",
  path: ["tasks"],
});

export const jobFiltersSchema = z.object({
  search: z.string().trim().default(""),
  status: z.enum([...JOB_STATUSES, "all"]).default("all"),
  createdBy: z.union([uuidSchema, z.literal("all")]).default("all"),
  page: z.number().int().min(1).default(1),
});

export type JobFilters = z.infer<typeof jobFiltersSchema>;
