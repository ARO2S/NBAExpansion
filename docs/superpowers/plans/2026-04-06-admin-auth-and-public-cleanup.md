# Admin Auth & Public Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down all `/admin` pages and `/api/admin/*` API routes behind Supabase auth + email allowlist, and remove the admin button and runs list from the public home page.

**Architecture:** Next.js middleware provides edge-level route protection redirecting unauthenticated requests; a `requireAdmin()` server helper in each API route provides defense-in-depth. A new `/admin/login` page handles Supabase email/password sign-in. The existing `isAdminEmail()` function and `ADMIN_EMAILS` env var are already in place and used as-is.

**Tech Stack:** Next.js 14 App Router, Supabase SSR (`@supabase/ssr`), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/middleware.ts` | **Create** | Edge guard — redirect/401 for unauthenticated admin routes |
| `src/app/admin/login/page.tsx` | **Create** | Email/password login form calling Supabase auth |
| `src/lib/admin.ts` | **Modify** | Add `requireAdmin()` server helper for API route defense-in-depth |
| `src/lib/__tests__/admin.test.ts` | **Create** | Unit tests for `requireAdmin()` logic |
| `src/app/api/admin/*/route.ts` (all 19) | **Modify** | Add 2-line `requireAdmin()` guard at top of each handler |
| `src/app/page.tsx` | **Modify** | Remove runs state/fetch/list and Admin button |
| `src/app/admin/page.tsx` | **Modify** | Add Sign Out button |

---

## Task 1: Add `requireAdmin()` to `src/lib/admin.ts`

**Files:**
- Modify: `src/lib/admin.ts`
- Create: `src/lib/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing tests for `requireAdmin()`**

Create `src/lib/__tests__/admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr and next/headers before importing the module
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: vi.fn((body, init) => ({ body, status: init?.status ?? 200 })),
    },
  };
});

import { requireAdmin, isAdminEmail } from "../admin";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAdminEmail", () => {
  it("returns false for null", () => {
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns 401 when no session", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);

    const result = await requireAdmin();
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("returns 403 when user email is not admin", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { email: "notadmin@example.com" } },
          error: null,
        }),
      },
    } as never);

    const result = await requireAdmin();
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("returns null when user is an admin", async () => {
    // isAdminEmail reads from ADMIN_EMAILS env var — seed it
    process.env.ADMIN_EMAILS = "admin@example.com";

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
    } as never);

    const result = await requireAdmin();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/andyr/NBAExpansion && npx vitest run src/lib/__tests__/admin.test.ts
```

Expected: failures because `requireAdmin` doesn't exist yet.

- [ ] **Step 3: Implement `requireAdmin()` in `src/lib/admin.ts`**

Replace the entire file with:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Server-side admin guard for API route handlers.
 * Returns null if the request is from an authenticated admin.
 * Returns a NextResponse (401 or 403) to return immediately if not.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/andyr/NBAExpansion && npx vitest run src/lib/__tests__/admin.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/lib/__tests__/admin.test.ts
git commit -m "feat: add requireAdmin() server helper for API route protection"
```

---

## Task 2: Guard All Admin API Routes

**Files:** Modify all 19 `src/app/api/admin/*/route.ts` files — add the same 2-line guard at the top of every exported handler function.

The pattern for every handler is the same two lines inserted right after opening the function, before any other logic:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

And add the import at the top of each file:

```ts
import { requireAdmin } from "@/lib/admin";
```

- [ ] **Step 1: Guard `seed/route.ts`**

Open `src/app/api/admin/seed/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` at the top. Add the guard as the first two lines inside `POST()`:

```ts
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { requireAdmin } from "@/lib/admin";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const projectRoot = process.cwd();
    execSync("npx tsx prisma/seed.ts", {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Seed failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Guard `reset-player-data/route.ts`**

Add import and guard at top of `POST()` in `src/app/api/admin/reset-player-data/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TEAM_NAMES } from "@/lib/team-abbrev";
import { requireAdmin } from "@/lib/admin";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;
  // ... rest of existing code unchanged
```

- [ ] **Step 3: Guard `ingest/route.ts`**

Add import and guard at top of `POST()` in `src/app/api/admin/ingest/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { ingestData } from "@/lib/admin-ingest/upsert";
import { ingestPayloadSchema } from "@/lib/admin-ingest/schema";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  // ... rest of existing code unchanged
```

- [ ] **Step 4: Guard `generate-gm-key/route.ts`**

```ts
import { NextResponse } from "next/server";
import { generateCanonicalProtectionLists } from "@/app/actions/protectionList";
import { requireAdmin } from "@/lib/admin";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;
  // ... rest of existing code unchanged
```

- [ ] **Step 5: Guard `sync-balldontlie/route.ts`**

Open `src/app/api/admin/sync-balldontlie/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler body:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 6: Guard `sync-sportsdataio/route.ts`**

Open `src/app/api/admin/sync-sportsdataio/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler body:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 7: Guard `sync-both/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { ballDontLieAdapter } from "@/lib/providers/balldontlie";
import { sportsDataIOAdapter } from "@/lib/providers/sportsdataio";
import { syncFromProvider } from "@/lib/providers/sync-to-db";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  // ... rest of existing code unchanged
```

- [ ] **Step 8: Guard `sync-spotrac/route.ts`**

Open `src/app/api/admin/sync-spotrac/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler body:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 9: Guard `contracts-upload/route.ts`**

Open `src/app/api/admin/contracts-upload/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 10: Guard `metrics-upload/route.ts`**

Open `src/app/api/admin/metrics-upload/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 11: Guard `data-report/route.ts`**

Open `src/app/api/admin/data-report/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 12: Guard `resolve-multi-team/route.ts`**

Open `src/app/api/admin/resolve-multi-team/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 13: Guard `backfill-minimum-contracts/route.ts`**

Open `src/app/api/admin/backfill-minimum-contracts/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 14: Guard `backfill-missing-metrics/route.ts`**

Open `src/app/api/admin/backfill-missing-metrics/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 15: Guard `add-player/route.ts`**

Open `src/app/api/admin/add-player/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 16: Guard `move-player/route.ts`**

Open `src/app/api/admin/move-player/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of `POST()`:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 17: Guard `players-with-teams/route.ts`**

Open `src/app/api/admin/players-with-teams/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 18: Guard `spotrac-debug/route.ts`**

Open `src/app/api/admin/spotrac-debug/route.ts`. Add `import { requireAdmin } from "@/lib/admin";` with the other imports. Add as the first two lines of the exported handler:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

- [ ] **Step 19: Guard `status/route.ts`**

Add import and guard at top of `GET()` in `src/app/api/admin/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  // ... rest of existing code unchanged
```

- [ ] **Step 20: Build check**

```bash
cd /home/andyr/NBAExpansion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 21: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: guard all admin API routes with requireAdmin()"
```

---

## Task 3: Create Next.js Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a response to pass cookies through
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user?.email
    ? ADMIN_EMAILS.includes(user.email.toLowerCase())
    : false;

  // Protect admin API routes — return JSON errors
  if (pathname.startsWith("/api/admin/")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return response;
  }

  // Protect admin pages — redirect to login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user || !isAdmin) {
      const loginUrl = new URL("/admin/login", request.url);
      if (user && !isAdmin) {
        loginUrl.searchParams.set("error", "forbidden");
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /home/andyr/NBAExpansion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware edge guard for admin routes"
```

---

## Task 4: Create Admin Login Page

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Create `src/app/admin/login/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("error") === "forbidden") {
      setError("Your account does not have admin access.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border-white/10 bg-white/5">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Trophy className="h-8 w-8 text-amber-400" />
          </div>
          <CardTitle className="text-white">Admin Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 bg-white/5 border-white/10 text-white"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /home/andyr/NBAExpansion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx
git commit -m "feat: add admin login page"
```

---

## Task 5: Add Sign Out to Admin Page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add sign-out button to the admin page header**

Read the existing header section of `src/app/admin/page.tsx` (around line 0–10 of the JSX return). The header currently contains a back arrow link. Add a Sign Out button alongside it.

Find the header block — it looks like:

```tsx
<header className="border-b border-white/10 bg-black/20">
  <div className="container mx-auto flex h-16 items-center gap-4 px-4">
    <Link href="/" className="flex items-center gap-2 text-white hover:text-slate-300">
      <ArrowLeft className="h-5 w-5" />
      Back
    </Link>
    <h1 className="text-xl font-bold text-white">Admin</h1>
  </div>
</header>
```

Replace it with:

```tsx
<header className="border-b border-white/10 bg-black/20">
  <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
    <div className="flex items-center gap-4">
      <Link href="/" className="flex items-center gap-2 text-white hover:text-slate-300">
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <h1 className="text-xl font-bold text-white">Admin</h1>
    </div>
    <Button
      variant="outline"
      size="sm"
      className="border-white/20 bg-transparent text-white hover:bg-white/10"
      onClick={async () => {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
      }}
    >
      Sign Out
    </Button>
  </div>
</header>
```

- [ ] **Step 2: Build check**

```bash
cd /home/andyr/NBAExpansion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add sign out button to admin page"
```

---

## Task 6: Clean Up Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite `src/app/page.tsx` to remove runs list and admin button**

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Trophy className="h-6 w-6 shrink-0 text-amber-400 sm:h-8 sm:w-8" />
            <h1 className="truncate text-base font-bold text-white sm:text-xl">
              NBA Expansion Draft Simulator
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <section className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-white sm:text-4xl">
            Simulate Your NBA Expansion Team
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            Configure rules, manage protection lists, and draft your expansion
            roster. Export results as text, with contracts, or as a shareable
            image.
          </p>
          <Link href="/runs/new" className="mt-8 inline-block">
            <Button size="lg" className="gap-2 bg-amber-500 hover:bg-amber-600">
              <Plus className="h-5 w-5" />
              Start New Draft Run
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /home/andyr/NBAExpansion && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /home/andyr/NBAExpansion && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: remove admin link and runs list from public home page"
```

---

## Task 7: Manual Smoke Test

No code changes — verification only.

- [ ] **Step 1: Start dev server**

```bash
cd /home/andyr/NBAExpansion && npm run dev
```

- [ ] **Step 2: Verify admin routes redirect to login**

Visit `http://localhost:3000/admin` — should redirect to `/admin/login`.

- [ ] **Step 3: Verify API routes return 401**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/admin/status
```

Expected output: `401`

- [ ] **Step 4: Verify login works**

Go to `http://localhost:3000/admin/login`. Sign in with your Supabase credentials. Should redirect to `/admin`.

- [ ] **Step 5: Verify sign out works**

Click Sign Out on the admin page. Should redirect to `/admin/login`. Visiting `/admin` again should redirect back to login.

- [ ] **Step 6: Verify home page has no admin link or runs list**

Visit `http://localhost:3000`. Confirm no Admin button in header, no runs list.

- [ ] **Step 7: Verify normal draft flow still works**

Visit `http://localhost:3000/runs/new`. Create a run, proceed through protection and draft phases. Confirm no regressions.
