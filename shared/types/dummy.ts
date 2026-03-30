/**
 * Dummy types — shared contract between frontend and API.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new feature types.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN:
 * 1. Define enums as const objects (TypeScript + runtime)
 * 2. Define entity interface with all DB fields
 * 3. Define "Public" type excluding sensitive fields
 * 4. Define Zod schemas for create/update DTOs
 * 5. Infer TypeScript types from Zod schemas
 *
 * API returns these types. Frontend consumes them.
 * When changing fields here, BOTH frontend and API must be updated.
 */

import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────

export const DummyStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type DummyStatus = (typeof DummyStatus)[keyof typeof DummyStatus];

export const DummyCategory = {
  ALPHA: "ALPHA",
  BETA: "BETA",
  GAMMA: "GAMMA",
} as const;

export type DummyCategory = (typeof DummyCategory)[keyof typeof DummyCategory];

// ─── Entity ───────────────────────────────────────────────────

export interface Dummy {
  id: string;
  name: string;
  email: string;
  status: DummyStatus;
  category: DummyCategory;
  description: string | null;
  /** Sensitive field — excluded from public responses */
  secretNote: string;
  createdAt: string;
  updatedAt: string;
}

/** Dummy without sensitive fields — safe for API responses */
export type DummyPublic = Omit<Dummy, "secretNote">;

// ─── DTOs (Zod schemas → inferred types) ──────────────────────

export const createDummySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  status: z.nativeEnum(DummyStatus).default(DummyStatus.ACTIVE),
  category: z.nativeEnum(DummyCategory),
  description: z.string().max(500).trim().nullish(),
  secretNote: z.string().max(200, "Secret note max 200 characters").trim(),
});

export type CreateDummyDto = z.infer<typeof createDummySchema>;

export const updateDummySchema = createDummySchema
  .omit({ secretNote: true })
  .partial();

export type UpdateDummyDto = z.infer<typeof updateDummySchema>;
