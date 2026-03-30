/**
 * Test utilities for NestJS — shared helpers for unit and e2e tests.
 *
 * USE these helpers instead of manually creating testing modules.
 *
 * @example
 * const { service, module } = await createTestingModule(UsersService, {
 *   providers: [{ provide: PrismaService, useValue: mockPrisma }],
 * });
 */

import { Test, type TestingModule } from "@nestjs/testing";
import type { Type } from "@nestjs/common";

interface TestModuleOptions {
  providers?: Array<{
    provide: Type | string | symbol;
    useValue: unknown;
  }>;
  imports?: Type[];
}

/**
 * Create a NestJS testing module with a target service and mock providers.
 */
export async function createTestingModule<T>(
  ServiceClass: Type<T>,
  options: TestModuleOptions = {},
): Promise<{ service: T; module: TestingModule }> {
  const moduleBuilder = Test.createTestingModule({
    providers: [ServiceClass, ...(options.providers ?? [])],
    imports: options.imports,
  });

  const module = await moduleBuilder.compile();
  const service = module.get<T>(ServiceClass);

  return { service, module };
}

/**
 * Create a mock Prisma delegate for testing services that use BaseCrudService.
 * Returns a mock object with all standard Prisma methods.
 */
export function createMockPrismaDelegate() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }) => ({ id: "test-id", ...data })),
    update: jest.fn().mockImplementation(({ data, where }) => ({ ...where, ...data })),
    delete: jest.fn().mockImplementation(({ where }) => where),
    count: jest.fn().mockResolvedValue(0),
  };
}

/**
 * Create a mock PrismaService with delegates for specified models.
 */
export function createMockPrisma(modelNames: string[]) {
  const prisma: Record<string, unknown> = {
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  for (const name of modelNames) {
    prisma[name] = createMockPrismaDelegate();
  }

  return prisma;
}
