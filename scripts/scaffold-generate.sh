#!/usr/bin/env bash
#
# scaffold:generate — Regenerate the Dummies reference code for the boilerplate.
#
# Usage: npm run scaffold:generate
#   or:  bash scripts/scaffold-generate.sh
#
# Use this if you accidentally deleted the Dummies module and need it back
# as a reference for coding patterns.
#
# This script creates:
# 1. Dummies shared types (Zod schemas, enums, entity types)
# 2. Dummies API module (service, controller, DTOs, tests)
# 3. Dummies frontend feature (types, queries, components, tests)
# 4. Dummies query keys in query-keys.ts
# 5. Dummies references in ARCHITECTURE.md and CLAUDE.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== scaffold:generate — Creating Dummies reference code ==="
echo ""

# ─── Safety check ────────────────────────────────────────────────

if [ -d "$PROJECT_ROOT/api/src/modules/dummies" ] || [ -d "$PROJECT_ROOT/frontend/src/features/dummies" ]; then
  echo "WARNING: Dummies module already exists."
  read -rp "Overwrite? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ─── Helper ──────────────────────────────────────────────────────

write_file() {
  local filepath="$1"
  local dir
  dir="$(dirname "$filepath")"
  mkdir -p "$dir"
  cat > "$filepath"
  echo "  Created: $filepath"
}

# ═══════════════════════════════════════════════════════════════════
# 1. SHARED TYPES
# ═══════════════════════════════════════════════════════════════════

echo "Creating shared types..."

write_file "$PROJECT_ROOT/shared/types/dummy.ts" << 'FILEOF'
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
FILEOF

# ═══════════════════════════════════════════════════════════════════
# 2. API MODULE
# ═══════════════════════════════════════════════════════════════════

echo "Creating API module..."

# --- CreateDummyDto ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/dto/create-dummy.dto.ts" << 'FILEOF'
/**
 * CreateDummyDto — validates POST /dummies request body.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: one DTO class per operation. Use class-validator decorators.
 * Mirrors Zod schema in /shared/types/dummy.ts.
 */

import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum DummyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum DummyCategory {
  ALPHA = "ALPHA",
  BETA = "BETA",
  GAMMA = "GAMMA",
}

export class CreateDummyDto {
  @ApiProperty({ example: "Dummy Alpha" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: "dummy@example.com" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: DummyStatus, default: DummyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(DummyStatus)
  status?: DummyStatus = DummyStatus.ACTIVE;

  @ApiProperty({ enum: DummyCategory })
  @IsEnum(DummyCategory)
  category: DummyCategory;

  @ApiPropertyOptional({ example: "A sample dummy entry for demonstration" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ example: "This is a secret note" })
  @IsString()
  @MaxLength(200)
  secretNote: string;
}
FILEOF

# --- UpdateDummyDto ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/dto/update-dummy.dto.ts" << 'FILEOF'
/**
 * UpdateDummyDto — validates PATCH /dummies/:id request body.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: PartialType of CreateDto, minus sensitive fields (secretNote).
 * Only fields present in the request body will be updated.
 */

import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateDummyDto } from "./create-dummy.dto";

export class UpdateDummyDto extends PartialType(
  OmitType(CreateDummyDto, ["secretNote"] as const),
) {}
FILEOF

# --- DummiesService ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/dummies.service.ts" << 'FILEOF'
/**
 * DummiesService — extends BaseCrudService with custom logic.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new modules.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: Only override methods that need custom behavior.
 * Standard CRUD (findAll, findById, update, remove) comes from base class.
 */

import {
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { BaseCrudService } from "@/common/base-crud.service";
import type { CreateDummyDto } from "./dto/create-dummy.dto";
import type { UpdateDummyDto } from "./dto/update-dummy.dto";

// Type representing the Dummy entity from Prisma
interface Dummy {
  id: string;
  name: string;
  email: string;
  status: string;
  category: string;
  description: string | null;
  secretNote: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type for public dummy data (no secretNote)
type DummyPublic = Omit<Dummy, "secretNote">;

@Injectable()
export class DummiesService extends BaseCrudService<DummyPublic, CreateDummyDto, UpdateDummyDto> {
  private readonly serviceLogger = new Logger(DummiesService.name);

  constructor(private readonly prisma: any) {
    // Pass Prisma client and model name to base class
    super(prisma, "dummy");
  }

  /**
   * Override create to add email uniqueness check and strip sensitive field.
   *
   * DEMONSTRATES: Custom create logic on top of base class.
   * Your module might override create for unique checks, computed fields,
   * side effects (events, notifications), etc.
   */
  async create(dto: CreateDummyDto): Promise<DummyPublic> {
    // Check email uniqueness
    const existing = await this.prisma.dummy.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`Dummy with email ${dto.email} already exists`);
    }

    const dummy = await this.prisma.dummy.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        status: dto.status ?? "ACTIVE",
        category: dto.category,
        description: dto.description ?? null,
        secretNote: dto.secretNote,
      },
    });

    this.serviceLogger.log(`Created dummy: ${dummy.id} (${dummy.email})`);

    return this.excludeSecret(dummy);
  }

  /**
   * Override findById to exclude sensitive field from response.
   *
   * DEMONSTRATES: Post-processing query results to strip sensitive data.
   */
  async findById(id: string): Promise<DummyPublic> {
    const dummy = await super.findById(id);
    return this.excludeSecret(dummy as unknown as Dummy);
  }

  /**
   * Find dummy by email — example of a custom query method.
   *
   * DEMONSTRATES: Adding domain-specific query beyond standard CRUD.
   * Returns full entity including secretNote (for internal use).
   */
  async findByEmail(email: string): Promise<Dummy | null> {
    return this.prisma.dummy.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find all dummies by category — another custom query example.
   *
   * DEMONSTRATES: Filtered queries using Prisma where clause.
   */
  async findByCategory(category: string): Promise<DummyPublic[]> {
    const dummies: Dummy[] = await this.prisma.dummy.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
    });

    return dummies.map((d) => this.excludeSecret(d));
  }

  /**
   * Strip secretNote from entity.
   * Private helper — all public methods returning data should use this.
   *
   * DEMONSTRATES: Sensitive field exclusion pattern.
   * In a real module this could be password, API key, token, etc.
   */
  private excludeSecret(dummy: Dummy): DummyPublic {
    const { secretNote: _, ...publicDummy } = dummy;
    return publicDummy;
  }
}
FILEOF

