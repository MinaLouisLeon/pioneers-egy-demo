/**
 * Presentation helpers shared by both apps.
 *
 * Dates from Postgres `date` columns arrive as `YYYY-MM-DD` with no timezone.
 * Passing those straight to `new Date()` parses them as UTC midnight, which
 * renders as the *previous* day for anyone west of Greenwich. We therefore
 * always format calendar dates from their parts rather than via the Date
 * timezone machinery.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2026-03-14` -> `14 Mar 2026`. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  const monthLabel = MONTHS[Number(month) - 1];
  if (!monthLabel) return "—";
  return `${Number(day)} ${monthLabel} ${year}`;
}

/** Timestamps are real instants, so these are formatted in the local zone. */
export function formatDateTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "—";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(toDateInput(date))} at ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatRelative(
  isoTimestamp: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!isoTimestamp) return "—";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute < 60) return "just now";
  if (absolute < 3600) return plural(Math.floor(absolute / 60), "minute", seconds);
  if (absolute < 86_400) return plural(Math.floor(absolute / 3600), "hour", seconds);
  if (absolute < 2_592_000) return plural(Math.floor(absolute / 86_400), "day", seconds);
  return formatDate(toDateInput(date));
}

function plural(value: number, unit: string, direction: number): string {
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return direction >= 0 ? `${label} ago` : `in ${label}`;
}

/** `Date` -> `YYYY-MM-DD` in the *local* zone, for date inputs. */
export function toDateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(
  isoDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}

export function initialsOf(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
