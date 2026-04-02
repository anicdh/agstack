# TypeScript-Zod Gotchas

Common mistakes and how to avoid them.

---

## 1. Separate Interface and Zod Schema (They Drift Apart)

### Problem
Define type separately from validation schema. They evolve independently and contradict each other.

### Wrong

```typescript
// ❌ WRONG - Type and schema in different places
interface User {
  id: string;
  email: string;
  age?: number;
  isActive: boolean;
}

const UserSchema = z.object({
  id: z.string().uuid(),  // Type says string, schema says uuid (drift!)
  email: z.string(),  // Type says string, schema has no email validation
  age: z.number(),  // Type says optional, schema says required
  isActive: z.boolean(),
});
```

### Correct

```typescript
// ✅ CORRECT - Schema is source of truth
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().optional(),
  isActive: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;
```

### Why It Matters
- Type and validation diverge over time
- Someone trusts the type, API trusts the schema → data corruption
- Bugs in production because "it type-checks" but fails validation
- Duplicate maintenance effort

---

## 2. Missing `.optional()` (exactOptionalPropertyTypes Error)

### Problem
Property is optional in code but Zod schema doesn't use `.optional()`. Type includes `undefined` but schema doesn't accept it.

### Wrong

```typescript
// ❌ WRONG - exactOptionalPropertyTypes violation
const UserSchema = z.object({
  name: z.string(),  // schema says required
  nickname: z.string(),  // ❌ should be .optional()
});

export type User = z.infer<typeof UserSchema>;
// Result type: { name: string; nickname?: string | undefined }
// But schema rejects undefined! Type check passes, runtime fails.

// Later in code:
const user = UserSchema.parse(apiResponse);
if (!user.nickname) {  // TypeScript allows this
  // But schema already rejected if nickname was undefined
}
```

### Correct

```typescript
// ✅ CORRECT - explicit optional in schema
const UserSchema = z.object({
  name: z.string(),
  nickname: z.string().optional(),  // Matches the type
});

export type User = z.infer<typeof UserSchema>;
// Result type: { name: string; nickname?: string | undefined }
// Both schema and type match
```

### Rule
- Type has `field?: T`? → Schema must have `.optional()`
- Type has `field: T`? → Schema must NOT have `.optional()`
- Type has `field: T | null`? → Schema must have `.nullable()`

---

## 3. Using TS Enum Instead of z.enum

### Problem
TypeScript enums are not tree-shaken and have no runtime validation. Zod enums are smaller and validated.

### Wrong

```typescript
// ❌ WRONG - TS enum (not tree-shakable, no validation)
enum UserRole {
  Admin = 'admin',
  Moderator = 'moderator',
  User = 'user',
}

// Entire enum bundled even if unused
// No runtime validation - user can pass any string

interface User {
  role: UserRole;
}

const user = { role: 'superadmin' as UserRole };  // ❌ No validation!
```

### Correct

```typescript
// ✅ CORRECT - z.enum (tree-shakable, validated)
export const UserRoleSchema = z.enum(['admin', 'moderator', 'user']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Only used values shipped
// Runtime validation enforced

const result = UserRoleSchema.parse('superadmin');  // ✅ Throws error!
```

### Impact
- Bundle size reduction (enum dropped in tree-shake)
- Always get validation at boundaries
- More flexible: infer type from validation, not enum

---

## 4. Not Using `.parse()` or `.parseAsync()` on API Boundaries

### Problem
Trust unvalidated API response. Type says it's valid, but runtime data is wrong.

### Wrong

```typescript
// ❌ WRONG - No validation of API response
async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();  // Unvalidated!

  // TypeScript thinks it's User, but could be garbage
  return data as User;  // Type cast without validation
}

// Later, someone added a field to the API
// Frontend type is stale
// Type checker says OK, but code crashes at runtime
```

### Correct

```typescript
// ✅ CORRECT - Validate API response
async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();

  // Parse and validate against schema
  return UserSchema.parse(data);  // Throws if invalid, returns User
}

// If API changes, parse() catches it immediately
// Type system and runtime always in sync
```

