/**
 * ===========================================================================
 * The single source of truth for every inspection form.
 * ===========================================================================
 *
 * Each subtype is declared once, as data: a label, a Zod schema, blank
 * defaults, and an ordered list of field descriptors. The web app renders a
 * spec with shadcn/ui controls; the Expo app renders the same spec with React
 * Native controls. Neither hard-codes a single field.
 *
 * To add a form (for example the real environmental options), add its schema to
 * schemas/task.ts and an entry here. No UI code in either app changes.
 */

import {
  NDT_METHOD_LABELS,
  NDT_METHODS,
  environmentalDataSchema,
  liftingDataSchema,
  ndtDataSchema,
  testingDataSchema,
  type TaskSubtype,
} from "../schemas/task";
import type { SelectOption, TaskFormSpec } from "./types";

/** Photos are capped per task to keep offline uploads and payloads sane. */
export const MAX_PHOTOS_PER_TASK = 12;

const PHOTOS_FIELD = {
  kind: "photos",
  name: "photos",
  label: "Photos",
  helpText: "JPEG, PNG or WebP, up to 10 MB each.",
  maxFiles: MAX_PHOTOS_PER_TASK,
  colSpan: 2,
} as const;

const NDT_METHOD_OPTIONS: readonly SelectOption[] = NDT_METHODS.map((method) => ({
  value: method,
  label: NDT_METHOD_LABELS[method],
}));

const PASS_FAIL_OPTIONS: readonly SelectOption[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
];

// ---------------------------------------------------------------------------
// Inspection → Lifting
// ---------------------------------------------------------------------------

const liftingSpec: TaskFormSpec = {
  subtype: "lifting",
  label: "Lifting",
  description: "Lifting equipment and accessories examination.",
  schema: liftingDataSchema,
  defaults: { quantity: undefined, notes: "", description: "" },
  fields: [
    {
      kind: "number",
      name: "quantity",
      label: "Quantity",
      placeholder: "0",
      min: 0,
      step: 1,
      required: true,
      colSpan: 1,
    },
    {
      kind: "textarea",
      name: "description",
      label: "Description",
      placeholder: "Describe the equipment examined…",
      rows: 4,
      required: true,
      colSpan: 2,
    },
    {
      kind: "textarea",
      name: "notes",
      label: "Notes",
      placeholder: "Observations, defects found, actions taken…",
      rows: 4,
      colSpan: 2,
    },
    PHOTOS_FIELD,
  ],
};

// ---------------------------------------------------------------------------
// Inspection → Testing
// ---------------------------------------------------------------------------

const testingSpec: TaskFormSpec = {
  subtype: "testing",
  label: "Testing",
  description: "Functional or load testing with a pass/fail outcome.",
  schema: testingDataSchema,
  defaults: {
    test_name: "",
    result: undefined,
    item_description: "",
    quantity: undefined,
  },
  fields: [
    {
      kind: "text",
      name: "test_name",
      label: "Test name",
      placeholder: "e.g. Load test @ 125% SWL",
      required: true,
      colSpan: 1,
    },
    {
      kind: "number",
      name: "quantity",
      label: "Quantity",
      placeholder: "0",
      min: 0,
      step: 1,
      required: true,
      colSpan: 1,
    },
    {
      kind: "radio",
      name: "result",
      label: "Result",
      options: PASS_FAIL_OPTIONS,
      required: true,
      colSpan: 2,
    },
    {
      kind: "textarea",
      name: "item_description",
      label: "Item description",
      placeholder: "Describe the item tested and the conditions…",
      rows: 4,
      required: true,
      colSpan: 2,
    },
    PHOTOS_FIELD,
  ],
};

// ---------------------------------------------------------------------------
// Inspection → NDT
// ---------------------------------------------------------------------------

const ndtSpec: TaskFormSpec = {
  subtype: "ndt",
  label: "NDT",
  description: "Non-destructive testing by method.",
  schema: ndtDataSchema,
  defaults: {
    method: undefined,
    item_description: "",
    percent_complete: undefined,
    notes: "",
    quantity: undefined,
  },
  fields: [
    {
      kind: "select",
      name: "method",
      label: "Method",
      placeholder: "Select a method",
      options: NDT_METHOD_OPTIONS,
      required: true,
      colSpan: 1,
    },
    {
      kind: "number",
      name: "quantity",
      label: "Quantity",
      placeholder: "0",
      min: 0,
      step: 1,
      required: true,
      colSpan: 1,
    },
    {
      kind: "number",
      name: "percent_complete",
      label: "Percentage of work done",
      placeholder: "0",
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
      required: true,
      colSpan: 1,
    },
    {
      kind: "textarea",
      name: "item_description",
      label: "Item description",
      placeholder: "Describe the welds, components or areas examined…",
      rows: 4,
      required: true,
      colSpan: 2,
    },
    {
      kind: "textarea",
      name: "notes",
      label: "Notes",
      placeholder: "Indications, acceptance criteria, follow-up…",
      rows: 4,
      colSpan: 2,
    },
    PHOTOS_FIELD,
  ],
};

// ---------------------------------------------------------------------------
// Environmental → Options 1–3 (placeholders)
// ---------------------------------------------------------------------------

function environmentalSpec(subtype: TaskSubtype, label: string): TaskFormSpec {
  return {
    subtype,
    label,
    description: "Environmental assessment — full form to be specified.",
    schema: environmentalDataSchema,
    defaults: { notes: "" },
    fields: [
      {
        kind: "textarea",
        name: "notes",
        label: "Notes",
        placeholder: "Record findings here until this form is finalised…",
        helpText: "This form is a placeholder; its fields will be defined later.",
        rows: 5,
        colSpan: 2,
      },
      PHOTOS_FIELD,
    ],
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TASK_FORM_SPECS = {
  lifting: liftingSpec,
  testing: testingSpec,
  ndt: ndtSpec,
  env_option_1: environmentalSpec("env_option_1", "Option 1"),
  env_option_2: environmentalSpec("env_option_2", "Option 2"),
  env_option_3: environmentalSpec("env_option_3", "Option 3"),
} as const satisfies Record<TaskSubtype, TaskFormSpec>;

/**
 * Look up a spec, failing loudly on an unknown subtype.
 *
 * The lookup used to be a bare index, so a bad value surfaced as
 * "Cannot read properties of undefined (reading 'defaults')" several frames
 * away from the actual mistake. Callers should still validate with
 * `isTaskSubtype`; this is the backstop that names the culprit.
 */
export function getTaskFormSpec(subtype: TaskSubtype): TaskFormSpec {
  const spec = TASK_FORM_SPECS[subtype];
  if (!spec) {
    throw new Error(
      `Unknown inspection task subtype "${subtype}". Expected one of: ${Object.keys(
        TASK_FORM_SPECS,
      ).join(", ")}.`,
    );
  }
  return spec;
}

/** Blank `data` for a newly added task. Returns a fresh object each call. */
export function createTaskDefaults(subtype: TaskSubtype): Record<string, unknown> {
  return { ...getTaskFormSpec(subtype).defaults };
}

/**
 * Field list minus the photo uploader — handy for read-only views, which render
 * photos in a gallery rather than inline with the text fields.
 */
export function dataFieldsFor(subtype: TaskSubtype) {
  return getTaskFormSpec(subtype).fields.filter((field) => field.kind !== "photos");
}
