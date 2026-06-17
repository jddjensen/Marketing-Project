import { describe, expect, it } from "vitest";
import {
  buildPostizPostPayload,
  filterPostizIntegrationsForPlatform,
  normalizePostizBaseUrl,
  type PostizIntegration,
} from "./postiz";

const instagram: PostizIntegration = {
  id: "ig-1",
  name: "Aquarium Instagram",
  identifier: "instagram",
};

describe("normalizePostizBaseUrl", () => {
  it("uses the cloud API base by default", () => {
    expect(normalizePostizBaseUrl(undefined)).toBe("https://api.postiz.com");
  });

  it("accepts a full public API URL and normalizes it to the instance base", () => {
    expect(
      normalizePostizBaseUrl("https://postiz.example.com/public/v1/")
    ).toBe("https://postiz.example.com");
  });
});

describe("filterPostizIntegrationsForPlatform", () => {
  it("maps the Meta board to Facebook and Instagram providers", () => {
    expect(
      filterPostizIntegrationsForPlatform(
        [
          instagram,
          { id: "fb-1", name: "Facebook", identifier: "facebook" },
          { id: "tt-1", name: "TikTok", identifier: "tiktok" },
        ],
        "meta"
      ).map((item) => item.identifier)
    ).toEqual(["instagram", "facebook"]);
  });

  it("omits disabled channels", () => {
    expect(
      filterPostizIntegrationsForPlatform(
        [{ ...instagram, disabled: true }],
        "meta"
      )
    ).toEqual([]);
  });
});

describe("buildPostizPostPayload", () => {
  it("builds an Instagram story payload with tracking appended", () => {
    const payload = buildPostizPostPayload({
      platform: "meta",
      integration: instagram,
      copy: { primaryText: "Come see the new exhibit." },
      media: { id: "media-1", path: "https://uploads.example.com/image.jpg" },
      publishAt: "2026-07-01T15:00:00.000Z",
      titleFallback: "story.jpg",
      trackingUrl: "https://marketing.example.com/go/abc",
      slotKey: "stories-reels",
    });

    expect(payload.posts[0].settings).toEqual({
      __type: "instagram",
      post_type: "story",
    });
    expect(payload.posts[0].value[0].content).toContain(
      "https://marketing.example.com/go/abc"
    );
    expect(payload.posts[0].value[0].image[0].id).toBe("media-1");
  });

  it("keeps YouTube uploads private by default", () => {
    const payload = buildPostizPostPayload({
      platform: "youtube",
      integration: { id: "yt-1", name: "YouTube", identifier: "youtube" },
      copy: { title: "Jellies After Dark", tags: ["aquarium", "events"] },
      media: null,
      publishAt: "2026-07-01T15:00:00.000Z",
      titleFallback: "video.mp4",
    });

    expect(payload.posts[0].settings).toMatchObject({
      __type: "youtube",
      title: "Jellies After Dark",
      type: "private",
      selfDeclaredMadeForKids: "no",
    });
  });
});
