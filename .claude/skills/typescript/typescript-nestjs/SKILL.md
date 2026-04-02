---
name: typescript-nestjs
description: >
  Call this skill when building or modifying NestJS backend code: modules, controllers,
  services, DTOs, Prisma queries, guards, interceptors, or middleware.
  Covers module structure, dependency injection, validation, error handling,
  and testing patterns for NestJS + Prisma + PostgreSQL.
invocation: auto
---

# NestJS Backend Patterns

This skill provides NestJS-specific patterns and best practices for building scalable, maintainable backend APIs.

## Module Structure (1 Module = 1 Domain)

### Folder Organization

```
src/modules/[feature-name]/
├── controllers/
│   └── [feature].controller.ts          # HTTP endpoints only
├── services/
│   └── [feature].service.ts             # Business logic, DI
├── dtos/
│   ├── create-[feature].dto.ts
│   ├── update-[feature].dto.ts
│   └── [feature].response.dto.ts
├── entities/
│   └── [feature].entity.ts              # Prisma entity (optional)
├── [feature].module.ts                  # Module definition
└── __tests__/
    ├── [feature].service.spec.ts
    └── [feature].controller.spec.ts
```

### Module Template

```typescript
// [feature].module.ts
import { Module } from '@nestjs/common';
import { [Feature]Service } from './services/[feature].service';
import { [Feature]Controller } from './controllers/[feature].controller';

@Module({
  imports: [],  // Other modules
  controllers: [[Feature]Controller],
  providers: [[Feature]Service],
  exports: [[Feature]Service],  // If needed by other modules
})
export class [Feature]Module {}
```

### Controller: Input/Output Only

```typescript
// controllers/[feature].controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { [Feature]Service } from '../services/[feature].service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Create[Feature]Dto } from '../dtos/create-[feature].dto';
import { [Feature]ResponseDto } from '../dtos/[feature].response.dto';
import { BaseResponseDto } from '@/common/dto/base-response.dto';

@Controller('api/v1/features')
export class [Feature]Controller {
  constructor(private readonly service: [Feature]Service) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: Create[Feature]Dto,
  ): Promise<BaseResponseDto<[Feature]ResponseDto>> {
    const result = await this.service.create(dto);
    return BaseResponseDto.created(result);
  }

  @Get()
  async findAll(): Promise<BaseResponseDto<[Feature]ResponseDto[]>> {
    const result = await this.service.findAll();
    return BaseResponseDto.ok(result);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<BaseResponseDto<[Feature]ResponseDto>> {
    const result = await this.service.findOne(id);
    return BaseResponseDto.ok(result);
  }
}
```

**Key Rules:**
- Controller ONLY receives, validates, and returns
- NO business logic in controller
- ALL HTTP operations delegated to service
- Always use `@UseGuards(JwtAuthGuard)` for protected routes
- Always wrap response in `BaseResponseDto`

### Service: Business Logic + DI

```typescript
// services/[feature].service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { Create[Feature]Dto } from '../dtos/create-[feature].dto';
import { Update[Feature]Dto } from '../dtos/update-[feature].dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class [Feature]Service {
  private logger = new Logger([Feature]Service.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: Create[Feature]Dto) {
    this.logger.debug(`Creating feature with data: ${JSON.stringify(dto)}`);

    try {
      const result = await this.prisma.feature.create({
        data: {
          name: dto.name,
          description: dto.description,
          // ...
        },
        // ALWAYS explicit select to avoid exposing internal fields
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
      });

      this.logger.log(`Feature created: ${result.id}`);
      return result;
    } catch (error) {
      if (error.code === 'P2002') {
        // Prisma unique constraint error
        throw new ConflictException('Feature already exists');
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const result = await this.prisma.feature.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    if (!result) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }

    return result;
  }

  async update(id: string, dto: Update[Feature]Dto) {
    // Verify exists first
    await this.findOne(id);

    return this.prisma.feature.update({
      where: { id },
      data: {
        ...dto,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    try {
      return await this.prisma.feature.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma record not found error
        throw new NotFoundException(`Feature with ID ${id} not found`);
      }
      throw error;
    }
  }
}
```

**Key Rules:**
- ONLY service contains business logic
- Use `PrismaService` injected via constructor
- ALWAYS use explicit `select` or `include`
- Handle Prisma errors (P2002, P2025, etc.)
- Use `Logger` injected, NEVER `console.log`
- Return specific HTTP exceptions, not generic `Error`

---

## DTO Patterns (Data Transfer Objects)

### DTO Best Practices

DTOs handle:
1. Input validation via `class-validator`
2. Type transformation via `class-transformer`
3. Response shaping (only expose needed fields)
4. Separate Create/Update/Response DTOs

### CreateDto Template

