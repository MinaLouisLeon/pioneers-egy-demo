import { z } from "zod";

import { USER_ROLES } from "@pioneers/core/roles";

// ---------------------------------------------------------------------------
// POST /api/storage/upload-url
// ---------------------------------------------------------------------------

export const uploadUrlRequestSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("task-photo"),
    jobId: z.uuid(),
    taskId: z.uuid(),
    photoClientId: z.uuid(),
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }),
  z.object({
    scope: z.literal("certificate"),
    certificateId: z.uuid(),
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }),
]);

export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
  /** Echoed back — R2 rejects the PUT if the header does not match the signature. */
  contentType: z.string(),
  expiresIn: z.number().int().positive(),
});

export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/storage/download-url
// ---------------------------------------------------------------------------

export const downloadUrlRequestSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(50),
  /** Ask the browser to save rather than display the file. */
  download: z.boolean().default(false),
});

export type DownloadUrlRequest = z.infer<typeof downloadUrlRequestSchema>;

export const downloadUrlResponseSchema = z.object({
  urls: z.record(z.string(), z.string().url()),
  expiresIn: z.number().int().positive(),
});

export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;

// ---------------------------------------------------------------------------
// /api/admin/users
// ---------------------------------------------------------------------------

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  role: z.enum(USER_ROLES),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  invite_pending: z.boolean(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListResponseSchema = z.object({
  users: z.array(adminUserSchema),
});

// ---------------------------------------------------------------------------
// Certificate share links
// ---------------------------------------------------------------------------

export const shareLinkSchema = z.object({
  id: z.uuid(),
  token: z.string(),
  url: z.string().url(),
  label: z.string().nullable(),
  is_revoked: z.boolean(),
  expires_at: z.string().nullable(),
  view_count: z.number(),
  download_count: z.number(),
  created_at: z.string(),
  last_accessed_at: z.string().nullable(),
});

export type ShareLink = z.infer<typeof shareLinkSchema>;

export const shareLinkResponseSchema = z.object({
  shareLink: shareLinkSchema,
  /** PNG data URI, ready for an <img src> or a download link. */
  qrCodeDataUrl: z.string(),
});

export type ShareLinkResponse = z.infer<typeof shareLinkResponseSchema>;

export const shareLinkListResponseSchema = z.object({
  shareLinks: z.array(shareLinkSchema),
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
