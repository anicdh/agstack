# NestJS Gotchas

Common NestJS mistakes and how to avoid them.

## Business Logic in Controller

### Wrong: Logic in Controller

```typescript
// WRONG: Controller with business logic
@Post()
async create(@Body() dto: CreateUserDto) {
  // Logic here!
  if (dto.email.includes('@')) {  // WRONG: validation in controller
    const user = { ...dto, id: Math.random() };
    save(user);  // WRONG: persistence in controller
    return user;
  }
}
```

### Correct: Logic in Service

```typescript
// CORRECT: Controller delegates to service
@Post()
async create(
  @Body() dto: CreateUserDto,
): Promise<BaseResponseDto<UserResponseDto>> {
  const result = await this.service.create(dto);
  return BaseResponseDto.created(result);
}

// Service has all logic
@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    // Validation already done by class-validator
    const user = await this.prisma.user.create({
      data: dto,
      select: { id: true, email: true, name: true },
    });
    return user;
  }
}
```

---

## Missing Validation Decorators on DTO Fields

### Wrong: No Decorators

```typescript
// WRONG: No validation
export class CreateUserDto {
  email: string;  // Can be anything!
  age: number;    // Can be negative!
  password: string;  // No min length!
}
```

### Correct: Every Field Validated

```typescript
// CORRECT: Every field has validation
import { IsEmail, IsString, MinLength, IsInt, Min, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number | undefined;
}
```

**Validation Decorators Checklist:**
- String fields: `@IsString()`, `@MinLength()`, `@MaxLength()`
- Email: `@IsEmail()`
- Number: `@IsInt()`, `@IsNumber()`, `@Min()`, `@Max()`
- UUID: `@IsUUID()`
- Boolean: `@IsBoolean()`
- Array: `@IsArray()`, `@ArrayMinSize()`, `@ArrayMaxSize()`
- Optional: `@IsOptional()` THEN `| undefined` in type
- Nested objects: `@ValidateNested()`, `@Type(() => NestedDto)`
- Enum: `@IsEnum(MyEnum)`
- Dates: `@IsISO8601()`, `@IsDate()`

---

## Returning Raw Prisma Objects

### Wrong: Exposing Internal Fields

```typescript
// WRONG: Returns all fields including sensitive data
@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.prisma.user.findUnique({
    where: { id },
    // No select = returns ALL fields: password, internalId, salt, etc.
  });
  return user;  // Exposes password!
}
```

### Correct: Explicit Select + ResponseDto

```typescript
// CORRECT: Explicit select + ResponseDto
@Get(':id')
async findOne(@Param('id') id: string): Promise<BaseResponseDto<UserResponseDto>> {
  const user = await this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      // Password EXCLUDED!
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  return BaseResponseDto.ok(user);
}

// Even better: Use ResponseDto for explicit shape
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  // password, salt, internalId NOT in DTO
}
```

**Key Rules:**
- ALWAYS use explicit `select` or `include`
- NEVER return raw Prisma object
- Create ResponseDto to shape output
- Only expose needed fields to client

---

## Missing $transaction for Related Writes

### Wrong: Multiple Separate Writes

```typescript
// WRONG: If any write fails, partial state
async createUserWithProfile(userDto: CreateUserDto, profileDto: CreateProfileDto) {
  const user = await this.prisma.user.create({
    data: userDto,
    select: { id: true },
  });

  // If this fails, user exists but profile doesn't
  const profile = await this.prisma.profile.create({
    data: { ...profileDto, userId: user.id },
  });

  return { user, profile };
}
```

### Correct: Use $transaction

```typescript
// CORRECT: All or nothing
async createUserWithProfile(userDto: CreateUserDto, profileDto: CreateProfileDto) {
  const result = await this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: userDto,
      select: { id: true },
    });

    // Both succeed or both fail
    const profile = await tx.profile.create({
      data: { ...profileDto, userId: user.id },
    });

    return { user, profile };
  });

  return result;
}
```

**Use $transaction when:**
- Writing to multiple tables
- Parent-child relationships
- Status updates that require consistency

---

## Generic Error Instead of HTTP Exceptions

### Wrong: Generic Error

```typescript
// WRONG: Generic error, loses status code
@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error('User not found');  // 500 error!
  }
  return user;
}
```

### Correct: Specific HTTP Exception

```typescript
// CORRECT: Specific exception, correct status code
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundException('User not found');  // 404
  }
  return user;
}

async create(dto: CreateUserDto) {
  try {
    return await this.prisma.user.create({ data: dto });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ConflictException('Email already exists');  // 409
    }
    throw error;
  }
}
```

**HTTP Status Code Mapping:**
- `NotFoundException` → 404 (not found)
- `ConflictException` → 409 (unique constraint, duplicate)
- `BadRequestException` → 400 (invalid input)
- `UnauthorizedException` → 401 (invalid auth)
- `ForbiddenException` → 403 (insufficient permissions)
- `InternalServerErrorException` → 500 (server error)

---

## N+1 Queries (Fetching Relations in Loop)

### Wrong: N+1 Query

```typescript
// WRONG: 1 query for users + N queries for posts (N+1)
async getUsersWithPosts() {
  const users = await this.prisma.user.findMany();

  // This loop does N additional queries!
  const usersWithPosts = await Promise.all(
    users.map(async (user) => ({
      ...user,
      posts: await this.prisma.post.findMany({  // N+1!
        where: { userId: user.id },
      }),
    })),
  );

  return usersWithPosts;
}
```

### Correct: Single Query with Include

