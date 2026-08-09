import "server-only";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 access.
 *
 * The bucket is private. Clients never receive credentials — they get a
 * short-lived presigned URL and talk to R2 directly, which keeps large photo
 * and PDF payloads off the Next.js server entirely.
 *
 * `import "server-only"` makes an accidental import from a client component a
 * build error rather than a credential leak.
 */

export const UPLOAD_URL_TTL_SECONDS = 10 * 60; // 10 minutes to finish an upload
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes to start a download

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
    );
  }

  client = new S3Client({
    // R2 ignores the region but the SDK requires one.
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing R2_BUCKET.");
  return bucket;
}

/**
 * Presigned PUT. `contentType` is part of the signature, so the client must
 * send exactly this Content-Type header or R2 rejects the upload — that is what
 * stops a photo slot being used to host arbitrary files.
 */
export async function createUploadUrl(params: {
  key: string;
  contentType: string;
}): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: params.key,
      ContentType: params.contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

/**
 * Presigned GET. Pass `downloadFileName` to force a save dialog with a friendly
 * name instead of rendering the object inline.
 */
export async function createDownloadUrl(params: {
  key: string;
  downloadFileName?: string;
  expiresIn?: number;
}): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: params.key,
      ...(params.downloadFileName
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeFileName(
              params.downloadFileName,
            )}"`,
          }
        : {}),
    }),
    { expiresIn: params.expiresIn ?? DOWNLOAD_URL_TTL_SECONDS },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // DeleteObjects caps at 1000 keys per request.
  for (let i = 0; i < keys.length; i += 1000) {
    await getClient().send(
      new DeleteObjectsCommand({
        Bucket: getBucket(),
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
  }
}

/** Strip quotes and control characters that would break the header. */
function encodeFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, "_");
}
