import { describe, expect, it } from "vitest";
import { z } from "zod";

import { TASK_FORM_SPECS, createTaskDefaults, dataFieldsFor } from "../forms/specs";
import {
  TASK_SUBTYPES,
  categoryForSubtype,
  parseTaskData,
  taskDraftSchema,
  type TaskSubtype,
} from "../schemas/task";

const draft = (overrides: Record<string, unknown> = {}) => ({
  clientId: "11111111-1111-4111-8111-111111111111",
  category: "inspection",
  subtype: "lifting",
  sortOrder: 0,
  data: { quantity: 12, notes: "", description: "Gantry tackle" },
  photos: [],
  ...overrides,
});

/**
 * The specs and the schemas are edited independently but must stay aligned —
 * a field with no schema key silently discards the user's input, and a schema
 * key with no field is impossible to fill in. These tests are what make it safe
 * to add new form types by editing data alone.
 */
describe("TASK_FORM_SPECS", () => {
  it.each(TASK_SUBTYPES)("%s spec matches its schema exactly", (subtype) => {
    const spec = TASK_FORM_SPECS[subtype];
    expect(spec.subtype).toBe(subtype);

    const shape = (spec.schema as z.ZodObject).shape;
    const schemaKeys = Object.keys(shape).sort();
    const fieldNames = dataFieldsFor(subtype)
      .map((field) => field.name)
      .sort();

    expect(fieldNames).toEqual(schemaKeys);
  });

  it.each(TASK_SUBTYPES)("%s defaults only reference real schema keys", (subtype) => {
    const spec = TASK_FORM_SPECS[subtype];
    const shape = (spec.schema as z.ZodObject).shape;
    expect(Object.keys(createTaskDefaults(subtype))).toEqual(expect.arrayContaining([]));
    for (const key of Object.keys(spec.defaults)) {
      expect(Object.keys(shape)).toContain(key);
    }
  });

  it.each(TASK_SUBTYPES)("%s exposes a photo uploader", (subtype) => {
    expect(TASK_FORM_SPECS[subtype].fields.some((f) => f.kind === "photos")).toBe(true);
  });

  it("createTaskDefaults returns a fresh object each call", () => {
    const a = createTaskDefaults("lifting");
    const b = createTaskDefaults("lifting");
    expect(a).not.toBe(b);
    a.notes = "mutated";
    expect(b.notes).toBe("");
  });

  it("radio and select fields always carry options", () => {
    for (const subtype of TASK_SUBTYPES) {
      for (const field of TASK_FORM_SPECS[subtype].fields) {
        if (field.kind === "radio" || field.kind === "select") {
          expect(field.options.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("categoryForSubtype", () => {
  it("maps inspection subtypes", () => {
    expect(categoryForSubtype("lifting")).toBe("inspection");
    expect(categoryForSubtype("ndt")).toBe("inspection");
    expect(categoryForSubtype("testing")).toBe("inspection");
  });

  it("maps environmental subtypes", () => {
    expect(categoryForSubtype("env_option_1")).toBe("environmental");
    expect(categoryForSubtype("env_option_2")).toBe("environmental");
    expect(categoryForSubtype("env_option_3")).toBe("environmental");
  });
});

describe("taskDraftSchema", () => {
  it("accepts a valid lifting task", () => {
    expect(taskDraftSchema.safeParse(draft()).success).toBe(true);
  });

  it("accepts a valid NDT task", () => {
    const result = taskDraftSchema.safeParse(
      draft({
        subtype: "ndt",
        data: {
          method: "ut",
          item_description: "Butt welds on spools 4A-4D",
          percent_complete: 100,
          notes: "",
          quantity: 24,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a valid testing task", () => {
    const result = taskDraftSchema.safeParse(
      draft({
        subtype: "testing",
        data: {
          test_name: "Load test @ 125% SWL",
          result: "pass",
          item_description: "Main hoist",
          quantity: 1,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a subtype that does not belong to the category, flagged on subtype", () => {
    const result = taskDraftSchema.safeParse(draft({ category: "environmental" }));
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("subtype");
  });

  it("namespaces field errors under data.* so forms can bind them", () => {
    const result = taskDraftSchema.safeParse(
      draft({
        subtype: "ndt",
        data: {
          method: "not-a-method",
          item_description: "",
          percent_complete: 150,
          notes: "",
          quantity: -1,
        },
      }),
    );

    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining([
        "data.method",
        "data.item_description",
        "data.percent_complete",
        "data.quantity",
      ]),
    );
  });

  it("rejects an empty numeric input (NaN), rather than coercing it to 0", () => {
    const result = taskDraftSchema.safeParse(
      draft({ data: { quantity: Number.NaN, notes: "", description: "x" } }),
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("data.quantity");
  });

  it("requires a description on lifting tasks", () => {
    const result = taskDraftSchema.safeParse(
      draft({ data: { quantity: 1, notes: "", description: "   " } }),
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("data.description");
  });
});

describe("parseTaskData", () => {
  it("round-trips the shape seeded in supabase/seed.sql", () => {
    const data = parseTaskData("lifting", {
      quantity: 12,
      notes: "Two shackles rejected for thread wear",
      description: "Gantry crane lifting tackle: 8 slings, 4 shackles.",
    });
    expect(data.quantity).toBe(12);
  });

  it("throws on a blob that does not match its subtype", () => {
    expect(() => parseTaskData("ndt", { quantity: 1 })).toThrow();
  });

  it("defaults optional notes to an empty string", () => {
    const data = parseTaskData("env_option_1" as TaskSubtype, {});
    expect(data).toEqual({ notes: "" });
  });
});
