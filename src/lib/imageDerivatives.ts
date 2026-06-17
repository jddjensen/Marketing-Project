import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import crypto from "crypto";

// Long edge of the generated grid thumbnail. Grids render small tiles, so a
// ~320px WebP is plenty and turns a multi-MB original into a ~10-40 KB fetch.
export const THUMB_MAX_EDGE = 320;
// ThumbHash needs a tiny RGBA bitmap; the algorithm only supports up to 100px
// per side.
const THUMBHASH_MAX_EDGE = 100;

export type ImageDerivatives = {
  /** WebP thumbnail bytes, ≤ THUMB_MAX_EDGE on the long edge. */
  thumb: Buffer;
  thumbContentType: "image/webp";
  thumbExt: ".thumb.webp";
  /** base64-encoded ThumbHash for an instant blurred placeholder. */
  thumbhash: string;
};

// Produce a grid thumbnail + ThumbHash from a decodable image buffer. Returns
// null if sharp can't process the input — callers treat derivatives as
// best-effort and fall back to serving the original.
export async function generateImageDerivatives(
  input: Buffer | Uint8Array
): Promise<ImageDerivatives | null> {
  try {
    // Two independent pipelines from the same source buffer (a sharp instance
    // can only be consumed once). `animated: false` keeps GIFs to their first
    // frame so the thumbnail is a single still.
    const thumb = await sharp(input, { failOn: "none", animated: false })
      .rotate()
      .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 72 })
      .toBuffer();

    const { data, info } = await sharp(input, {
      failOn: "none",
      animated: false,
    })
      .rotate()
      .resize(THUMBHASH_MAX_EDGE, THUMBHASH_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return {
      thumb,
      thumbContentType: "image/webp",
      thumbExt: ".thumb.webp",
      thumbhash: Buffer.from(hash).toString("base64"),
    };
  } catch {
    return null;
  }
}

// sha256 (hex) of raw bytes, used as a content fingerprint for soft duplicate
// detection. Stable across uploads of the same source file.
export function sha256Hex(input: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
