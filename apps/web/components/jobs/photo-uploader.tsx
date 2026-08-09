"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { AlertCircle, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";

import { newClientId } from "@pioneers/core/ids";
import {
  MAX_PHOTOS_PER_TASK,
  PHOTO_CONTENT_TYPES,
  formatBytes,
  validateUpload,
} from "@pioneers/core";
import { Button } from "@pioneers/ui/components/button";
import { Progress } from "@pioneers/ui/components/progress";
import { cn } from "@pioneers/ui/lib/utils";

import { compressImage, uploadToR2 } from "@/lib/upload";

export type UploadedPhoto = {
  clientId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  r2Key: string;
};

type PendingPhoto = {
  clientId: string;
  fileName: string;
  previewUrl: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  r2Key?: string;
  contentType: string;
  sizeBytes: number;
  file?: File;
};

/**
 * Drag-and-drop photo uploader that writes straight to R2.
 *
 * Uploads start as soon as a file is chosen rather than on form submit, so the
 * user sees progress and can retry a single failed photo instead of losing the
 * whole batch. `onChange` only ever reports photos that finished successfully.
 */
export function PhotoUploader({
  jobId,
  taskId,
  value,
  onChange,
  maxFiles = MAX_PHOTOS_PER_TASK,
  disabled,
}: {
  jobId: string;
  taskId: string;
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<PendingPhoto[]>(() =>
    value.map((photo) => ({
      clientId: photo.clientId,
      fileName: photo.fileName,
      previewUrl: "",
      progress: 100,
      status: "done" as const,
      r2Key: photo.r2Key,
      contentType: photo.contentType,
      sizeBytes: photo.sizeBytes,
    })),
  );
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs are a real leak if not released; drop them on unmount.
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const publish = useCallback(
    (photos: PendingPhoto[]) => {
      onChange(
        photos
          .filter((photo) => photo.status === "done" && photo.r2Key)
          .map((photo) => ({
            clientId: photo.clientId,
            fileName: photo.fileName,
            contentType: photo.contentType,
            sizeBytes: photo.sizeBytes,
            r2Key: photo.r2Key!,
          })),
      );
    },
    [onChange],
  );

  const startUpload = useCallback(
    async (entry: PendingPhoto, file: File) => {
      const update = (patch: Partial<PendingPhoto>) =>
        setPending((current) => {
          const next = current.map((item) =>
            item.clientId === entry.clientId ? { ...item, ...patch } : item,
          );
          if (patch.status === "done" || patch.status === "error") publish(next);
          return next;
        });

      try {
        const { key } = await uploadToR2({
          file,
          request: {
            scope: "task-photo",
            jobId,
            taskId,
            photoClientId: entry.clientId,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          },
          onProgress: (progress) => update({ progress }),
        });

        update({ status: "done", progress: 100, r2Key: key });
      } catch (error) {
        update({
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    },
    [jobId, taskId, publish],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = maxFiles - pending.length;
      const accepted = Array.from(files).slice(0, Math.max(0, remaining));

      for (const original of accepted) {
        const file = await compressImage(original);

        const problem = validateUpload("task-photo", {
          contentType: file.type,
          sizeBytes: file.size,
        });

        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.push(previewUrl);

        const entry: PendingPhoto = {
          clientId: newClientId(),
          fileName: file.name,
          previewUrl,
          progress: 0,
          status: problem ? "error" : "uploading",
          error: problem ?? undefined,
          contentType: file.type,
          sizeBytes: file.size,
          file,
        };

        setPending((current) => [...current, entry]);
        if (!problem) void startUpload(entry, file);
      }
    },
    [maxFiles, pending.length, startUpload],
  );

  function remove(clientId: string) {
    setPending((current) => {
      const next = current.filter((photo) => photo.clientId !== clientId);
      publish(next);
      return next;
    });
  }

  function retry(photo: PendingPhoto) {
    if (!photo.file) return;
    setPending((current) =>
      current.map((item) =>
        item.clientId === photo.clientId
          ? { ...item, status: "uploading", progress: 0, error: undefined }
          : item,
      ),
    );
    void startUpload(photo, photo.file);
  }

  const isFull = pending.length >= maxFiles;
  const uploading = pending.some((photo) => photo.status === "uploading");

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled && event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed p-5 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          (disabled || isFull) && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_CONTENT_TYPES.join(",")}
          multiple
          className="sr-only"
          disabled={disabled || isFull}
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            // Reset so re-selecting the same file fires change again.
            event.target.value = "";
          }}
        />

        <ImagePlus className="text-muted-foreground mx-auto mb-2 size-6" aria-hidden />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || isFull}
          onClick={() => inputRef.current?.click()}
        >
          Choose photos
        </Button>
        <p className="text-muted-foreground mt-2 text-balance text-xs">
          {isFull
            ? `Maximum of ${maxFiles} photos reached.`
            : `Drag and drop, or choose files. Up to ${maxFiles} photos, 10 MB each. Large images are resized automatically.`}
        </p>
      </div>

      {pending.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pending.map((photo) => (
            <li
              key={photo.clientId}
              className="bg-muted group relative aspect-square overflow-hidden rounded-md border"
            >
              {photo.previewUrl ? (
                // Blob URLs cannot go through the Next image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                  Uploaded
                </div>
              )}

              {photo.status === "uploading" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 p-3">
                  <Loader2 className="size-5 animate-spin text-white" />
                  <Progress value={photo.progress} className="h-1.5 w-full" />
                  <span className="text-[11px] text-white">{photo.progress}%</span>
                </div>
              ) : null}

              {photo.status === "error" ? (
                <div className="bg-destructive/85 absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                  <AlertCircle className="size-5 text-white" />
                  <span className="line-clamp-3 text-[11px] text-white">{photo.error}</span>
                  {photo.file ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 text-xs"
                      onClick={() => retry(photo)}
                    >
                      <RotateCcw className="size-3" /> Retry
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => remove(photo.clientId)}
                disabled={disabled}
                aria-label={`Remove ${photo.fileName}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <p className="truncate text-[11px] text-white">{photo.fileName}</p>
                <p className="text-[10px] text-white/70">{formatBytes(photo.sizeBytes)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {uploading ? (
        <p className="text-muted-foreground text-xs">
          Uploading… you can keep filling in the form, but wait for this to finish before saving.
        </p>
      ) : null}
    </div>
  );
}

/** Stored photo rendered from a signed URL (read-only views). */
export function PhotoThumb({
  url,
  alt,
  onClick,
}: {
  url: string;
  alt: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-muted focus-visible:ring-ring relative aspect-square overflow-hidden rounded-md border outline-none focus-visible:ring-2"
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes="(max-width: 640px) 50vw, 200px"
        className="object-cover"
        unoptimized
      />
    </button>
  );
}
