/**
 * File constraints and R2 object-key construction.
 *
 * The key layout is deliberately hierarchical so a job's or certificate's
 * objects can be listed and deleted with a single prefix operation.
 */

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const CERTIFICATE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const CERTIFICATE_CONTENT_TYPES = ["application/pdf"] as const;

export type UploadScope = "task-photo" | "certificate";

export const UPLOAD_CONSTRAINTS: Record<
  UploadScope,
  { maxBytes: number; contentTypes: readonly string[] }
> = {
  "task-photo": { maxBytes: PHOTO_MAX_BYTES, contentTypes: PHOTO_CONTENT_TYPES },
  certificate: { maxBytes: CERTIFICATE_MAX_BYTES, contentTypes: CERTIFICATE_CONTENT_TYPES },
};

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function extensionForContentType(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin";
}

/**
 * Validate an upload request before minting a presigned URL. Returns an error
 * string, or null when the file is acceptable.
 *
 * Note: a presigned PUT pins the Content-Type but R2 does not enforce a size
 * limit, so a determined client could exceed maxBytes. The recorded size is
 * therefore verified again when the row is written.
 */
export function validateUpload(
  scope: UploadScope,
  file: { contentType: string; sizeBytes: number },
): string | null {
  const { maxBytes, contentTypes } = UPLOAD_CONSTRAINTS[scope];

  if (!contentTypes.includes(file.contentType)) {
    return `Unsupported file type "${file.contentType}". Allowed: ${contentTypes.join(", ")}.`;
  }
  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    return "File appears to be empty.";
  }
  if (file.sizeBytes > maxBytes) {
    return `File is too large (${formatBytes(file.sizeBytes)}). Maximum is ${formatBytes(maxBytes)}.`;
  }
  return null;
}

/**
 * Strip anything that would be awkward or unsafe inside an object key.
 *
 * Path separators are the important case: a name like `../../secret.pdf` must
 * not be able to climb out of its prefix. Runs of dots are collapsed too, so a
 * traversal attempt leaves no `..` segment behind in the stored key.
 */
export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/\.+$/, "");
  const safe = trimmed
    .replace(/[^\w.\- ]+/g, "_") // separators and other unsafe characters
    .replace(/\s+/g, "_")
    .replace(/\.{2,}/g, "_") // no ".." segments
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, ""); // no leading dot/underscore/dash
  return safe.slice(0, 120) || "file";
}

export function buildTaskPhotoKey(params: {
  jobId: string;
  taskId: string;
  photoClientId: string;
  contentType: string;
}): string {
  const ext = extensionForContentType(params.contentType);
  return `jobs/${params.jobId}/${params.taskId}/${params.photoClientId}.${ext}`;
}

export function buildCertificateKey(params: {
  certificateId: string;
  fileName: string;
  contentType: string;
}): string {
  const ext = extensionForContentType(params.contentType);
  const base = sanitizeFileName(params.fileName).replace(new RegExp(`\\.${ext}$`, "i"), "");
  return `certificates/${params.certificateId}/${base}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
