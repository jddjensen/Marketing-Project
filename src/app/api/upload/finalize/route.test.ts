// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

import { POST } from "./route";

beforeEach(() => getUser.mockReset());

describe("POST /api/upload/finalize — guards + zod body", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST({} as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it("400s on malformed JSON via the shared parseJsonBody helper", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = {
      json: async () => {
        throw new SyntaxError("unexpected token");
      },
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "body must be valid JSON",
    });
  });

  it("400s on a schema-invalid body (missing required fields)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = { json: async () => ({}) } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  it("400s when thumbhash exceeds the 80-char cap", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = {
      json: async () => ({
        projectId: "00000000-0000-0000-0000-000000000000",
        platform: "meta",
        ratio: "1-1",
        storagePath: "p/meta/1-1/x.mp4",
        fileName: "x.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        thumbhash: "x".repeat(81),
      }),
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
