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
