import { z } from "zod";

import { verifyResponseSchema } from "@pioneers/core/schemas";

import type { ApiClient } from "./client";
import {
  adminUserListResponseSchema,
  adminUserSchema,
  downloadUrlResponseSchema,
  shareLinkListResponseSchema,
  shareLinkResponseSchema,
  uploadUrlResponseSchema,
  type DownloadUrlRequest,
  type UploadUrlRequest,
} from "./types";

const okSchema = z.object({ ok: z.literal(true) });

/**
 * Every route handler in the app, typed. Both apps import these rather than
 * hand-writing fetch calls, so a route rename breaks the build in one place.
 */
export const api = {
  storage: {
    uploadUrl: (client: ApiClient, body: UploadUrlRequest) =>
      client.post("/api/storage/upload-url", uploadUrlResponseSchema, body),

    downloadUrls: (client: ApiClient, body: DownloadUrlRequest) =>
      client.post("/api/storage/download-url", downloadUrlResponseSchema, body),
  },

  admin: {
    listUsers: (client: ApiClient) => client.get("/api/admin/users", adminUserListResponseSchema),

    inviteUser: (
      client: ApiClient,
      body: { email: string; full_name: string; role: string; phone: string | null },
    ) => client.post("/api/admin/users", z.object({ user: adminUserSchema }), body),

    updateUser: (
      client: ApiClient,
      userId: string,
      body: Partial<{ full_name: string; role: string; phone: string | null; is_active: boolean }>,
    ) => client.patch(`/api/admin/users/${userId}`, z.object({ user: adminUserSchema }), body),

    deleteUser: (client: ApiClient, userId: string) =>
      client.delete(`/api/admin/users/${userId}`, okSchema),

    resendInvite: (client: ApiClient, userId: string) =>
      client.post(`/api/admin/users/${userId}/resend-invite`, okSchema, {}),
  },

  certificates: {
    listShareLinks: (client: ApiClient, certificateId: string) =>
      client.get(`/api/certificates/${certificateId}/share`, shareLinkListResponseSchema),

    createShareLink: (
      client: ApiClient,
      certificateId: string,
      body: { label: string | null; expiresInDays: number | null },
    ) => client.post(`/api/certificates/${certificateId}/share`, shareLinkResponseSchema, body),

    revokeShareLink: (client: ApiClient, certificateId: string, shareLinkId: string) =>
      client.delete(`/api/certificates/${certificateId}/share/${shareLinkId}`, okSchema),
  },

  /** Public — no authentication. */
  verify: (client: ApiClient, token: string) =>
    client.get(`/api/verify/${token}`, verifyResponseSchema),
};
