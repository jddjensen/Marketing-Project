import { describe, it, expect } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts a canonical lowercase v4 UUID", () => {
    expect(isUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(isUuid("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  it("rejects strings with the wrong shape", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("f47ac10b58cc4372a5670e02b2c3d479")).toBe(false); // no dashes
    expect(isUuid("f47ac10b-58cc-4372-a567")).toBe(false); // truncated
  });

  it("rejects non-hex characters", () => {
    expect(isUuid("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});
