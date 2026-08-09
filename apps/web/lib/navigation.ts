import { Award, ClipboardList, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

import { can, type Permission, type UserRole } from "@pioneers/core/roles";

/**
 * Icons are referenced by name rather than held on the nav item itself.
 *
 * The app shell is a Server Component and the sidebar is a Client Component, so
 * nav items cross the RSC boundary — and only plain, serialisable data can make
 * that trip. A Lucide icon is a React component (a function), which throws
 * "Only plain objects can be passed to Client Components from Server
 * Components" at runtime.
 *
 * Both sides import NAV_ICONS directly and look the component up locally; the
 * map itself is never serialised.
 */
export const NAV_ICONS = {
  overview: LayoutDashboard,
  jobs: ClipboardList,
  certificates: Award,
  accounts: Users,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export type NavItem = {
  href: string;
  label: string;
  description: string;
  /** Key into NAV_ICONS — a string, so it survives serialisation. */
  icon: NavIconName;
  /** Omit for items every signed-in user can reach. */
  permission?: Permission;
};

/**
 * The three sections from the brief, plus the overview. Filtering here only
 * decides what is *shown*; each page independently calls requireRole().
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Recent activity across the company",
    icon: "overview",
  },
  {
    href: "/dashboard/jobs",
    label: "Inspection Jobs",
    description: "Record site visits and inspection tasks",
    icon: "jobs",
  },
  {
    href: "/dashboard/certificates",
    label: "Certification",
    description: "Upload, search and share certificates",
    icon: "certificates",
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    description: "Manage who can access the system",
    icon: "accounts",
    permission: "accounts.manage",
  },
];

export function navItemsForRole(role: UserRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

/** Longest-prefix match so /dashboard/jobs/123 highlights "Inspection Jobs". */
export function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
