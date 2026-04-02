---
name: typescript-zod
description: >
  Call this skill when defining API contracts, shared types, form validation schemas,
  or runtime data validation. Covers Zod schema patterns, type inference, shared
  schema architecture, API contract design, and form integration with react-hook-form.
invocation: auto
---

# TypeScript-Zod: Validation as Source of Truth

## Core Principle: Single Source of Truth

**Define Zod schema FIRST, infer TypeScript type from it. NEVER define interface/type separately.**

### Why?
- One definition prevents drift between validation and type checking
- Runtime validation matches TypeScript compile-time types
- Frontend and backend consume same schema → same validation rules
- Eliminates redundant type definitions

### Correct Pattern

```typescript
// ✅ CORRECT - Schema is source of truth
import { z } from 'zod';

// Define schema FIRST
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  createdAt: z.date(),
  isActive: z.boolean().default(true),
});

// Infer type from schema
export type User = z.infer<typeof UserSchema>;

// Export both
export { UserSchema };
```

### Incorrect Pattern

```typescript
// ❌ WRONG - Type and schema drift apart
interface User {
  id: string;
  email: string;
  name: string;
  age?: number;  // Different from schema? Can't validate it
  createdAt: Date;
  isActive: boolean;
}

const UserSchema = z.object({
  id: z.string(),  // Not uuid!
  email: z.string(),  // Not email!
  name: z.string(),
  // Missing age validation
  createdAt: z.string(),  // Not date!
  isActive: z.boolean(),
});
```

---

## Schema Design Patterns

### 1. Basic Schema with Common Validators

```typescript
export const BasicUserSchema = z.object({
  // Strings
  email: z.string()
    .email('Must be a valid email')
    .toLowerCase(),

  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),

  // Numbers
  age: z.number()
    .int('Age must be a whole number')
    .positive('Age must be positive')
    .max(150, 'Age seems unrealistic'),

  // UUID
  id: z.string().uuid('Must be a valid UUID'),

  // Dates
  birthDate: z.coerce.date()
    .refine(d => d < new Date(), 'Birth date cannot be in the future'),

  // Booleans
  isVerified: z.boolean(),

  // Literals
  role: z.enum(['admin', 'user', 'guest']),
});

export type BasicUser = z.infer<typeof BasicUserSchema>;
```

### 2. Optional Fields (exactOptionalPropertyTypes)

```typescript
// ✅ CORRECT - explicit undefined in union
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),

  // Optional means "field may not be provided"
  // Type must include | undefined
  nickname: z.string().optional(),  // type: string | undefined
  bio: z.string().max(500).optional(),

  // Required with default
  notificationsEnabled: z.boolean().default(true),

  // Nullable vs Optional
  middleName: z.string().nullable(),  // type: string | null (can be explicitly null)
  suffix: z.string().optional(),  // type: string | undefined (can be omitted)
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
// Result:
// {
//   id: string;
//   email: string;
//   nickname?: string | undefined;  // ✅ optional AND undefined
//   bio?: string | undefined;
//   notificationsEnabled: boolean;  // Has default
//   middleName: string | null;
//   suffix?: string | undefined;
// }
```

### 3. Default Values

```typescript
export const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),

  // Defaults are applied by `.parse()` if field omitted
  status: z.enum(['draft', 'published']).default('draft'),
  visibility: z.enum(['public', 'private']).default('private'),
  tags: z.array(z.string()).default([]),
  viewCount: z.number().default(0),

  // With preprocessing
  createdAt: z.date().default(() => new Date()),
});

export type CreatePost = z.infer<typeof CreatePostSchema>;
```

### 4. Enums (z.enum preferred over TS enum)

```typescript
// ✅ CORRECT - Zod enum (tree-shakable, runtime-validated)
export const UserRoleSchema = z.enum(['admin', 'moderator', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// ❌ AVOID - TS enum (not tree-shakable, no runtime validation)
enum UserRole {
  Admin = 'admin',
  Moderator = 'moderator',
  User = 'user',
  Guest = 'guest',
}
```

### 5. Discriminated Unions (Pattern Matching)

```typescript
export const PaymentEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('card_charge'),
    amount: z.number().positive(),
    cardLast4: z.string().length(4),
    currency: z.string().length(3),
  }),
  z.object({
    type: z.literal('bank_transfer'),
    amount: z.number().positive(),
    accountNumber: z.string(),
    routingNumber: z.string(),
  }),
  z.object({
    type: z.literal('refund'),
    originalTransactionId: z.string().uuid(),
    refundAmount: z.number().positive(),
  }),
]);

export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

// Usage
const event = { type: 'card_charge', amount: 100, cardLast4: '4242', currency: 'USD' };
const parsed = PaymentEventSchema.parse(event);
// Type narrowing works: parsed.type === 'card_charge' → cardLast4 is available
```