# --- DummiesController ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/dummies.controller.ts" << 'FILEOF'
/**
 * DummiesController — extends BaseCrudController with custom endpoints.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new controllers.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN:
 * - Standard CRUD endpoints (GET /, GET /:id, POST, PATCH, DELETE) from base class.
 * - Custom endpoints added below the base methods.
 * - Auth guards on all endpoints (add when auth module is ready).
 */

import {
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BaseCrudController } from "@/common/base-crud.controller";
import { DummiesService } from "./dummies.service";
import type { CreateDummyDto } from "./dto/create-dummy.dto";
import type { UpdateDummyDto } from "./dto/update-dummy.dto";
import { BaseResponseDto } from "@/common/dto/base-response.dto";

// Type representing public dummy data
interface DummyPublic {
  id: string;
  name: string;
  email: string;
  status: string;
  category: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Controller("dummies")
@ApiTags("Dummies")
// @UseGuards(JwtAuthGuard)  // Uncomment when auth module is ready
// @ApiBearerAuth()
export class DummiesController extends BaseCrudController<DummyPublic, CreateDummyDto, UpdateDummyDto> {
  constructor(private readonly dummiesService: DummiesService) {
    super(dummiesService);
  }

  // ─── Custom endpoints (beyond standard CRUD) ──────────────

  /**
   * DEMONSTRATES: Adding custom filtered endpoint alongside base CRUD.
   * Base class already provides GET / (all with pagination).
   * This endpoint adds category-specific filtering.
   */
  @Get("by-category/:category")
  @ApiOperation({ summary: "Get all dummies in a specific category" })
  async findByCategory(
    @Param("category") category: string,
  ): Promise<BaseResponseDto<DummyPublic[]>> {
    const dummies = await this.dummiesService.findByCategory(category);
    return BaseResponseDto.ok(dummies);
  }
}
FILEOF

# --- DummiesModule ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/dummies.module.ts" << 'FILEOF'
/**
 * DummiesModule — NestJS module for the reference Dummies feature.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new modules.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: One module per feature domain. Module wires controller + service + dependencies.
 * Register in AppModule imports.
 */

import { Module } from "@nestjs/common";
import { DummiesController } from "./dummies.controller";
import { DummiesService } from "./dummies.service";

@Module({
  controllers: [DummiesController],
  providers: [DummiesService],
  exports: [DummiesService], // Export if other modules need it
})
export class DummiesModule {}
FILEOF

# --- DummiesService Tests ---
write_file "$PROJECT_ROOT/api/src/modules/dummies/__tests__/dummies.service.spec.ts" << 'FILEOF'
/**
 * DummiesService unit tests — REFERENCE test file.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when writing tests for new modules.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN for testing services:
 * 1. Mock Prisma delegates using createMockPrisma from test-utils
 * 2. Test happy path for each public method
 * 3. Test at least 1 error case per method
 * 4. Never test private methods directly — test through public API
 *
 * New module tests should follow this pattern exactly.
 */

import { ConflictException, NotFoundException } from "@nestjs/common";
import { DummiesService } from "../dummies.service";
import { createMockPrisma } from "../../../../test/test-utils";

describe("DummiesService", () => {
  let service: DummiesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma(["dummy"]);
    service = new DummiesService(mockPrisma);
  });