```typescript
// dtos/create-[feature].dto.ts
import { IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class Create[Feature]Dto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim?.())
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | undefined;

  @IsOptional()
  @IsUUID()
  parentId?: string | undefined;
}
```

**Key Rules:**
- EVERY field must have validation decorator
- Use `@IsOptional()` for optional fields, then add `| undefined` to type
- Use `@Transform` for data cleaning (trim, lowercase, etc.)
- Custom validators: `@IsEmail()`, `@IsPhoneNumber()`, etc.
- Nested objects: `@ValidateNested()` + `@Type(() => NestedDto)`

### UpdateDto Template (extends PartialType)

```typescript
// dtos/update-[feature].dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { Create[Feature]Dto } from './create-[feature].dto';

export class Update[Feature]Dto extends PartialType(Create[Feature]Dto) {}
```

**Why PartialType:**
- Automatically makes all fields optional
- Reuses validation from CreateDto
- Single source of truth for validation rules

### ResponseDto (Explicit Output Shape)

```typescript
// dtos/[feature].response.dto.ts
import { Expose, Exclude } from 'class-transformer';

export class [Feature]ResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string | undefined;

  @Expose()
  createdAt: Date;

  // Internal fields not exposed
  @Exclude()
  internalField?: string | undefined;
}
```

### Nested Validation Example

```typescript
import { ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  @IsArray()
  addresses: AddressDto[];
}
```

---

## Prisma Patterns

### PrismaService Injection

```typescript
// Always inject, never import PrismaClient directly
constructor(private prisma: PrismaService) {}

// Use with explicit select/include
const user = await this.prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    profile: {
      select: {
        firstName: true,
        lastName: true,
      },
    },
  },
});
```

### Explicit Select to Avoid N+1

```typescript
// WRONG: No select, returns all fields including passwords, internal data
const users = await this.prisma.user.findMany();

// CORRECT: Explicit select
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    createdAt: true,
  },
});

// CORRECT: With relations
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    posts: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});
```

### Multi-Write Transactions

```typescript
// Use $transaction for consistency
const result = await this.prisma.$transaction(async (tx) => {
  // Create parent
  const parent = await tx.feature.create({
    data: { name: 'Parent' },
    select: { id: true },
  });

  // Create child
  const child = await tx.childFeature.create({
    data: {
      name: 'Child',
      parentId: parent.id,
    },
  });

  return { parent, child };
});
```

### Cursor Pagination Pattern

```typescript
async findMany(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.prisma.feature.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.feature.count(),
  ]);

  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}
```

### Prisma Error Handling

```typescript
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

try {
  const result = await this.prisma.feature.create({ data });
  return result;
} catch (error) {
  // Unique constraint violation
  if (error.code === 'P2002') {
    throw new ConflictException(`${error.meta.target[0]} already exists`);
  }

  // Record not found (on update/delete)
  if (error.code === 'P2025') {
    throw new NotFoundException('Record not found');
  }

  // Invalid relation
  if (error.code === 'P2003') {
    throw new BadRequestException('Invalid relation ID');
  }

  throw error;
}
```

**Common Prisma Errors:**
- `P2002` - Unique constraint violation
- `P2003` - Foreign key constraint violation
- `P2025` - Record not found (on update/delete)
- `P2001` - Record not found (on update with create)

---

## Authentication & Authorization

### JWT Auth Guard

```typescript
// Always use on protected routes
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreateDto) {
  // ...
}
```

### Get Current User

```typescript
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/types/jwt-payload';

@Get('me')
@UseGuards(JwtAuthGuard)
async getCurrentUser(@CurrentUser() user: JwtPayload) {
  // user.id, user.email, etc.
  return { id: user.id, email: user.email };
}
```

### Role-Based Access Control

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
async create(@Body() dto: CreateDto) {
  // Only admin or moderator
}
```

---

## Error Handling

### Specific HTTP Exceptions

```typescript
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';

// Use specific exceptions, NEVER throw generic Error
throw new NotFoundException('Feature not found');
throw new ConflictException('Email already exists');
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Invalid credentials');
throw new ForbiddenException('Insufficient permissions');
```

### Global Exception Filter

```typescript
// Configured in app.module.ts
app.useGlobalFilters(new HttpExceptionFilter());

