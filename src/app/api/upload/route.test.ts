// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

import { POST } from "./route";

beforeEach(() => getUser.mockReset());

describe("POST /api/upload — guards", () => {
  it("401s when unauthenticated (before reading the body)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST({} as unknown as NextRequest);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("400s when the request is not multipart/form-data", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = {
      formData: async () => {
        throw new TypeError("not form data");
      },
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "request must be multipart/form-data",
    });
  });

  it("400s when no file is provided", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = {
      formData: async () => new FormData(),
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "file is required" });
  });
});
