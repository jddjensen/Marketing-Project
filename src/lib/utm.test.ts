import { describe, it, expect } from "vitest";
import {
  buildUtmUrl,
  formatCreativeUtmTag,
  platformUtmBase,
  slugify,
} from "./utm";

describe("platformUtmBase", () => {
  it("normalizes platform keys to snake_case alphanumerics", () => {
    expect(platformUtmBase("meta")).toBe("meta");
    expect(platformUtmBase("google-search")).toBe("google_search");
    expect(platformUtmBase("digital-signage")).toBe("digital_signage");
  });
});

describe("formatCreativeUtmTag", () => {
  it("omits the sequence number for the first creative", () => {
    expect(formatCreativeUtmTag("meta", 1)).toBe("meta");
  });

  it("appends the sequence number for subsequent creatives", () => {
    expect(formatCreativeUtmTag("meta", 2)).toBe("meta2");
    expect(formatCreativeUtmTag("google-search", 7)).toBe("google_search7");
  });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with underscores", () => {
    expect(slugify("Summer Sale 2026!")).toBe("summer_sale_2026");
    expect(slugify("  Brand X / Brand Y  ")).toBe("brand_x_brand_y");
  });

  it("returns an empty string for input with no usable characters", () => {
    expect(slugify("!!! --- ###")).toBe("");
  });
});

describe("buildUtmUrl", () => {
  const baseLink = {
    id: "abc-123",
    url: "https://example.com/landing",
    platform: "meta" as const,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
  };

  it("applies platform defaults for source and medium when overrides are missing", () => {
    const out = new URL(buildUtmUrl(baseLink, "Spring Launch"));
    expect(out.searchParams.get("utm_source")).toBe("facebook");
    expect(out.searchParams.get("utm_medium")).toBe("paid_social");
    expect(out.searchParams.get("utm_campaign")).toBe("spring_launch");
    expect(out.searchParams.get("mt_link_id")).toBe("abc-123");
  });

  it("prefers explicit overrides over platform defaults", () => {
    const out = new URL(
      buildUtmUrl(
        { ...baseLink, utmSource: "ig_stories", utmMedium: "story" },
        "Spring Launch"
      )
    );
    expect(out.searchParams.get("utm_source")).toBe("ig_stories");
    expect(out.searchParams.get("utm_medium")).toBe("story");
  });

  it("prepends https:// when the URL is bare", () => {
    expect(buildUtmUrl({ ...baseLink, url: "example.com" }, "Promo")).toContain(
      "https://example.com/"
    );
  });

  it("returns empty string for non-http(s) schemes", () => {
    expect(
      buildUtmUrl({ ...baseLink, url: "javascript:alert(1)" }, "Promo")
    ).toBe("");
    expect(
      buildUtmUrl({ ...baseLink, url: "ftp://example.com" }, "Promo")
    ).toBe("");
  });

  it("returns empty string for unparsable input", () => {
    expect(buildUtmUrl({ ...baseLink, url: "" }, "Promo")).toBe("");
    expect(buildUtmUrl({ ...baseLink, url: "   " }, "Promo")).toBe("");
  });

  it("preserves existing query params on the URL", () => {
    const out = new URL(
      buildUtmUrl(
        { ...baseLink, url: "https://example.com/?ref=blog" },
        "Spring"
      )
    );
    expect(out.searchParams.get("ref")).toBe("blog");
    expect(out.searchParams.get("utm_source")).toBe("facebook");
  });

  it("skips empty UTM values without writing blank params", () => {
    const out = new URL(
      buildUtmUrl(
        { ...baseLink, utmTerm: "   ", utmContent: "" },
        "Spring Launch"
      )
    );
    expect(out.searchParams.has("utm_term")).toBe(false);
    expect(out.searchParams.has("utm_content")).toBe(false);
  });
});
