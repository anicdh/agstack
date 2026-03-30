/**
 * Form Utilities — shared validation + form helpers.
 *
 * Use Zod schemas for validation. DO NOT write manual validation.
 * Combine with react-hook-form through @hookform/resolvers/zod.
 *
 * @example
 * import { z } from "zod";
 * import { emailSchema, passwordSchema, requiredString } from "@/lib/form-utils";
 *
 * const loginSchema = z.object({
 *   email: emailSchema,
 *   password: passwordSchema,
 * });
 *
 * // In component:
 * const form = useForm({ resolver: zodResolver(loginSchema) });
 */

import { z } from "zod";

// ─── Reusable Field Schemas ───────────────────────────────────

export const requiredString = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`).trim();

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .trim()
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idSchema = z.string().uuid("Invalid ID format");

// ─── Form Helpers ─────────────────────────────────────────────

/**
 * Extract error message from Zod or API error for display.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    // Zod v4 uses .issues, v3 uses .errors — .issues works in both
    return error.issues.map((issue) => issue.message).join(", ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

/**
 * Create a confirm password refinement for registration forms.
 */
export function withConfirmPassword<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  passwordField = "password",
  confirmField = "confirmPassword",
) {
  return schema.refine(
    (data) => (data as Record<string, unknown>)[passwordField] === (data as Record<string, unknown>)[confirmField],
    {
      message: "Passwords do not match",
      path: [confirmField],
    },
  );
}
