import { z } from "zod";

import { isoDateSchema, nullableText, requiredText, uuidSchema } from "./primitives";

export const certificateMetadataSchema = z
  .object({
    title: requiredText("Title", 200),
    company_name: nullableText(200),
    certificate_number: nullableText(100),
    issue_date: isoDateSchema.nullable(),
    expiry_date: isoDateSchema.nullable(),
    job_id: uuidSchema.nullable(),
  })
  .refine(
    (value) => !value.issue_date || !value.expiry_date || value.expiry_date >= value.issue_date,
    { error: "Expiry date cannot be before the issue date.", path: ["expiry_date"] },
  );

export type CertificateMetadata = z.infer<typeof certificateMetadataSchema>;

/** Metadata plus the uploaded file, as submitted by the upload form. */
export const certificateUploadSchema = z.object({
  clientId: uuidSchema,
  file_name: requiredText("File name", 255),
  content_type: z.literal("application/pdf", { error: "Only PDF files are accepted." }),
  size_bytes: z.number().int().positive(),
  r2_key: z.string().min(1),
});

export type CertificateUpload = z.infer<typeof certificateUploadSchema>;

export const certificateFiltersSchema = z.object({
  search: z.string().trim().default(""),
  status: z.enum(["all", "valid", "expiring", "expired", "no-expiry"]).default("all"),
  page: z.number().int().min(1).default(1),
});

export type CertificateFilters = z.infer<typeof certificateFiltersSchema>;

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

export const shareLinkCreateSchema = z.object({
  label: nullableText(120),
  /** Null means the link never expires (it can still be revoked). */
  expiresInDays: z.number().int().min(1).max(365).nullable(),
});

export type ShareLinkCreate = z.infer<typeof shareLinkCreateSchema>;

/** Shape returned by the public GET /api/verify/[token] route. */
export const verifyResponseSchema = z.object({
  status: z.enum(["ok", "revoked", "expired", "not-found"]),
  certificate: z
    .object({
      title: z.string(),
      file_name: z.string(),
      company_name: z.string().nullable(),
      certificate_number: z.string().nullable(),
      issue_date: z.string().nullable(),
      expiry_date: z.string().nullable(),
      size_bytes: z.number(),
    })
    .nullable()
    .default(null),
  downloadUrl: z.string().nullable().default(null),
});

export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

// ---------------------------------------------------------------------------
// Expiry status
// ---------------------------------------------------------------------------

export type CertificateStatus = "valid" | "expiring" | "expired" | "no-expiry";

export const EXPIRING_SOON_DAYS = 30;

export function certificateStatus(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): CertificateStatus {
  if (!expiryDate) return "no-expiry";

  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const daysRemaining = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= EXPIRING_SOON_DAYS) return "expiring";
  return "valid";
}

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
  "no-expiry": "No expiry",
};
