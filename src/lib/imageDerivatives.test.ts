// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { thumbHashToRGBA } from "thumbhash";
import {
  generateImageDerivatives,
  sha256Hex,
  THUMB_MAX_EDGE,
} from "./imageDerivatives";

async function samplePng(width = 240, height = 140): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("generateImageDerivatives", () => {
  it("produces a WebP thumbnail capped at THUMB_MAX_EDGE and a decodable ThumbHash", async () => {
    const png = await samplePng(800, 400);
    const derived = await generateImageDerivatives(png);
    expect(derived).not.toBeNull();

    // WebP container magic bytes: "RIFF"...."WEBP".
    expect(derived!.thumb.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(derived!.thumb.subarray(8, 12).toString("ascii")).toBe("WEBP");

    const meta = await sharp(derived!.thumb).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      THUMB_MAX_EDGE
    );

    // ThumbHash is base64 and round-trips through the decoder.
    const bytes = Buffer.from(derived!.thumbhash, "base64");
    expect(bytes.length).toBeGreaterThan(4);
    const rgba = thumbHashToRGBA(new Uint8Array(bytes));
    expect(rgba.w).toBeGreaterThan(0);
    expect(rgba.h).toBeGreaterThan(0);
  });

  it("does not enlarge images already smaller than the cap", async () => {
    const png = await samplePng(64, 48);
    const derived = await generateImageDerivatives(png);
    const meta = await sharp(derived!.thumb).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(48);
  });

  it("returns null for input sharp cannot decode", async () => {
    const derived = await generateImageDerivatives(
      Buffer.from("definitely not an image")
    );
    expect(derived).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("returns a deterministic 64-char hex digest", () => {
    const a = sha256Hex(Buffer.from("hello"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(sha256Hex(Buffer.from("hello")));
    expect(a).not.toBe(sha256Hex(Buffer.from("world")));
  });
});