### Where to Validate
- ✅ API responses (frontend)
- ✅ Request bodies (backend)
- ✅ Query parameters (all layers)
- ✅ Database results (if not ORM-validated)
- ❌ NOT between modules if source is already validated

---

## 5. Overly Loose Schemas

### Problem
Validate too little. Use generic `z.string()` when specific format is needed.

### Wrong

```typescript
// ❌ WRONG - No specific validation
const UserSchema = z.object({
  email: z.string(),  // Just a string, not email!
  phone: z.string(),  // Just a string, not phone!
  website: z.string(),  // Just a string, not URL!
  age: z.number(),  // Any number, including negative!
});

// Invalid data passes schema
const user = UserSchema.parse({
  email: 'not-an-email',
  phone: 'hello world',
  website: 'not a url',
  age: -50,  // Negative age?!
});
```

### Correct

```typescript
// ✅ CORRECT - Specific validation per field
const UserSchema = z.object({
  email: z.string().email(),  // Must be email format
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),  // Must be valid phone
  website: z.string().url(),  // Must be valid URL
  age: z.number().int().positive().max(150),  // Positive, reasonable range
});

// Invalid data rejected
UserSchema.parse({
  email: 'not-an-email',  // ❌ Throws
  // ...
});
```

### Validation Levels
1. Type check: `z.string()`, `z.number()`
2. Format check: `.email()`, `.url()`, `.uuid()`
3. Range check: `.positive()`, `.max(100)`, `.min(1)`
4. Pattern check: `.regex()`
5. Custom check: `.refine()`, `.superRefine()`

---

## 6. Not Using `.partial()` for UpdateDto

### Problem
UpdateDto has same validation as CreateDto (all required). Should be all optional.

### Wrong

```typescript
// ❌ WRONG - UpdateDto same as CreateDto
const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  description: z.string(),
});

const UpdateProductSchema = z.object({
  name: z.string().min(1),  // All fields required
  price: z.number().positive(),  // But updates should be optional!
  description: z.string(),
});

// User can only update if ALL fields provided
const update = UpdateProductSchema.parse({
  name: 'Updated Name',
  // Missing price and description - ❌ FAILS
});
```

### Correct

```typescript
// ✅ CORRECT - UpdateDto is partial CreateDto
const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  description: z.string(),
});

const UpdateProductSchema = CreateProductSchema.partial();
// Now all fields optional: { name?: string, price?: number, description?: string }

// User can update one field
const update = UpdateProductSchema.parse({
  name: 'Updated Name',
  // price and description optional
});
```

### Pattern
```typescript
// Always follow this in CRUD features:
export const CreateSchema = z.object({ /* all required */ });
export const UpdateSchema = CreateSchema.partial();  // All optional
export const ResponseSchema = CreateSchema.extend({ /* add id, dates */ });
```

---

## 7. Missing Error Messages on User-Facing Forms

### Problem
Generic validation errors don't help user fix the problem.

### Wrong

```typescript
// ❌ WRONG - No error messages
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// User sees error but doesn't know why
// "Invalid value" — not helpful!
```

### Correct

```typescript
// ✅ CORRECT - Specific error messages
const LoginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
  password: z.string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
}).refine(
  (data) => data.password.length <= 256,
  {
    message: 'Password is too long',
    path: ['password'],  // Attach to field
  }
);

// User sees clear errors:
// "Please enter a valid email address"
// "Password must be at least 8 characters"
```

### Best Practices
- Every validation rule needs `.message()` or custom message
- Use `.path()` to attach error to specific field
- User-facing errors: explain what's wrong + how to fix
- Backend errors: can be technical

---

## 8. Using `z.any()` or `z.unknown()` Without Refinement

### Problem
`z.any()` and `z.unknown()` accept literally anything. Defeats validation.

### Wrong

