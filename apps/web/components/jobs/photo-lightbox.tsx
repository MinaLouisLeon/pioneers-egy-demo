"use client";

import { useCallback, useEffect, useState } from "react";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@pioneers/ui/components/button";

/**
 * Full-screen photo viewer.
 *
 * Built directly rather than with the Dialog primitive so the image can fill
 * the viewport edge to edge — inspectors zoom into these to read defects.
 */
export function PhotoLightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: { url: string; fileName: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  const go = useCallback(
    (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }

    window.addEventListener("keydown", onKeyDown);
    // Stop the page behind scrolling while the viewer is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.fileName}
      className="bg-black/92 fixed inset-0 z-50 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 p-3 text-white">
        <p className="truncate text-sm">
          {photo.fileName}
          {photos.length > 1 ? (
            <span className="ml-2 opacity-60">
              {index + 1} / {photos.length}
            </span>
          ) : null}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
          className="text-white hover:bg-white/15 hover:text-white"
        >
          <X />
        </Button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center p-3"
        onClick={(event) => event.stopPropagation()}
      >
        {photos.length > 1 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 text-white hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft />
          </Button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.fileName}
          className="max-h-full max-w-full object-contain"
        />

        {photos.length > 1 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 text-white hover:bg-white/15 hover:text-white"
          >
            <ChevronRight />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