```typescript
// CORRECT: 1 query with includes
async getUsersWithPosts() {
  return this.prisma.user.findMany({
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
}
```

**Prevent N+1:**
- Use `include` or `select` with nested relations
- Fetch all data in single query
- Avoid loops that query database

---

## Circular Module Dependencies

### Wrong: Circular Import

```typescript
// WRONG: UsersModule imports PostsModule, PostsModule imports UsersModule
// users.module.ts
@Module({
  imports: [PostsModule],  // Creates cycle!
  providers: [UsersService],
})
export class UsersModule {}

// posts.module.ts
@Module({
  imports: [UsersModule],  // Creates cycle!
  providers: [PostsService],
})
export class PostsModule {}
```

### Correct: Share via Service Export

```typescript
// CORRECT: UsersModule exports UsersService
@Module({
  providers: [UsersService],
  exports: [UsersService],  // Export for other modules
})
export class UsersModule {}

// PostsModule imports UsersModule and uses UsersService
@Module({
  imports: [UsersModule],
  providers: [PostsService],
})
export class PostsModule {}

// PostsService injects UsersService
@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,  // Inject, don't import
  ) {}
}
```

**Break Cycles:**
- Use `exports` to share services
- Inject services via DI, don't import modules in both directions
- Consider extracting shared logic to separate module

---

## Missing @Injectable() on Services

### Wrong: Service Without Decorator

```typescript
// WRONG: NestJS won't recognize this as injectable
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) { ... }
}
```

### Correct: Service With @Injectable()

```typescript
// CORRECT: Marked as injectable
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) { ... }
}
```

---

## Using console.log Instead of Logger

### Wrong: console.log

```typescript
// WRONG: No context, mixed with stdout
@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    console.log('Creating user');  // Gets lost in logs!
    const user = await this.prisma.user.create({ data: dto });
    console.log('User created', user.id);
    return user;
  }
}
```

### Correct: Injected Logger

```typescript
// CORRECT: Logger with context
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);

  async create(dto: CreateUserDto) {
    this.logger.debug(`Creating user with email: ${dto.email}`);

    const user = await this.prisma.user.create({ data: dto });

    this.logger.log(`User created: ${user.id}`);
    return user;
  }
}
```

**Logger Methods:**
- `log()` - General info
- `debug()` - Detailed debugging info
- `warn()` - Warning condition
- `error()` - Error with stacktrace

---

## Not Handling Prisma Unique Constraint Errors

### Wrong: No Error Handling

```typescript
// WRONG: P2002 crashes endpoint
@Post()
async create(@Body() dto: CreateUserDto) {
  return await this.prisma.user.create({
    data: dto,
    // If email unique constraint fails: 500 error!
  });
}
```

### Correct: Catch and Transform

```typescript
// CORRECT: Handle P2002 unique constraint
@Post()
async create(@Body() dto: CreateUserDto) {
  try {
    return await this.prisma.user.create({
      data: dto,
      select: { id: true, email: true },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta.target[0];  // 'email'
      throw new ConflictException(`${field} already exists`);
    }

    // P2003: Foreign key violation
    if (error.code === 'P2003') {
      throw new BadRequestException('Invalid relation ID');
    }

    // P2025: Record not found (on update)
    if (error.code === 'P2025') {
      throw new NotFoundException('Record not found');
    }

    throw error;  // Re-throw unknown errors
  }
}
```

**Common Prisma Error Codes:**
- `P2002` - Unique constraint violation
- `P2003` - Foreign key constraint violation
- `P2025` - Record not found (on update/delete)
- `P2001` - Provided value too long for column

---

## Forgetting to Wrap Response in BaseResponseDto

### Wrong: Raw Object

```typescript
// WRONG: Inconsistent response format
@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.service.findOne(id);
  return user;  // Client doesn't know structure!
}

@Post()
async create(@Body() dto: CreateUserDto) {
  const result = await this.service.create(dto);
  return { user: result, status: 'created' };  // Different format!
}
```

### Correct: Always Use BaseResponseDto

```typescript
// CORRECT: Consistent response format
@Get(':id')
async findOne(@Param('id') id: string): Promise<BaseResponseDto<UserResponseDto>> {
  const user = await this.service.findOne(id);
  return BaseResponseDto.ok(user);
}

@Post()
async create(
  @Body() dto: CreateUserDto,
): Promise<BaseResponseDto<UserResponseDto>> {
  const result = await this.service.create(dto);
  return BaseResponseDto.created(result);
}

// Single response format:
// Success: { statusCode: 200, message: 'OK', data: {...} }
// Error: { statusCode: 400, error: 'Bad Request', message: 'Invalid email' }
```

---

## Not Using PartialType for UpdateDto

### Wrong: Duplicate Validation

```typescript
// WRONG: Duplicate all validation from CreateDto
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
// Now have 2 sources of truth for validation!
```

### Correct: PartialType

```typescript
// CORRECT: Single source of truth
import { PartialType } from '@nestjs/mapped-types';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
// Automatically: all fields optional, validation inherited
```

---

## Checklist Before Merge

1. **Structure**: Controller has no logic, service has all logic?
2. **Validation**: Every DTO field has decorators?
3. **Database**: All queries use explicit select/include?
4. **Response**: All endpoints return BaseResponseDto?
5. **Errors**: Using specific HTTP exceptions, not generic Error?
6. **Logging**: Using injected Logger, not console.log?
7. **Transactions**: Multi-write operations use $transaction?
8. **Decorators**: Services have @Injectable(), DTOs have validation?
9. **Updates**: UpdateDto extends PartialType(CreateDto)?
10. **Testing**: Unit and integration tests pass?
