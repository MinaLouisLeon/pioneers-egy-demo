/**
 * Roles and permissions.
 *
 * IMPORTANT: this table is a *mirror* of the RLS policies in
 * supabase/migrations/*_rls.sql, used to decide what the UI offers. It is not
 * the security boundary — the database is. If you change one, change both.
 */

export const USER_ROLES = ["admin", "manager", "inspector"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  manager: "Manager",
  inspector: "Inspector",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full access, including managing user accounts.",
  manager: "Can view every job and certificate across the company.",
  inspector: "Can create and manage their own inspection jobs.",
};

export type Permission =
  // Accounts
  | "accounts.manage"
  // Jobs
  | "jobs.create"
  | "jobs.read.own"
  | "jobs.read.all"
  | "jobs.update.own"
  | "jobs.update.all"
  | "jobs.delete"
  // Certificates
  | "certificates.read"
  | "certificates.create"
  | "certificates.update.own"
  | "certificates.update.all"
  | "certificates.delete"
  | "certificates.share";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    "accounts.manage",
    "jobs.create",
    "jobs.read.own",
    "jobs.read.all",
    "jobs.update.own",
    "jobs.update.all",
    "jobs.delete",
    "certificates.read",
    "certificates.create",
    "certificates.update.own",
    "certificates.update.all",
    "certificates.delete",
    "certificates.share",
  ],
  manager: [
    "jobs.create",
    "jobs.read.own",
    "jobs.read.all",
    "jobs.update.own",
    "certificates.read",
    "certificates.create",
    "certificates.update.own",
    "certificates.share",
  ],
  inspector: [
    "jobs.create",
    "jobs.read.own",
    "jobs.update.own",
    "certificates.read",
    "certificates.create",
    "certificates.update.own",
    "certificates.share",
  ],
};

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True when the role may see data belonging to other users. */
export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/**
 * Row-level check for a single job, combining the ownership rule with the
 * role's blanket permissions.
 */
export function canEditJob(
  role: UserRole | null | undefined,
  userId: string | null | undefined,
  job: { created_by: string },
): boolean {
  if (can(role, "jobs.update.all")) return true;
  return can(role, "jobs.update.own") && !!userId && job.created_by === userId;
}

export function canViewJob(
  role: UserRole | null | undefined,
  userId: string | null | undefined,
  job: { created_by: string },
): boolean {
  if (can(role, "jobs.read.all")) return true;
  return can(role, "jobs.read.own") && !!userId && job.created_by === userId;
}

export function canEditCertificate(
  role: UserRole | null | undefined,
  userId: string | null | undefined,
  certificate: { uploaded_by: string },
): boolean {
  if (can(role, "certificates.update.all")) return true;
  return can(role, "certificates.update.own") && !!userId && certificate.uploaded_by === userId;
}
