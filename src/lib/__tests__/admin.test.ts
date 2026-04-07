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
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");

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

    vi.unstubAllEnvs();
  });
});
