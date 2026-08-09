"use client";

import { api, type UploadUrlRequest } from "@pioneers/api-client";

import { getApiClient } from "./api";

/**
 * Downscale an image in the browser before uploading.
 *
 * Phone cameras produce 4–12 MB frames; an inspection photo only needs to show
 * a defect. Resizing to 1600px on the long edge typically cuts the payload by
 * 80–90%, which matters a lot on a site with poor signal.
 *
 * Returns the original file untouched if anything goes wrong — a slightly large
 * upload is much better than a lost photo.
 */
export async function compressImage(
  file: File,
  { maxEdge = 1600, quality = 0.82 }: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], replaceExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function replaceExtension(fileName: string, extension: string): string {
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
}

/**
 * Upload a file to R2 through a presigned PUT, reporting progress.
 *
 * XMLHttpRequest rather than fetch because fetch still cannot report upload
 * progress in any browser, and a 10 MB photo on site needs a progress bar.
 */
export async function uploadToR2(params: {
  file: File;
  request: UploadUrlRequest;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<{ key: string }> {
  const { uploadUrl, key, contentType } = await api.storage.uploadUrl(
    getApiClient(),
    params.request,
  );

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    // Must match the signed Content-Type exactly or R2 rejects the request.
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        params.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText || ""}`.trim()));

    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    params.signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(params.file);
  });

  return { key };
}

/** Fetch short-lived view URLs for a batch of stored object keys. */
export async function getDownloadUrls(
  keys: string[],
  { download = false }: { download?: boolean } = {},
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const { urls } = await api.storage.downloadUrls(getApiClient(), { keys, download });
  return urls;
}
