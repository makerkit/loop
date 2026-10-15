---
name: service-builder
description: Build pure, interface-agnostic services with injected dependencies. Use when creating business logic that must work across server actions, MCP tools, CLI commands, or tests. Invoke with /service-builder.
---

# Service Builder

You are an expert at building pure, testable services that are decoupled from their callers.

## North Star

**Every service is decoupled from its interface (I/O).** A service takes plain data in, does work, and returns plain
data out. It has no knowledge of whether it was called from an MCP tool, a server action, a CLI command, a route
handler, or a test. The caller is a thin adapter that resolves dependencies and delegates.

## Workflow

When asked to create a service, follow these steps:

### Step 1: Define the Contract

Start with the input/output types. These are plain TypeScript — no framework types.

```typescript
// _lib/schemas/project.schema.ts
import * as z from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  accountId: z.uuid(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export interface Project {
  id: string;
  name: string;
  account_id: string;
  created_at: string;
}
```

### Step 2: Build the Service

The service receives all dependencies through its constructor. It never imports framework-specific modules (
`getSupabaseServerClient`, `getLogger`, `revalidatePath`, etc.).

```typescript
// _lib/server/project.service.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateProjectInput, Project } from "../schemas/project.schema";

export function createProjectService(client: SupabaseClient) {
  return new ProjectService(client);
}

class ProjectService {
  constructor(private readonly client: SupabaseClient) {}

  async create(data: CreateProjectInput): Promise<Project> {
    const { data: result, error } = await this.client
      .from("projects")
      .insert({
        name: data.name,
        account_id: data.accountId,
      })
      .select()
      .single();

    if (error) throw error;

    return result;
  }

  async list(accountId: string): Promise<Project[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
  }

  async delete(projectId: string): Promise<void> {
    const { error } = await this.client.from("projects").delete().eq("id", projectId);

    if (error) throw error;
  }
}
```

### Step 3: Write Thin Adapters

Each interface is a thin adapter — it resolves dependencies, calls the service, and handles interface-specific
concerns (revalidation, redirects, MCP formatting, CLI output).

**Server Action adapter:**

```typescript
// _lib/server/server-actions.ts
"use server";

import { enhanceAction } from "@kit/next/actions";
import { getLogger } from "@kit/shared/logger";
import { getSupabaseServerClient } from "@kit/supabase/server-client";
import { revalidatePath } from "next/cache";

import { CreateProjectSchema } from "../schemas/project.schema";
import { createProjectService } from "./project.service";

export const createProjectAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info({ name: "create-project", userId: user.id }, "Creating project");

    const client = getSupabaseServerClient();
    const service = createProjectService(client);
    const result = await service.create(data);

    revalidatePath("/home/[account]/projects");

    return { success: true, data: result };
  },
  {
    auth: true,
    schema: CreateProjectSchema,
  },
);
```

**Route Handler adapter:**

```typescript
// app/api/projects/route.ts
import { enhanceRouteHandler } from "@kit/next/routes";
import { getSupabaseServerClient } from "@kit/supabase/server-client";
import { NextResponse } from "next/server";

import { CreateProjectSchema } from "../_lib/schemas/project.schema";
import { createProjectService } from "../_lib/server/project.service";

export const POST = enhanceRouteHandler(
  async function ({ body, user }) {
    const client = getSupabaseServerClient();
    const service = createProjectService(client);
    const result = await service.create(body);

    return NextResponse.json(result);
  },
  {
    auth: true,
    schema: CreateProjectSchema,
  },
);
```

**MCP Tool adapter:**

```typescript
// mcp/tools/kit_project_create.ts
import { createProjectService } from "../../_lib/server/project.service";

export const kit_project_create: McpToolHandler = async (input, context) => {
  const client = context.getSupabaseClient();
  const service = createProjectService(client);

  return service.create(input);
};
```

### Step 4: Write Tests

Because the service accepts dependencies, you can test it with stubs — no running database, no framework runtime.

