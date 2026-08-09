"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { toast } from "sonner";

/**
 * Shows a one-off toast for an action that completed on another route.
 *
 * A server action that ends in `redirect()` cannot show a toast itself — the
 * calling component is gone by the time the navigation lands. The action
 * signals with a query parameter instead, and this clears it afterwards so the
 * message does not reappear on refresh or when the entry is revisited from
 * history.
 */
export function FlashToast({
  when,
  message,
  description,
}: {
  /** Render the toast only when this is true. */
  when: boolean;
  message: string;
  description?: string;
}) {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (!when || shown.current) return;
    shown.current = true;

    toast.success(message, description ? { description } : undefined);

    // Strip the flag so a refresh does not replay the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("deleted");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [when, message, description, router]);

  return null;
}
