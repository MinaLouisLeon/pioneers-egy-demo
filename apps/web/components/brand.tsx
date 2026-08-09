import { cn } from "@pioneers/ui/lib/utils";

/**
 * Wordmark, matching the corporate identity at pioneers-egy.com.
 *
 * The glyph is drawn inline rather than loaded as an image so it inherits the
 * theme colours, stays crisp at any size, and costs no network request. Maroon
 * shield with a navy inspection crosshair — the two brand colours in one mark.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-9", className)}>
      <path
        d="M16 2.2 4.2 6.9v9.4c0 6.6 4.8 11.7 11.8 13.6 7-1.9 11.8-7 11.8-13.6V6.9L16 2.2Z"
        className="fill-primary"
      />
      <path
        d="M16 5.1 6.9 8.7v7.6c0 5.2 3.7 9.3 9.1 10.9 5.4-1.6 9.1-5.7 9.1-10.9V8.7L16 5.1Z"
        className="fill-secondary"
      />
      <circle cx="16" cy="15.6" r="4.3" className="stroke-white" strokeWidth="1.7" fill="none" />
      <circle cx="16" cy="15.6" r="1.3" className="fill-highlight" />
      <path
        d="M16 8.6v2.4M16 20.2v2.4M9 15.6h2.4m9.2 0H23"
        className="stroke-white"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
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
          className={cn("font-serif text-lg font-bold tracking-tight", inverted && "text-white")}
        >
          PIONEERS
        </div>
        {showTagline ? (
          <div
            className={cn(
              "mt-1 text-[10px] font-medium uppercase tracking-[0.14em]",
              inverted ? "text-white/70" : "text-muted-foreground",
            )}
          >
            Integrated Engineering
          </div>
        ) : null}
      </div>
    </div>
  );
}
