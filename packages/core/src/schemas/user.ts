import { z } from "zod";

import { USER_ROLES } from "../roles";
import { nullableText, requiredText, uuidSchema } from "./primitives";

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Password is required" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(10, { error: "Use at least 10 characters" })
  .max(128, { error: "Use 128 characters or fewer" })
  .refine((value) => /[a-z]/.test(value), { error: "Include a lowercase letter" })
  .refine((value) => /[A-Z]/.test(value), { error: "Include an uppercase letter" })
  .refine((value) => /[0-9]/.test(value), { error: "Include a number" });

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
});

// ---------------------------------------------------------------------------
// Admin account management
// ---------------------------------------------------------------------------

export const inviteUserSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  full_name: requiredText("Full name", 120),
  role: z.enum(USER_ROLES, { error: "Select a role" }),
  phone: nullableText(40),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  full_name: requiredText("Full name", 120).optional(),
  role: z.enum(USER_ROLES).optional(),
  phone: nullableText(40).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userFiltersSchema = z.object({
  search: z.string().trim().default(""),
  role: z.enum([...USER_ROLES, "all"]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;

export const profileSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  full_name: z.string(),
  role: z.enum(USER_ROLES),
  phone: z.string().nullable(),
  is_active: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