  // ─── create ───────────────────────────────────────────────

  describe("create", () => {
    const createDto = {
      name: "Dummy Alpha",
      email: "dummy@example.com",
      status: "ACTIVE" as const,
      category: "ALPHA" as const,
      description: "A test dummy",
      secretNote: "top-secret-note",
    };

    it("should create a dummy and return without secretNote", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue(null);
      (mockPrisma.dummy as any).create.mockResolvedValue({
        id: "dummy-1",
        name: "Dummy Alpha",
        email: "dummy@example.com",
        status: "ACTIVE",
        category: "ALPHA",
        description: "A test dummy",
        secretNote: "top-secret-note",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result).toHaveProperty("id", "dummy-1");
      expect(result).toHaveProperty("email", "dummy@example.com");
      expect(result).toHaveProperty("category", "ALPHA");
      expect(result).not.toHaveProperty("secretNote");
    });

    it("should lowercase email before saving", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue(null);
      (mockPrisma.dummy as any).create.mockResolvedValue({
        id: "dummy-1",
        name: "Dummy Alpha",
        email: "dummy@example.com",
        status: "ACTIVE",
        category: "ALPHA",
        description: null,
        secretNote: "top-secret-note",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create({ ...createDto, email: "DUMMY@EXAMPLE.COM" });

      expect((mockPrisma.dummy as any).create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: "dummy@example.com" }),
      });
    });

