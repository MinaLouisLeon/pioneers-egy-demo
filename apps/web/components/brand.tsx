import Image from "next/image";

import { cn } from "@pioneers/ui/lib/utils";

/**
 * Brand assets, taken from the corporate site at pioneers-egy.com.
 *
 * `public/brand/logo-full.png` is the company logo exactly as published (PIS
 * emblem, divider, "PIONEERS / Integrated Engineering Services").
 * `public/brand/emblem.png` is the emblem cropped out of it.
 *
 * The published logo has a transparent background and a navy wordmark, so it
 * disappears against the dark theme. The app shell therefore pairs the emblem —
 * a solid maroon tile that reads on any background — with live text, and the
 * full logo is used only on surfaces that are always light.
 *
 * `unoptimized` keeps these off the image optimiser: they are already small,
 * and optimising PNGs in production would pull in `sharp` for no benefit.
 */

const EMBLEM = { src: "/brand/emblem.png", width: 178, height: 154 };
const LOGO_FULL = { src: "/brand/logo-full.png", width: 563, height: 155 };

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={EMBLEM.src}
      alt=""
      width={EMBLEM.width}
      height={EMBLEM.height}
      priority
      unoptimized
      aria-hidden
      className={cn("h-9 w-auto rounded-[3px]", className)}
    />
  );
}

/**
 * The published logo, unmodified. Only for light backgrounds — see above.
 */
export function BrandLogoFull({ className }: { className?: string }) {
  return (
    <Image
      src={LOGO_FULL.src}
      alt="Pioneers-EGY — Integrated Engineering Services"
      width={LOGO_FULL.width}
      height={LOGO_FULL.height}
      priority
      unoptimized
      className={cn("h-10 w-auto", className)}
    />
  );
}

export function BrandLockup({
  className,
  showTagline = false,
  inverted = false,
}: {
  className?: string;
  showTagline?: boolean;
  /** For placement on a dark or maroon panel. */
  inverted?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-none">
        <div
          className={cn(
            "text-[15px] font-bold tracking-tight",
            inverted ? "text-white" : "text-secondary dark:text-foreground",
          )}
        >
          PIONEERS-EGY
        </div>
        {showTagline ? (
          <div
            className={cn(
              "mt-1 font-serif text-[10px] tracking-wide",
              inverted ? "text-white/70" : "text-muted-foreground",
            )}
          >
            Integrated Engineering Services
          </div>
        ) : null}
      </div>
    </div>
  );
}
