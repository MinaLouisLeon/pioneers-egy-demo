"use client";

import { useEffect, useState } from "react";

import { ImageOff } from "lucide-react";

import { SUBTYPE_LABELS, CATEGORY_LABELS, type TaskSubtype } from "@pioneers/core/schemas";
import { NDT_METHOD_LABELS, type NdtMethod } from "@pioneers/core/schemas";
import { dataFieldsFor } from "@pioneers/core/forms";
import { Badge } from "@pioneers/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@pioneers/ui/components/card";
import { Skeleton } from "@pioneers/ui/components/skeleton";

import { PhotoLightbox } from "@/components/jobs/photo-lightbox";
import { TestResultBadge } from "@/components/status-badge";
import type { JobTask } from "@/lib/jobs";
import { getDownloadUrls } from "@/lib/upload";

/**
 * Read-only rendering of a task, driven by the same spec that built its form.
 *
 * Photo URLs are signed on demand and expire in minutes, so they are fetched
 * client-side rather than embedded in the server-rendered HTML — a page cached
 * anywhere would otherwise carry stale links.
 */
export function TaskSummary({ task, index }: { task: JobTask; index: number }) {
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const keys = task.task_photos.map((photo) => photo.r2_key);

  useEffect(() => {
    if (keys.length === 0) {
      setUrls({});
      return;
    }

    let cancelled = false;
    getDownloadUrls(keys)
      .then((result) => !cancelled && setUrls(result))
      .catch(() => !cancelled && setUrls({}));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  const data = (task.data ?? {}) as Record<string, unknown>;
  const fields = dataFieldsFor(task.subtype as TaskSubtype);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md text-xs font-semibold">
            {index + 1}
          </span>
          <Badge variant="secondary">{CATEGORY_LABELS[task.category]}</Badge>
          <Badge variant="outline">{SUBTYPE_LABELS[task.subtype as TaskSubtype]}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : ""}>
              <dt className="text-muted-foreground text-xs font-medium">{field.label}</dt>
              <dd className="break-anywhere mt-0.5 whitespace-pre-wrap text-sm">
                {renderValue(field.name, data[field.name], task.subtype as TaskSubtype)}
              </dd>
            </div>
          ))}
        </dl>

        {task.task_photos.length > 0 ? (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Photos ({task.task_photos.length})
            </p>

            {urls === null ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {task.task_photos.map((photo) => (
                  <Skeleton key={photo.id} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {task.task_photos.map((photo, photoIndex) => {
                  const url = urls[photo.r2_key];
                  return (
                    <li key={photo.id}>
                      {url ? (
                        <button
                          type="button"
                          onClick={() => setLightboxIndex(photoIndex)}
                          className="bg-muted focus-visible:ring-ring block aspect-square w-full overflow-hidden rounded-md border outline-none focus-visible:ring-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={photo.file_name}
                            loading="lazy"
                            className="size-full object-cover transition-transform hover:scale-105"
                          />
                        </button>
                      ) : (
                        <div className="bg-muted text-muted-foreground flex aspect-square items-center justify-center rounded-md border">
                          <ImageOff className="size-5" aria-label="Image unavailable" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>

      {lightboxIndex !== null && urls ? (
        <PhotoLightbox
          photos={task.task_photos.map((photo) => ({
            url: urls[photo.r2_key] ?? "",
            fileName: photo.file_name,
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </Card>
  );
}

function renderValue(name: string, value: unknown, subtype: TaskSubtype) {
  if (value === null || value === undefined || value === "") return "—";

  if (name === "result" && (value === "pass" || value === "fail")) {
    return <TestResultBadge result={value} />;
  }

  if (subtype === "ndt" && name === "method") {
    return NDT_METHOD_LABELS[value as NdtMethod] ?? String(value);
  }

  if (name === "percent_complete") return `${value}%`;

  if (typeof value === "number") return Number.isNaN(value) ? "—" : String(value);

  return String(value);
}
