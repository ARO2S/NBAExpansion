# Admin Auth & Public Cleanup — Design Spec
**Date:** 2026-04-06

## Problem

The app is ready to deploy publicly but has critical gaps:

1. `/admin` and all `/api/admin/*` routes are fully open — any visitor can wipe the database, trigger external API syncs, or run seed scripts.
2. The Admin button is visible to every visitor in the home page header.
3. The home page lists all draft runs from all users, with live links into their active protection phases.

## Goals

- Lock admin page and all admin APIs behind Supabase auth + email allowlist.
- Remove the Admin button from the public header.
- Remove the runs list from the home page.
- Use existing infrastructure (`isAdminEmail()`, Supabase server/client, `ADMIN_EMAILS` env var) — no new dependencies.

## Out of Scope

- User accounts / run ownership for regular visitors.
- Any changes to draft, protection, or results pages.
- UX/UI improvements (follow-on task).

---

## Architecture

### 1. Next.js Middleware (`src/middleware.ts`)

Runs at the edge before any route handler. Matches two path groups:

**Admin pages** (`/admin`, `/admin/*` except `/admin/login`):
- Create Supabase SSR client from the request cookies.
- Call `supabase.auth.getUser()`.
- If no session → redirect to `/admin/login`.
- If session but email not in `ADMIN_EMAILS` → redirect to `/admin/login` with `?error=forbidden`.

**Admin API routes** (`/api/admin/*`):
- Same session check.
- If no session → `401 Unauthorized` JSON.
- If session but not admin → `403 Forbidden` JSON.

`/admin/login` is explicitly excluded from the matcher so it stays publicly accessible.

### 2. Admin Login Page (`src/app/admin/login/page.tsx`)

Client component. Email + password form.

- Calls `supabase.auth.signInWithPassword({ email, password })`.
- On success → `router.push('/admin')`.
- On failure → shows error message inline (never reveals whether email exists).
- Shows `?error=forbidden` message if redirected from middleware.
- No "forgot password" or "sign up" links — this is internal only.

### 3. `requireAdmin()` Helper (`src/lib/admin.ts`)

Server-side defense-in-depth for API routes. Called at the top of every `/api/admin/*` handler.

```ts
// Returns null if authorized, or a NextResponse (401/403) to return immediately
export async function requireAdmin(): Promise<NextResponse | null>
```

- Creates a Supabase server client, calls `getUser()`.
- Returns `null` if user is authenticated and is an admin email.
- Returns a `NextResponse` with the appropriate status if not.

Every existing `/api/admin/*` route handler gets two lines added at the top:

```ts
const authError = await requireAdmin();
if (authError) return authError;
```

### 4. Home Page Cleanup (`src/app/page.tsx`)

- Remove the `runs` state, `useEffect` fetch, and the "Recent Draft Runs" section entirely.
- Remove the `Link href="/admin"` button from the header.
- The page becomes a pure landing/launch page with just the "Start New Draft Run" CTA.

---

## Admin Login UX

- Route: `/admin/login`
- Fields: Email, Password
- Submit: "Sign In"
- Error states: "Invalid email or password" (generic), "Access denied" (wrong email, right credentials)
- After login: redirect to `/admin`
- No registration, no password reset (handle via Supabase dashboard)

---

## Admin Logout

The existing admin page (`/admin`) gets a "Sign Out" button that calls `supabase.auth.signOut()` then redirects to `/admin/login`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/middleware.ts` | **Create** — edge auth guard for admin routes |
| `src/app/admin/login/page.tsx` | **Create** — admin login form |
| `src/lib/admin.ts` | **Modify** — add `requireAdmin()` server helper |
| `src/app/api/admin/*/route.ts` (all ~15) | **Modify** — add `requireAdmin()` call at top |
| `src/app/page.tsx` | **Modify** — remove runs list + admin button |
| `src/app/admin/page.tsx` | **Modify** — add Sign Out button |

---

## Security Notes

- Middleware alone is not sufficient (can be bypassed in some edge deployments); server-side `requireAdmin()` in every handler is the defense-in-depth layer.
- `ADMIN_EMAILS` must be set in the deployment environment. If unset, `isAdminEmail()` returns false for everyone — no one can access admin.
- The Supabase user must exist in Supabase auth AND have an email in `ADMIN_EMAILS`. Knowing the secret URL is not enough.
- The admin seed route uses `execSync` — it remains protected behind auth. Long-term it should be replaced with a direct Prisma call, but that's out of scope here.
