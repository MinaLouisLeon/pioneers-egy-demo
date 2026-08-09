import { z } from "zod";

import { optionalText, requiredInt, requiredText, uuidSchema } from "./primitives";

// ---------------------------------------------------------------------------
// Categories & subtypes — mirror the Postgres enums
// ---------------------------------------------------------------------------

export const TASK_CATEGORIES = ["inspection", "environmental"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const INSPECTION_SUBTYPES = ["lifting", "ndt", "testing"] as const;
export const ENVIRONMENTAL_SUBTYPES = ["env_option_1", "env_option_2", "env_option_3"] as const;

export const TASK_SUBTYPES = [...INSPECTION_SUBTYPES, ...ENVIRONMENTAL_SUBTYPES] as const;
export type TaskSubtype = (typeof TASK_SUBTYPES)[number];

/** Which subtypes the second dropdown offers once a category is picked. */
export const SUBTYPES_BY_CATEGORY: Record<TaskCategory, readonly TaskSubtype[]> = {
  inspection: INSPECTION_SUBTYPES,
  environmental: ENVIRONMENTAL_SUBTYPES,
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  inspection: "Inspection",
  environmental: "Environmental",
};

export const SUBTYPE_LABELS: Record<TaskSubtype, string> = {
  lifting: "Lifting",
  ndt: "NDT",
  testing: "Testing",
  env_option_1: "Option 1",
  env_option_2: "Option 2",
  env_option_3: "Option 3",
};

export function categoryForSubtype(subtype: TaskSubtype): TaskCategory {
  return (INSPECTION_SUBTYPES as readonly string[]).includes(subtype)
    ? "inspection"
    : "environmental";
}

/**
 * Type guards for values arriving from a UI control.
 *
 * A `<Select>` hands back a plain string, and Radix in particular emits `""`
 * when its current value is no longer among its items — which happens for one
 * render while the category dropdown is swapping the type list underneath it.
 * Feeding that straight into TASK_FORM_SPECS crashes the dialog, so callers
 * filter through these first.
 */
export function isTaskCategory(value: string): value is TaskCategory {
  return (TASK_CATEGORIES as readonly string[]).includes(value);
}

export function isTaskSubtype(value: string): value is TaskSubtype {
  return (TASK_SUBTYPES as readonly string[]).includes(value);
}

/** True when the subtype is offered under that category. */
export function isSubtypeInCategory(subtype: string, category: TaskCategory): boolean {
  return (SUBTYPES_BY_CATEGORY[category] as readonly string[]).includes(subtype);
}

// ---------------------------------------------------------------------------
// NDT methods
// ---------------------------------------------------------------------------

export const NDT_METHODS = ["ut", "vt", "pt", "mt", "rt"] as const;
export type NdtMethod = (typeof NDT_METHODS)[number];

export const NDT_METHOD_LABELS: Record<NdtMethod, string> = {
  ut: "UT — Ultrasonic Testing",
  vt: "VT — Visual Testing",
  pt: "PT — Penetrant Testing",
  mt: "MT — Magnetic Particle Testing",
  rt: "RT — Radiographic Testing",
};

export const TEST_RESULTS = ["pass", "fail"] as const;
export type TestResult = (typeof TEST_RESULTS)[number];

// ---------------------------------------------------------------------------
// Photos
//
// Photos are rows in `task_photos`, not fields inside `job_tasks.data`. During
// editing they live in form state as drafts: `r2Key` is null until the upload
// to R2 completes, and `localUri` is set on native where the file sits on disk
// until the sync engine drains it.
// ---------------------------------------------------------------------------

export const photoDraftSchema = z.object({
  clientId: uuidSchema,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().default(0),
  r2Key: z.string().min(1).nullable().default(null),
  localUri: z.string().min(1).nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});

export type PhotoDraft = z.infer<typeof photoDraftSchema>;

// ---------------------------------------------------------------------------
// Per-subtype `data` schemas
//
// These describe exactly what lands in the `job_tasks.data` JSONB column.
// Keep the keys in sync with supabase/seed.sql.
// ---------------------------------------------------------------------------

export const liftingDataSchema = z.object({
  quantity: requiredInt("Quantity"),
  notes: optionalText(4000),
  description: requiredText("Description", 4000),
});

export const testingDataSchema = z.object({
  test_name: requiredText("Test name", 255),
  result: z.enum(TEST_RESULTS, { error: "Select a pass or fail result" }),
  item_description: requiredText("Item description", 4000),
  quantity: requiredInt("Quantity"),
});

export const ndtDataSchema = z.object({
  method: z.enum(NDT_METHODS, { error: "Select an NDT method" }),
  item_description: requiredText("Item description", 4000),
  percent_complete: requiredInt("Percentage of work done", { min: 0, max: 100 }),
  notes: optionalText(4000),
  quantity: requiredInt("Quantity"),
});

/**
 * Placeholder for the three environmental options. The real field sets have not
 * been specified yet; when they are, replace this with three distinct schemas
 * and update TASK_FORM_SPECS. No UI in either app needs to change.
 */
export const environmentalDataSchema = z.object({
  notes: optionalText(4000),
});

export const TASK_DATA_SCHEMAS = {
  lifting: liftingDataSchema,
  ndt: ndtDataSchema,
  testing: testingDataSchema,
  env_option_1: environmentalDataSchema,
  env_option_2: environmentalDataSchema,
  env_option_3: environmentalDataSchema,
} as const satisfies Record<TaskSubtype, z.ZodTypeAny>;

export type TaskDataMap = {
  [K in TaskSubtype]: z.infer<(typeof TASK_DATA_SCHEMAS)[K]>;
};

export type TaskDataFor<K extends TaskSubtype> = TaskDataMap[K];
export type TaskData = TaskDataMap[TaskSubtype];

/**
 * Validate a `data` blob against its subtype. Use this whenever reading from
 * the database, since JSONB carries no type guarantees.
 */
export function parseTaskData<K extends TaskSubtype>(subtype: K, data: unknown): TaskDataFor<K> {
  return TASK_DATA_SCHEMAS[subtype].parse(data) as TaskDataFor<K>;
}

export function safeParseTaskData<K extends TaskSubtype>(subtype: K, data: unknown) {
  return TASK_DATA_SCHEMAS[subtype].safeParse(data);
}

// ---------------------------------------------------------------------------
// The full task as edited in the wizard
// ---------------------------------------------------------------------------

export const taskDraftSchema = z
  .object({
    clientId: uuidSchema,
    category: z.enum(TASK_CATEGORIES, { error: "Select a category" }),
    subtype: z.enum(TASK_SUBTYPES, { error: "Select a type" }),
    sortOrder: z.number().int().nonnegative().default(0),
    data: z.unknown(),
    photos: z.array(photoDraftSchema).default([]),
  })
  .superRefine((task, ctx) => {
    // The DB enforces this too (job_tasks_subtype_matches_category); catching it
    // here gives the user a field-level message instead of a 400.
    if (categoryForSubtype(task.subtype) !== task.category) {
      ctx.addIssue({
        code: "custom",
        path: ["subtype"],
        message: `"${SUBTYPE_LABELS[task.subtype]}" is not a ${CATEGORY_LABELS[task.category]} type`,
      });
      return;
    }

    const result = TASK_DATA_SCHEMAS[task.subtype].safeParse(task.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ["data", ...issue.path] });
      }
    }
  });

export type TaskDraft = z.infer<typeof taskDraftSchema>;
