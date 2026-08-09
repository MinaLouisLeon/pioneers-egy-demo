import { Award, ClipboardList, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

import { can, type Permission, type UserRole } from "@pioneers/core/roles";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
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
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/jobs",
    label: "Inspection Jobs",
    description: "Record site visits and inspection tasks",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/certificates",
    label: "Certification",
    description: "Upload, search and share certificates",
    icon: Award,
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    description: "Manage who can access the system",
    icon: Users,
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