// Filter automatically handles HTTP exceptions and formats response
// Output: { statusCode, error, message }
```

**Key Rules:**
- NEVER throw generic `Error`
- ALWAYS use specific `HttpException` subclasses
- Global filter handles formatting
- Log errors with context, don't expose internals to client

---

## Testing Patterns

### Unit Test Template (Mock PrismaService)

```typescript
// [feature].service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { [Feature]Service } from './[feature].service';
import { PrismaService } from '@/common/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('[Feature]Service', () => {
  let service: [Feature]Service;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        [Feature]Service,
        {
          provide: PrismaService,
          useValue: {
            feature: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get([Feature]Service);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create a feature', async () => {
      const dto = { name: 'Test', description: 'Test feature' };
      const expected = { id: '1', ...dto, createdAt: new Date() };

      jest.spyOn(prisma.feature, 'create').mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(result).toEqual(expected);
      expect(prisma.feature.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
    });

    it('should throw ConflictException on unique constraint', async () => {
      const dto = { name: 'Test' };
      jest.spyOn(prisma.feature, 'create').mockRejectedValue({
        code: 'P2002',
        meta: { target: ['name'] },
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(prisma.feature, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });

    it('should return feature if found', async () => {
      const expected = { id: '1', name: 'Test' };
      jest.spyOn(prisma.feature, 'findUnique').mockResolvedValue(expected);

      const result = await service.findOne('1');

      expect(result).toEqual(expected);
    });
  });
});
```

### Integration Test Template

```typescript
// [feature].controller.spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { [Feature]Module } from './[feature].module';
import { PrismaService } from '@/common/prisma.service';

describe('[Feature] (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [[Feature]Module],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.feature.deleteMany(); // Cleanup
  });

  describe('POST /api/v1/features', () => {
    it('should create a feature', () => {
      const dto = { name: 'Test', description: 'Test feature' };

      return request(app.getHttpServer())
        .post('/api/v1/features')
        .send(dto)
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.name).toBe(dto.name);
        });
    });

    it('should reject invalid input', () => {
      const dto = { name: '' }; // Invalid: empty name

      return request(app.getHttpServer())
        .post('/api/v1/features')
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /api/v1/features/:id', () => {
    it('should return 404 if not found', () => {
      return request(app.getHttpServer())
        .get('/api/v1/features/nonexistent')
        .expect(404);
    });

    it('should return feature if found', async () => {
      const created = await prisma.feature.create({
        data: { name: 'Test', description: 'Test feature' },
      });

      return request(app.getHttpServer())
        .get(`/api/v1/features/${created.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(created.id);
        });
    });
  });
});
```

---

## Review Checklist

Before submitting code review:

### Structure
- [ ] Controllers have NO business logic (only receive/return)?
- [ ] Services have ALL business logic and dependency injection?
- [ ] DTOs have validation decorators on EVERY field?
- [ ] Separate CreateDto, UpdateDto (PartialType), ResponseDto?

### Prisma & Database
- [ ] All queries use explicit `select` or `include`?
- [ ] No N+1 queries (relations fetched in single query)?
- [ ] Multi-write operations use `$transaction`?
- [ ] Prisma errors handled (P2002, P2025, etc.)?

### Response Format
- [ ] All responses wrapped in `BaseResponseDto`?
- [ ] Only intended fields returned (ResponseDto)?
- [ ] No internal fields exposed to client?

### Authentication & Authorization
- [ ] Protected routes use `@UseGuards(JwtAuthGuard)`?
- [ ] Role-based routes use `@Roles()` decorator?
- [ ] Current user injected via `@CurrentUser()` decorator?

### Error Handling
- [ ] No generic `Error` thrown?
- [ ] Specific HTTP exceptions used?
- [ ] Prisma errors caught and transformed?
- [ ] Logged with context, not sensitive data?

### Testing
- [ ] Unit tests mock PrismaService?
- [ ] Happy path tested?
- [ ] Error cases tested?
- [ ] All tests pass (`npm run test`)?

### Code Quality
- [ ] No `console.log` (use `Logger`)?
- [ ] Functions < 50 lines?
- [ ] Descriptive variable/function names?
- [ ] No commented-out code?
- [ ] No TODO/FIXME (create task instead)?

---

## Common Patterns Reference

### Reuse Code Map

| Need | Use | Location | Don't Create |
|------|-----|----------|--------------|
| Base response format | `BaseResponseDto.ok/paginated/created` | `@/common/dto/base-response.dto.ts` | Custom response wrappers |
| Pagination | `PaginationDto` + `use-paginated-query` | `@/common/dto/pagination.dto.ts` | Parse page/limit yourself |
| Current user | `@CurrentUser()` decorator | `@/common/decorators/current-user.decorator.ts` | Extract from request manually |
| JWT guard | `@UseGuards(JwtAuthGuard)` | `@/common/guards/jwt-auth.guard.ts` | Custom auth guards |
| HTTP errors | `NotFoundException`, `ConflictException`, etc. | `@nestjs/common` | Generic Error |
| Prisma service | `PrismaService` injected | `@/common/prisma.service.ts` | Direct PrismaClient |
| Logger | `Logger` injected | `@nestjs/common` | `console.log` |
| Validation | class-validator decorators | DTOs | Manual validation |
| Error filter | Global `HttpExceptionFilter` | Configured in app.module.ts | Per-route error handling |
