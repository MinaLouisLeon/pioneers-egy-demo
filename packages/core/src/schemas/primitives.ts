import { z } from "zod";

/**
 * Shared building blocks.
 *
 * Numbers are plain `z.number()` rather than `z.coerce.number()`: coercion
 * turns an empty input into 0, which silently passes a "required" check. Each
 * platform's field renderer is responsible for handing us a real number
 * (`valueAsNumber` on web, `Number(text)` on native) or `NaN`, which fails
 * validation as it should.
 */

export const uuidSchema = z.uuid({ error: "Must be a valid UUID" });

/** Calendar date, `YYYY-MM-DD`. Matches a Postgres `date` column. */
export const isoDateSchema = z.iso.date({ error: "Must be a valid date" });

export function requiredText(label: string, max = 255) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });
}

export function optionalText(max = 4000) {
  return z
    .string()
    .trim()
    .max(max, { error: `Must be ${max} characters or fewer` })
    .default("");
}

/**
 * Nullable free text for columns that distinguish "empty" from "not set".
 *
 * Deliberately has no `.default(null)`: a default makes the schema's *input*
 * type `string | null | undefined` while its output is `string | null`, and
 * react-hook-form then refuses to reconcile the two. Every caller supplies an
 * explicit null, so the default bought nothing.
 */
export function nullableText(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();
}

export function requiredInt(label: string, { min = 0, max = 1_000_000 } = {}) {
  return z
    .number({ error: `${label} is required` })
    .int({ error: `${label} must be a whole number` })
    .min(min, { error: `${label} must be at least ${min}` })
    .max(max, { error: `${label} must be at most ${max}` });
}