### 6. Recursive Schemas (Tree Structures)

```typescript
export const CategorySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    parent: CategorySchema.optional(),
    children: z.array(CategorySchema).default([]),
  })
);

export type Category = z.infer<typeof CategorySchema>;

// Usage
const category: Category = {
  id: '1',
  name: 'Electronics',
  parent: {
    id: '0',
    name: 'Products',
  },
  children: [
    {
      id: '2',
      name: 'Phones',
      children: [],
    },
  ],
};
```

---

## API Contract Patterns

### Complete CRUD Schema Example

```typescript
// /shared/types/product.ts

import { z } from 'zod';

// ========== BASE SCHEMAS ==========

export const ProductIdSchema = z.string().uuid();

export const UnitPriceSchema = z.number()
  .positive('Price must be positive')
  .max(999999.99, 'Price too high');

// ========== CREATE DTO ==========
// All required fields, no id/createdAt/updatedAt
export const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long'),

  description: z.string()
    .max(5000)
    .optional(),

  sku: z.string()
    .min(1)
    .max(50),

  price: UnitPriceSchema,

  stock: z.number()
    .int('Stock must be whole number')
    .nonnegative('Stock cannot be negative')
    .default(0),

  isActive: z.boolean().default(true),
});

export type CreateProduct = z.infer<typeof CreateProductSchema>;

// ========== UPDATE DTO ==========
// All fields optional
export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;

// ========== RESPONSE SCHEMA ==========
// Includes id + timestamps (from database)
export const ProductResponseSchema = CreateProductSchema.extend({
  id: ProductIdSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Product = z.infer<typeof ProductResponseSchema>;

// ========== LIST RESPONSE ==========
export const ProductListResponseSchema = z.object({
  data: z.array(ProductResponseSchema),
  meta: z.object({
    total: z.number().nonnegative(),
    page: z.number().positive(),
    limit: z.number().positive(),
    pages: z.number().nonnegative(),
  }),
});

export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

// ========== QUERY PARAMS ==========
export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
```

### Backend Usage (NestJS)

```typescript
// api/src/modules/products/dto/create-product.dto.ts

import { CreateProductSchema } from '@shared/types/product';

export class CreateProductDto {
  name: string;
  description?: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
}

// Validate request body
export class CreateProductPipe implements PipeTransform {
  transform(value: unknown) {
    try {
      return CreateProductSchema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      throw error;
    }
  }
}

// In controller
@Post()
async create(@Body(CreateProductPipe) createDto: CreateProduct) {
  return this.productsService.create(createDto);
}
```

### Frontend Usage (React)

```typescript
// frontend/src/features/products/queries/use-products.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { ProductListResponseSchema, ListProductsQuery } from '@shared/types/product';

export function useProducts(query: ListProductsQuery) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: async () => {
      const response = await api.get('/products', { params: query });
      // Validate response shape
      return ProductListResponseSchema.parse(response.data);
    },
  });
}
```

---

## Validation Patterns

### 1. Custom Validators with .refine()

```typescript
// Simple custom validation
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (pwd) => /[A-Z]/.test(pwd),
    'Password must contain uppercase letter'
  )
  .refine(
    (pwd) => /[0-9]/.test(pwd),
    'Password must contain number'
  );

// Multiple conditions (use .refine for each)
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // Field to attach error to
  }
);
```

### 2. Advanced Validation with .superRefine()

```typescript
// .superRefine allows adding multiple errors at once
export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  size: z.number().positive(),
  format: z.string(),
}).superRefine((data, ctx) => {
  // Check file size
  if (data.size > 10 * 1024 * 1024) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['file'],
      message: 'File must be less than 10MB',
    });
  }

  // Check allowed formats
  const allowedFormats = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedFormats.includes(data.format)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['format'],
      message: `Format must be one of: ${allowedFormats.join(', ')}`,
    });
  }
});
```

### 3. Transform for Normalization

