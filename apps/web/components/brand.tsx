import { cn } from "@pioneers/ui/lib/utils";

/**
 * Wordmark. The glyph is a stylised inspection target/crosshair over a shield,
 * drawn inline so it inherits `currentColor` and needs no network request.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-8", className)}>
      <path
        d="M16 2.5 4.5 7v9.2c0 6.4 4.7 11.4 11.5 13.3 6.8-1.9 11.5-6.9 11.5-13.3V7L16 2.5Z"
        className="fill-primary/12 stroke-primary"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="15" r="4.6" className="stroke-primary" strokeWidth="1.8" />
      <path
        d="M16 7.6v2.4M16 20v2.4M8.6 15H11m10 0h2.4"
        className="stroke-primary"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-none">
        <div className="text-base font-semibold tracking-tight">
          Pioneers<span className="text-primary">-EGY</span>
        </div>
        {showTagline ? (
          <div className="text-muted-foreground mt-1 text-xs">Inspection Management</div>
        ) : null}
      </div>
    </div>
  );
}