```typescript
// ❌ WRONG - z.any() accepts everything
const ConfigSchema = z.object({
  settings: z.any(),  // Could be anything!
});

// No validation, defeats type safety
const config = ConfigSchema.parse({ settings: undefined });
```

### Correct

```typescript
// ✅ CORRECT - Use z.unknown() with .refine()
const ConfigSchema = z.object({
  settings: z.unknown().refine(
    (val) => typeof val === 'object' && val !== null,
    'Settings must be an object'
  ),
});

// OR be specific about structure
const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  notifications: z.boolean(),
});

const ConfigSchema = z.object({
  settings: SettingsSchema,
});
```

### Rule
- Avoid `z.any()` entirely
- `z.unknown()` only with refinement
- Be specific about expected structure

---

## 9. Not Testing Schema Edge Cases

### Problem
Schema works for happy path, but fails on edge cases (empty strings, null, etc.).

### Wrong

```typescript
// ❌ WRONG - No test coverage
const UserSchema = z.object({
  name: z.string().min(1),
});

// Never tested what happens with:
// - Empty string?
// - Null?
// - Undefined?
// - Whitespace only?
```

### Correct

```typescript
// ✅ CORRECT - Test edge cases
describe('UserSchema', () => {
  it('should reject empty string', () => {
    expect(() => UserSchema.parse({ name: '' })).toThrow();
  });

  it('should reject null', () => {
    expect(() => UserSchema.parse({ name: null })).toThrow();
  });

  it('should reject undefined', () => {
    expect(() => UserSchema.parse({ name: undefined })).toThrow();
  });

  it('should trim whitespace', () => {
    const result = UserSchema.parse({ name: '  John  ' });
    expect(result.name).toBe('John');  // Assuming schema has .trim()
  });

  it('should apply default', () => {
    const result = UserSchema.parse({});  // name omitted
    expect(result.name).toBe('default');  // If default set
  });
});
```

### Test Checklist
- [ ] Valid data passes
- [ ] Each validation rule is tested in isolation
- [ ] Edge cases: empty string, null, undefined, whitespace
- [ ] Transforms work correctly
- [ ] Defaults applied
- [ ] Error messages are correct

---

## 10. Circular Schema References Without `z.lazy()`

### Problem
Recursive types need `z.lazy()` to defer evaluation, otherwise infinite recursion.

### Wrong

```typescript
// ❌ WRONG - Infinite recursion at definition time
const NodeSchema: z.ZodTypeAny = z.object({
  id: z.string(),
  children: z.array(NodeSchema),  // ❌ NodeSchema not defined yet!
});
// Error: cannot read property of undefined
```

### Correct

```typescript
// ✅ CORRECT - Use z.lazy() to defer evaluation
const NodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    children: z.array(NodeSchema),  // ✅ NodeSchema available at runtime
  })
);

// Works with nested structures
export type Node = z.infer<typeof NodeSchema>;

const tree: Node = {
  id: '1',
  children: [
    {
      id: '2',
      children: [
        {
          id: '3',
          children: [],
        },
      ],
    },
  ],
};

const parsed = NodeSchema.parse(tree);  // ✅ Works
```

### When to Use
- Trees (parent-child relationships)
- Graphs (circular references)
- Linked lists
- Any recursive data structure

### Pattern
```typescript
const RecursiveSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    value: z.string(),
    nested: RecursiveSchema.optional(),
  })
);
```

---

## Summary Checklist

Before committing schema code:

- [ ] Schema defined FIRST, type inferred from `.z.infer()`?
- [ ] All optional fields use `.optional()` (not just `?` in type)?
- [ ] Using `z.enum()` not TS enum?
- [ ] API responses validated with `.parse()` on boundary?
- [ ] Schemas specific, not overly loose?
- [ ] UpdateDto uses `.partial()`?
- [ ] All user-facing errors have messages?
- [ ] No `z.any()` without explanation?
- [ ] Schema has test coverage for edge cases?
- [ ] Recursive schemas use `z.lazy()`?