```typescript
// Normalize data before storing
export const ContactSchema = z.object({
  email: z.string()
    .email()
    .toLowerCase()  // Normalize email to lowercase
    .trim(),

  phone: z.string()
    .regex(/^\d{10}$/, 'Phone must be 10 digits')
    .transform(p => `+1-${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`),

  website: z.string()
    .url()
    .transform(url => url.replace(/\/$/, '')),  // Remove trailing slash
});
```

### 4. Coercion for Query Parameters

```typescript
// Query params come as strings, coerce to correct types
export const FilterSchema = z.object({
  // From ?page=1&limit=20
  page: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().positive().max(100),

  // From ?isActive=true
  isActive: z.coerce.boolean().optional(),

  // From ?minPrice=10.99&maxPrice=99.99
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),

  // Validate minPrice <= maxPrice
}).refine(
  (data) => !data.minPrice || !data.maxPrice || data.minPrice <= data.maxPrice,
  {
    message: 'minPrice must be less than or equal to maxPrice',
    path: ['minPrice'],
  }
);
```

### 5. Custom Error Messages

```typescript
export const LoginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),

  password: z.string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
}).refine(
  (data) => data.password.length <= 256,
  {
    message: 'Password is too long',
    path: ['password'],
  }
);

// Custom error map (global)
const customErrorMap: z.ZodErrorMap = (issue, _ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: `Expected ${issue.expected}, got ${issue.received}` };
  }
  return { message: _ctx.defaultError };
};

const result = LoginSchema.parseWithEnv(data, { errorMap: customErrorMap });
```

---

## Shared Schema Architecture

### Directory Structure

```
/shared/types/
├── index.ts                 # Re-export all schemas
├── base.ts                  # Reusable base schemas (email, uuid, date, etc.)
├── pagination.ts            # Pagination schema
├── product.ts               # Feature-specific schemas
├── order.ts
├── user.ts
└── ...
```

### Base Schemas (Reusable Across Features)

```typescript
// /shared/types/base.ts

import { z } from 'zod';

// ========== COMMON VALIDATORS ==========

export const UUIDSchema = z.string().uuid('Must be a valid UUID');

export const EmailSchema = z.string()
  .email('Must be a valid email')
  .toLowerCase()
  .max(255);

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(256)
  .refine(
    (pwd) => /[A-Z]/.test(pwd),
    'Must contain uppercase letter'
  )
  .refine(
    (pwd) => /[0-9]/.test(pwd),
    'Must contain number'
  );

export const NameSchema = z.string()
  .min(1, 'Required')
  .max(255)
  .trim();

export const PhoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');

export const URLSchema = z.string().url('Must be a valid URL');

// ========== COMMON TIMESTAMPS ==========

export const TimestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ========== PAGINATION ==========

export const PaginationMetaSchema = z.object({
  total: z.number().nonnegative(),
  page: z.number().positive(),
  limit: z.number().positive(),
  pages: z.number().nonnegative(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    data: z.array(dataSchema),
    meta: PaginationMetaSchema,
  });
```

### Feature Schema

```typescript
// /shared/types/user.ts

import { z } from 'zod';
import { UUIDSchema, EmailSchema, PasswordSchema, NameSchema, TimestampsSchema } from './base';

// ========== CREATE USER ==========

export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: NameSchema,
  role: z.enum(['admin', 'user']).default('user'),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// ========== UPDATE USER ==========

export const UpdateUserSchema = CreateUserSchema.omit({ password: true }).partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

// ========== USER RESPONSE ==========

export const UserSchema = CreateUserSchema.omit({ password: true }).extend({
  id: UUIDSchema,
  ...TimestampsSchema.shape,
});

export type User = z.infer<typeof UserSchema>;

// ========== RE-EXPORT ==========

export const userSchemas = {
  create: CreateUserSchema,
  update: UpdateUserSchema,
  response: UserSchema,
};
```

### Index / Re-export

```typescript
// /shared/types/index.ts

export * from './base';
export * from './product';
export * from './user';
export * from './order';
// ... all features

// Or export namespace
export { userSchemas, productSchemas, orderSchemas };
```

---

## Form Integration (react-hook-form)

### Complete Example

```typescript
// /frontend/src/features/products/components/product-form.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateProductSchema } from '@shared/types/product';
import type { CreateProduct } from '@shared/types/product';

// Form schema is subset of API schema (e.g., omit database fields)
const ProductFormSchema = CreateProductSchema;

interface ProductFormProps {
  onSubmit: (data: CreateProduct) => Promise<void>;
  isLoading?: boolean;
}

export function ProductForm({ onSubmit, isLoading }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProduct>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      isActive: true,
      stock: 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Name field */}
      <div>
        <label>Name</label>
        <input {...register('name')} type="text" />
        {errors.name && <span>{errors.name.message}</span>}
      </div>

      {/* Price field */}
      <div>
        <label>Price</label>
        <input {...register('price', { valueAsNumber: true })} type="number" step="0.01" />
        {errors.price && <span>{errors.price.message}</span>}
      </div>

      {/* Stock field */}
      <div>
        <label>Stock</label>
        <input {...register('stock', { valueAsNumber: true })} type="number" />
        {errors.stock && <span>{errors.stock.message}</span>}
      </div>

      {/* Submit */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}
```

### With API Mutation

```typescript
// /frontend/src/features/products/queries/use-create-product.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ProductResponseSchema } from '@shared/types/product';
import type { CreateProduct } from '@shared/types/product';

export function useCreateProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProduct) => {
      const response = await api.post('/products', data);
      // Validate response
      return ProductResponseSchema.parse(response.data);
    },
    onSuccess: (product) => {
      toast({
        title: 'Success',
        description: `Product "${product.name}" created`,
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create product',
        variant: 'destructive',
      });
    },
  });
}
```

---

## Testing Schemas

### Schema Validation Tests

```typescript
// /shared/types/__tests__/product.spec.ts

import { describe, it, expect } from 'vitest';
import { CreateProductSchema, ProductResponseSchema } from '../product';

describe('Product Schemas', () => {
  // ========== CREATE PRODUCT ==========

  describe('CreateProductSchema', () => {
    it('should parse valid product', () => {
      const data = {
        name: 'Widget',
        description: 'A useful widget',
        sku: 'WIDGET-001',
        price: 29.99,
        stock: 100,
        isActive: true,
      };

      const result = CreateProductSchema.parse(data);
      expect(result).toEqual(data);
    });

    it('should reject empty name', () => {
      const data = {
        name: '',  // Invalid
        sku: 'WIDGET-001',
        price: 29.99,
      };

      expect(() => CreateProductSchema.parse(data)).toThrow();
    });

    it('should reject negative price', () => {
      const data = {
        name: 'Widget',
        sku: 'WIDGET-001',
        price: -10,  // Invalid
      };

      expect(() => CreateProductSchema.parse(data)).toThrow();
    });

    it('should apply default values', () => {
      const data = {
        name: 'Widget',
        sku: 'WIDGET-001',
        price: 29.99,
        // isActive and stock omitted
      };

      const result = CreateProductSchema.parse(data);
      expect(result.isActive).toBe(true);
      expect(result.stock).toBe(0);
    });

    it('should trim name', () => {
      const data = {
        name: '  Widget  ',
        sku: 'WIDGET-001',
        price: 29.99,
      };

      const result = CreateProductSchema.parse(data);
      expect(result.name).toBe('Widget');
    });
  });

  // ========== PRODUCT RESPONSE ==========

  describe('ProductResponseSchema', () => {
    it('should parse complete response', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Widget',
        sku: 'WIDGET-001',
        price: 29.99,
        stock: 100,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const result = ProductResponseSchema.parse(data);
      expect(result.id).toBe(data.id);
    });

    it('should reject response without id', () => {
      const data = {
        name: 'Widget',
        sku: 'WIDGET-001',
        price: 29.99,
        stock: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Missing id
      };

      expect(() => ProductResponseSchema.parse(data)).toThrow();
    });

    it('should reject invalid UUID', () => {
      const data = {
        id: 'not-a-uuid',  // Invalid
        name: 'Widget',
        sku: 'WIDGET-001',
        price: 29.99,
        stock: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => ProductResponseSchema.parse(data)).toThrow();
    });
  });

  // ========== EDGE CASES ==========

  describe('Edge cases', () => {
    it('should reject null values', () => {
      const data = {
        name: null,  // Invalid
        sku: 'WIDGET-001',
        price: 29.99,
      };

      expect(() => CreateProductSchema.parse(data)).toThrow();
    });

    it('should handle optional fields correctly', () => {
      const data = {
        name: 'Widget',
        sku: 'WIDGET-001',
        price: 29.99,
        description: undefined,  // OK
      };

      const result = CreateProductSchema.parse(data);
      expect(result.description).toBeUndefined();
    });
  });
});
```

---

## Review Checklist

Before using any schema:

- [ ] Schema defined FIRST, type inferred from it?
- [ ] Schema exported with type? (e.g., `export const Schema`, `export type Type`)
- [ ] Schema in `/shared/types/` if used by both API and frontend?
- [ ] Type uses `.partial()` for UpdateDto?
- [ ] All user-facing validation errors have custom messages?
- [ ] Coercion used for query parameters (`.coerce.number()` etc.)?
- [ ] Cross-field validation uses `.refine()` with path set?
- [ ] Optional fields marked with `.optional()` matching `exactOptionalPropertyTypes`?
- [ ] Default values set appropriately?
- [ ] Schema tested with valid and invalid data?
- [ ] Recursive schemas use `z.lazy()`?
- [ ] No hardcoded strings in validation messages?
- [ ] Form schemas use `zodResolver` with react-hook-form?