```typescript
// _lib/server/__tests__/project.service.test.ts
import { describe, it, expect, vi } from "vitest";

import { createProjectService } from "../project.service";

function createMockClient(overrides: Record<string, unknown> = {}) {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "proj-1",
        name: "Test",
        account_id: "acc-1",
        created_at: new Date().toISOString(),
      },
      error: null,
    }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    ...overrides,
  };

  return {
    from: vi.fn(() => mockChain),
    mockChain,
  } as unknown as SupabaseClient;
}

describe("ProjectService", () => {
  it("creates a project", async () => {
    const client = createMockClient();
    const service = createProjectService(client);

    const result = await service.create({
      name: "Test Project",
      accountId: "acc-1",
    });

    expect(result.id).toBe("proj-1");
    expect(client.from).toHaveBeenCalledWith("projects");
  });

  it("throws on database error", async () => {
    const client = createMockClient({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "unique violation" },
      }),
    });

    const service = createProjectService(client);

    await expect(service.create({ name: "Dup", accountId: "acc-1" })).rejects.toEqual({
      message: "unique violation",
    });
  });
});
```

## Rules

1. **Services are pure functions over data.** Plain objects/primitives in, plain objects/primitives out. No `Request`/
   `Response`, no MCP context, no `FormData`.

2. **Inject dependencies, never import them.** The service receives its database client, storage client, or any I/O
   capability as a constructor argument. Never call `getSupabaseServerClient()` inside a service.

3. **Adapters are trivial glue.** A server action resolves the client, calls the service, and handles `revalidatePath`.
   An MCP tool resolves the client, calls the service, and formats the response. No business logic in adapters.

4. **One service, many callers.** If two interfaces do the same thing, they call the same service function. Duplicating
   logic is a violation.

5. **Testable in isolation.** Pass a mock client, assert the output. If you need a running database to test a service,
   refactor until you don't.

## What Goes Where

| Concern                | Location                                  | Example                                   |
| ---------------------- | ----------------------------------------- | ----------------------------------------- |
| Input validation (Zod) | `_lib/schemas/`                           | `CreateProjectSchema`                     |
| Business logic         | `_lib/server/*.service.ts`                | `ProjectService.create()`                 |
| Auth check             | Adapter (`enhanceAction({ auth: true })`) | Server action wrapper                     |
| Logging                | Adapter                                   | `logger.info()` before/after service call |
| Cache revalidation     | Adapter                                   | `revalidatePath()` after mutation         |
| Redirect               | Adapter                                   | `redirect()` after creation               |
| MCP response format    | Adapter                                   | Return service result as MCP content      |

## File Structure

```
feature/
├── _lib/
│   ├── schemas/
│   │   └── feature.schema.ts       # Zod schemas + TS types
│   └── server/
│       ├── feature.service.ts       # Pure service (dependencies injected)
│       ├── server-actions.ts        # Server action adapters
│       └── __tests__/
│           └── feature.service.test.ts  # Unit tests with mock client
└── _components/
    └── feature-form.tsx
```

## Anti-Patterns

```typescript
// ❌ BAD: Service imports framework-specific client
class ProjectService {
  async create(data: CreateProjectInput) {
    const client = getSupabaseServerClient(); // coupling!
    // ...
  }
}

// ❌ BAD: Business logic in the adapter
export const createProjectAction = enhanceAction(
  async function (data, user) {
    const client = getSupabaseServerClient();
    // Business logic directly in the action — not reusable
    if (data.name.length > 100) throw new Error('Name too long');
    const { data: result } = await client.from('projects').insert(data);
    return result;
  },
  { auth: true, schema: CreateProjectSchema },
);

// ❌ BAD: Two interfaces duplicate the same logic
// server-actions.ts
const result = await client.from('projects').insert(...).select().single();
// mcp-tool.ts
const result = await client.from('projects').insert(...).select().single();
// Should be: both call projectService.create()
```

## Reference

See `[Examples](examples.md)` for more patterns including services with multiple dependencies, services that compose
other services, and testing strategies.
