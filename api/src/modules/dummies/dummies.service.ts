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
import { PrismaService } from "@/common/prisma.service";
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

  constructor(private readonly prisma: PrismaService) {
    super(prisma, "dummy");
  }

  /**
   * Override create to add email uniqueness check and strip sensitive field.
   *
   * DEMONSTRATES: Custom create logic on top of base class.
   * Your module might override create for unique checks, computed fields,
   * side effects (events, notifications), etc.
   */
  override async create(dto: CreateDummyDto): Promise<DummyPublic> {
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
  override async findById(id: string): Promise<DummyPublic> {
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
