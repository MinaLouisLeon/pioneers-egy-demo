"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Loader2, Search } from "lucide-react";

import { Input } from "@pioneers/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";

/**
 * Search and status filters, kept in the URL so a filtered view can be
 * bookmarked, shared, and survives a refresh.
 *
 * The text input is debounced — pushing a route on every keystroke would fire a
 * database query per character.
 */
export function JobFilters({ search, status }: { search: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(search);

  // Keep in step when the user navigates back/forward.
  useEffect(() => setValue(search), [search]);

  useEffect(() => {
    if (value === search) return;

    const timer = setTimeout(() => {
      startTransition(() => router.push(buildHref({ search: value, status })));
    }, 350);

    return () => clearTimeout(timer);
  }, [value, search, status, router]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by project or company…"
          className="pl-9"
          aria-label="Search jobs"
        />
        {isPending ? (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      <Select
        value={status}
        onValueChange={(next) =>
          startTransition(() => router.push(buildHref({ search: value, status: next })))
        }
      >
        <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="submitted">Submitted</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function buildHref({ search, status }: { search: string; status: string }): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (status !== "all") params.set("status", status);
  const query = params.toString();
  return query ? `/dashboard/jobs?${query}` : "/dashboard/jobs";
}
