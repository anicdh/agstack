/**
 * BaseCrudService — abstract base for all CRUD services.
 *
 * EXTEND this class for standard CRUD operations.
 * Override methods if custom logic is needed.
 * DO NOT copy-paste CRUD logic per module.
 *
 * @example
 * @Injectable()
 * export class UsersService extends BaseCrudService<User, CreateUserDto, UpdateUserDto> {
 *   constructor(private readonly prisma: PrismaService) {
 *     super(prisma, "user");
 *   }
 *
 *   // Override if custom logic is needed:
 *   async create(dto: CreateUserDto): Promise<User> {
 *     const hashedPassword = await hash(dto.password);
 *     return super.create({ ...dto, password: hashedPassword });
 *   }
 * }
 */

import { Logger, NotFoundException } from "@nestjs/common";
import { PageMeta } from "./dto/base-response.dto";

// Prisma delegate interface — matches Prisma generated client
interface PrismaDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
}

// PrismaClient with index signature for dynamic model access
interface PrismaClientLike {
  [key: string]: PrismaDelegate;
}

export abstract class BaseCrudService<
  TEntity,
  TCreateDto,
  TUpdateDto,
> {
  protected readonly logger: Logger;

  // Internal typed reference for dynamic model delegate access
  // PrismaService extends PrismaClient which has model accessors (e.g. prisma.dummy)
  // but no index signature, so we cast once here for bracket-notation access.
  private readonly _prismaClient: PrismaClientLike;

  constructor(
    prisma: unknown,
    protected readonly modelName: string,
  ) {
    // Cast to indexed type — PrismaService has dynamic model delegates at runtime
    this._prismaClient = prisma as PrismaClientLike;
    this.logger = new Logger(`${this.constructor.name}`);
  }

  private get delegate(): PrismaDelegate {
    return this._prismaClient[this.modelName] as PrismaDelegate;
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    where?: Record<string, unknown>,
    include?: Record<string, boolean>,
  ): Promise<{ data: TEntity[]; meta: PageMeta }> {
    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.delegate.count({ where }),
    ]);

    return {
      data: data as TEntity[],
      meta: new PageMeta({ total, page, limit }),
    };
  }

  async findById(
    id: string,
    include?: Record<string, boolean>,
  ): Promise<TEntity> {
    const entity = await this.delegate.findUnique({
      where: { id },
      include,
    });

    if (!entity) {
      throw new NotFoundException(`${this.modelName} with id ${id} not found`);
    }

    return entity as TEntity;
  }

  async create(dto: TCreateDto): Promise<TEntity> {
    const entity = await this.delegate.create({
      data: dto,
    });

    this.logger.log(`Created ${this.modelName}: ${(entity as { id: string }).id}`);
    return entity as TEntity;
  }

  async update(id: string, dto: TUpdateDto): Promise<TEntity> {
    // Verify exists
    await this.findById(id);

    const entity = await this.delegate.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Updated ${this.modelName}: ${id}`);
    return entity as TEntity;
  }

  async remove(id: string): Promise<TEntity> {
    // Verify exists
    await this.findById(id);

    const entity = await this.delegate.delete({
      where: { id },
    });

    this.logger.log(`Deleted ${this.modelName}: ${id}`);
    return entity as TEntity;
  }
}
