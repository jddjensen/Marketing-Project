import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { apiError, parseJsonBody } from "./apiError";

const fakeReq = (json: () => Promise<unknown>) =>
  ({ json }) as unknown as NextRequest;

describe("apiError", () => {
  it("returns the { error } envelope with the given status", async () => {
    const res = apiError("nope", 418);
    expect(res.status).toBe(418);
    await expect(res.json()).resolves.toEqual({ error: "nope" });
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({
    name: z.string().min(1, "is required"),
    age: z.number().int().optional(),
  });

  it("returns typed data for a valid body", async () => {
    const r = await parseJsonBody(
      fakeReq(async () => ({ name: "ada", age: 36 })),
      schema
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ name: "ada", age: 36 });
  });

  it("400s with a field-prefixed message on schema failure", async () => {
    const r = await parseJsonBody(
      fakeReq(async () => ({ name: "" })),
      schema
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      await expect(r.response.json()).resolves.toEqual({
        error: "name: is required",
      });
    }
  });

  it("400s on malformed JSON", async () => {
    const r = await parseJsonBody(
      fakeReq(async () => {
        throw new SyntaxError("unexpected token");
      }),
      schema
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      await expect(r.response.json()).resolves.toEqual({
        error: "body must be valid JSON",
      });
    }
  });
});
