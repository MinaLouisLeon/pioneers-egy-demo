"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@pioneers/ui/lib/utils";

import { isActiveNavItem, type NavItem } from "@/lib/navigation";

export function SidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  /** Lets the mobile drawer close itself when a link is followed. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const active = isActiveNavItem(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:ring-ring outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-70")}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