    it("should throw ConflictException if email already exists", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue({ id: "existing" });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── findById ─────────────────────────────────────────────

  describe("findById", () => {
    it("should return dummy without secretNote", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue({
        id: "dummy-1",
        name: "Dummy Alpha",
        email: "dummy@example.com",
        status: "ACTIVE",
        category: "ALPHA",
        description: "A test dummy",
        secretNote: "top-secret-note",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findById("dummy-1");

      expect(result).toHaveProperty("id", "dummy-1");
      expect(result).not.toHaveProperty("secretNote");
    });

    it("should throw NotFoundException if dummy does not exist", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByEmail ──────────────────────────────────────────

  describe("findByEmail", () => {
    it("should return full entity including secretNote", async () => {
      const fullDummy = {
        id: "dummy-1",
        name: "Dummy Alpha",
        email: "dummy@example.com",
        status: "ACTIVE",
        category: "ALPHA",
        description: null,
        secretNote: "top-secret-note",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.dummy as any).findUnique.mockResolvedValue(fullDummy);

      const result = await service.findByEmail("dummy@example.com");

      expect(result).toHaveProperty("secretNote");
    });

    it("should return null if not found", async () => {
      (mockPrisma.dummy as any).findUnique.mockResolvedValue(null);

      const result = await service.findByEmail("unknown@example.com");

      expect(result).toBeNull();
    });
  });

  // ─── findByCategory ───────────────────────────────────────

  describe("findByCategory", () => {
    it("should return dummies filtered by category without secretNote", async () => {
      (mockPrisma.dummy as any).findMany.mockResolvedValue([
        {
          id: "dummy-1",
          name: "Alpha One",
          email: "a1@example.com",
          status: "ACTIVE",
          category: "ALPHA",
          description: null,
          secretNote: "secret-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "dummy-2",
          name: "Alpha Two",
          email: "a2@example.com",
          status: "ACTIVE",
          category: "ALPHA",
          description: "Second alpha",
          secretNote: "secret-2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const results = await service.findByCategory("ALPHA");

      expect(results).toHaveLength(2);
      expect(results[0]).not.toHaveProperty("secretNote");
      expect(results[1]).not.toHaveProperty("secretNote");
    });

    it("should return empty array if no dummies in category", async () => {
      (mockPrisma.dummy as any).findMany.mockResolvedValue([]);

      const results = await service.findByCategory("GAMMA");

      expect(results).toEqual([]);
    });
  });
});
FILEOF

# ═══════════════════════════════════════════════════════════════════
# 3. FRONTEND FEATURE
# ═══════════════════════════════════════════════════════════════════

echo "Creating frontend feature..."

# --- Types ---
write_file "$PROJECT_ROOT/frontend/src/features/dummies/types/index.ts" << 'FILEOF'
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
FILEOF

# --- Queries ---
write_file "$PROJECT_ROOT/frontend/src/features/dummies/queries/use-dummies.ts" << 'FILEOF'
/**
 * Dummy queries — React Query hooks for dummy API calls.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating queries for new features.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN:
 * - Use queryKeys from @/lib/query-keys.ts (never hardcode keys)
 * - Use usePaginatedQuery for list endpoints
 * - Use useApiMutation for create/update/delete
 * - Use api client for raw fetch (never use fetch() directly)
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type { DummyPublic, CreateDummyDto, UpdateDummyDto, DummyFilters } from "../types";

// ─── List (paginated) ─────────────────────────────────────────

export function useDummies(filters?: DummyFilters) {
  return usePaginatedQuery<DummyPublic>({
    queryKey: queryKeys.dummies.list(filters),
    path: "/dummies",
    limit: 20,
    extraParams: filters,
  });
}

// ─── Detail ───────────────────────────────────────────────────

export function useDummy(id: string) {
  return useQuery({
    queryKey: queryKeys.dummies.detail(id),
    queryFn: () => api.get<DummyPublic>(`/dummies/${id}`),
    enabled: Boolean(id),
  });
}

// ─── Create ───────────────────────────────────────────────────

export function useCreateDummy() {
  return useApiMutation<DummyPublic, CreateDummyDto>({
    mutationFn: (data) => api.post<DummyPublic>("/dummies", data),
    invalidateKeys: [queryKeys.dummies.all],
    successMessage: "Dummy created successfully",
  });
}

// ─── Update ───────────────────────────────────────────────────

export function useUpdateDummy(id: string) {
  return useApiMutation<DummyPublic, UpdateDummyDto>({
    mutationFn: (data) => api.patch<DummyPublic>(`/dummies/${id}`, data),
    invalidateKeys: [queryKeys.dummies.all, queryKeys.dummies.detail(id)],
    successMessage: "Dummy updated successfully",
  });
}

// ─── Delete ───────────────────────────────────────────────────

export function useDeleteDummy() {
  return useApiMutation<DummyPublic, string>({
    mutationFn: (id) => api.delete<DummyPublic>(`/dummies/${id}`),
    invalidateKeys: [queryKeys.dummies.all],
    successMessage: "Dummy deleted successfully",
  });
}
FILEOF

# --- DummyList Component ---
write_file "$PROJECT_ROOT/frontend/src/features/dummies/components/dummy-list.tsx" << 'FILEOF'
/**
 * DummyList — paginated table of dummies with search and category filter.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new list components.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN for list components:
 * 1. Use usePaginatedQuery (from shared hooks) for data fetching
 * 2. Early return for loading/error states
 * 3. Destructure props with TypeScript interface
 * 4. Tailwind only for styling, mobile-first responsive
 * 5. Extract sub-components for table rows, skeletons, etc.
 */

import { useState } from "react";
import { useDummies, useDeleteDummy } from "../queries/use-dummies";
import { useDebounce } from "@/hooks/use-debounce";
import type { DummyPublic, DummyFilters } from "../types";
import { DummyCategory } from "../types";

interface DummyListProps {
  onEdit: (dummy: DummyPublic) => void;
}

export function DummyList({ onEdit }: DummyListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);

  const filters: DummyFilters = {
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
  };

  const {
    data: dummies,
    meta,
    page,
    nextPage,
    prevPage,
    isLoading,
    isError,
    error,
    hasNextPage,
    hasPrevPage,
  } = useDummies(filters);

  const deleteDummy = useDeleteDummy();

  // ─── Early returns for loading/error ──────────────────────

  if (isLoading) {
    return <DummyListSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm text-red-800">
          Failed to load dummies: {error?.message ?? "Unknown error"}
        </p>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search dummies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm
                     placeholder:text-gray-400 focus:border-blue-500 focus:outline-none
                     focus:ring-1 focus:ring-blue-500"
          aria-label="Search dummies"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {Object.values(DummyCategory).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {meta && (
          <span className="text-sm text-gray-500">
            {meta.total} item{meta.total !== 1 ? "s" : ""} total
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {dummies.map((dummy) => (
              <DummyRow
                key={dummy.id}
                dummy={dummy}
                onEdit={() => onEdit(dummy)}
                onDelete={() => deleteDummy.mutate(dummy.id)}
                isDeleting={deleteDummy.isPending}
              />
            ))}
            {dummies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No dummies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={prevPage}
              disabled={!hasPrevPage}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={nextPage}
              disabled={!hasNextPage}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

interface DummyRowProps {
  dummy: DummyPublic;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-yellow-100 text-yellow-800",
};

const CATEGORY_STYLES: Record<string, string> = {
  ALPHA: "bg-blue-100 text-blue-800",
  BETA: "bg-purple-100 text-purple-800",
  GAMMA: "bg-orange-100 text-orange-800",
};

function DummyRow({ dummy, onEdit, onDelete, isDeleting }: DummyRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
        {dummy.name}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
        {dummy.email}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLES[dummy.status] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {dummy.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            CATEGORY_STYLES[dummy.category] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {dummy.category}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <button
          type="button"
          onClick={onEdit}
          className="mr-2 text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────

function DummyListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dummies">
      <div className="flex gap-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-12 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
FILEOF

# --- DummyList Tests ---
write_file "$PROJECT_ROOT/frontend/src/features/dummies/components/dummy-list.test.tsx" << 'FILEOF'
/**
 * DummyList component tests — REFERENCE test file.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when writing tests for new components.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN for component tests:
 * 1. Use render from @/test/test-utils (includes QueryClientProvider)
 * 2. Mock API calls via vi.mock on the queries file
 * 3. Test: loading state, data rendering, empty state, error state
 * 4. Test user interactions (search, pagination, actions)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DummyList } from "./dummy-list";

// Mock the query hooks
const mockUseDummies = vi.fn();
const mockUseDeleteDummy = vi.fn();

vi.mock("../queries/use-dummies", () => ({
  useDummies: (...args: unknown[]) => mockUseDummies(...args),
  useDeleteDummy: () => mockUseDeleteDummy(),
}));

const mockOnEdit = vi.fn();

const sampleDummies = [
  {
    id: "dummy-1",
    name: "Alpha One",
    email: "alpha1@example.com",
    status: "ACTIVE",
    category: "ALPHA",
    description: "First alpha dummy",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "dummy-2",
    name: "Beta Two",
    email: "beta2@example.com",
    status: "INACTIVE",
    category: "BETA",
    description: null,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

describe("DummyList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDeleteDummy.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("renders loading skeleton when data is loading", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: undefined,
      page: 1,
      isLoading: true,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByLabelText("Loading dummies")).toBeInTheDocument();
  });

  it("renders dummy data in table rows", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("Alpha One")).toBeInTheDocument();
    expect(screen.getByText("beta2@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 items total")).toBeInTheDocument();
  });

  it("renders status and category badges correctly", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("INACTIVE")).toBeInTheDocument();
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("renders empty state when no dummies found", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("No dummies found.")).toBeInTheDocument();
  });

  it("renders error state with message", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: undefined,
      page: 1,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it("renders category filter dropdown", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
  });
});
FILEOF

# ─── 4. Restore query-keys if missing ───────────────────────────

QUERY_KEYS="$PROJECT_ROOT/frontend/src/lib/query-keys.ts"
if [ -f "$QUERY_KEYS" ]; then
  if ! grep -q "dummies" "$QUERY_KEYS"; then
    echo "Adding dummies to query-keys.ts..."
    # Insert dummies block before the comment about adding new features
    sed -i '/Add new features following this pattern/i \
  // ─── Reference feature (Dummies) ─────────────────────────────\
  // Run `npm run scaffold:clean` to remove. Use as pattern for new features.\
  dummies: {\
    all: ["dummies"] as const,\
    list: (params?: Record<string, unknown>) => ["dummies", "list", params] as const,\
    detail: (id: string) => ["dummies", "detail", id] as const,\
  },\
' "$QUERY_KEYS"
    echo "  Updated: $QUERY_KEYS"
  else
    echo "  query-keys.ts already has dummies — skipped"
  fi
fi

# ─── Done ────────────────────────────────────────────────────────

echo ""
echo "=== Done! Dummies reference code has been generated. ==="
echo ""
echo "Files created:"
echo "  shared/types/dummy.ts"
echo "  api/src/modules/dummies/ (service, controller, module, DTOs, tests)"
echo "  frontend/src/features/dummies/ (types, queries, components, tests)"
echo ""
echo "Remember to also restore the Reference Feature table in CLAUDE.md if needed."
