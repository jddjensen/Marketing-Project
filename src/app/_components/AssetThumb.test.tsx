import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { rgbaToThumbHash } from "thumbhash";
import { AssetThumb } from "./AssetThumb";

// A valid base64 ThumbHash for a small solid image, matching what the server /
// client produce at upload time.
function sampleThumbhash(): string {
  const w = 32;
  const h = 24;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 30;
    rgba[i + 1] = 120;
    rgba[i + 2] = 200;
    rgba[i + 3] = 255;
  }
  const hash = rgbaToThumbHash(w, h, rgba);
  let binary = "";
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe("AssetThumb", () => {
  it("renders a lazy main image plus a hidden ThumbHash placeholder", () => {
    render(
      <AssetThumb
        src="https://example.test/y.webp"
        thumbhash={sampleThumbhash()}
        alt="hero creative"
      />
    );
    const main = screen.getByAltText("hero creative");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("loading", "lazy");
    expect(main).toHaveAttribute("src", "https://example.test/y.webp");

    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    const placeholder = imgs.find(
      (i) => i.getAttribute("aria-hidden") !== null
    );
    expect(placeholder?.getAttribute("src") ?? "").toMatch(/^data:image\/png/);
  });

  it("omits the placeholder and shows the image when there is no thumbhash", () => {
    render(<AssetThumb src="https://example.test/z.webp" alt="no hash" />);
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByAltText("no hash").className).toContain("opacity-100");
  });

  it("supports eager loading and contain fit", () => {
    render(
      <AssetThumb
        src="https://example.test/a.webp"
        alt="eager"
        eager
        fit="contain"
      />
    );
    const main = screen.getByAltText("eager");
    expect(main).toHaveAttribute("loading", "eager");
    expect(main.className).toContain("object-contain");
  });

  it("falls back gracefully on an invalid thumbhash", () => {
    render(
      <AssetThumb
        src="https://example.test/b.webp"
        thumbhash="!!!not-base64!!!"
        alt="bad hash"
      />
    );
    // Decode failed → no placeholder, just the main image.
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByAltText("bad hash")).toBeInTheDocument();
  });
});
