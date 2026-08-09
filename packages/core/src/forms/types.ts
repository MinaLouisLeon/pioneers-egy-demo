import type { z } from "zod";

import type { TaskSubtype } from "../schemas/task";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type FieldBase = {
  /** Key inside the task's `data` object. */
  name: string;
  label: string;
  helpText?: string;
  /** Rendered as a "required" marker. Validation still comes from the schema. */
  required?: boolean;
  /** Grid span hint on wide layouts; ignored on mobile. 1 = half width. */
  colSpan?: 1 | 2;
};

export type FieldSpec =
  | (FieldBase & { kind: "text"; placeholder?: string })
  | (FieldBase & { kind: "textarea"; placeholder?: string; rows?: number })
  | (FieldBase & {
      kind: "number";
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
      /** Suffix shown inside the control, e.g. "%". */
      unit?: string;
    })
  | (FieldBase & { kind: "select"; options: readonly SelectOption[]; placeholder?: string })
  | (FieldBase & { kind: "radio"; options: readonly SelectOption[] })
  | (FieldBase & { kind: "photos"; maxFiles: number });

export type FieldKind = FieldSpec["kind"];

export type TaskFormSpec = {
  subtype: TaskSubtype;
  label: string;
  description: string;
  schema: z.ZodTypeAny;
  /** Sensible blank record used when a new task of this subtype is created. */
  defaults: Record<string, unknown>;
  fields: readonly FieldSpec[];
};
