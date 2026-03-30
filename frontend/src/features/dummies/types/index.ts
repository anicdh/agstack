/**
 * Dummy types for frontend — re-export from shared types.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new feature types.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: Feature types file imports from /shared and adds
 * frontend-specific types (form state, UI state, filters, etc.)
 */

// Re-export shared types
export type {
  Dummy,
  DummyPublic,
  CreateDummyDto,
  UpdateDummyDto,
} from "../../../../shared/types/dummy";
export {
  DummyStatus,
  DummyCategory,
  createDummySchema,
  updateDummySchema,
} from "../../../../shared/types/dummy";

// ─── Frontend-specific types ──────────────────────────────────

export interface DummyFilters {
  search?: string;
  status?: string;
  category?: string;
}

export interface DummyListState {
  filters: DummyFilters;
  selectedIds: Set<string>;
}
