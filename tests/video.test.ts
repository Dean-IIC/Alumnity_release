import { describe, expect, it } from "vitest";
import { parseVideoLink } from "../lib/video";

describe("video links", () => {
  it("reads YouTube links in every common form, and plays them in the no-cookies player", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=KaP7sshv8yQ",
      "https://www.youtube.com/watch?v=KaP7sshv8yQ&pp=0gcJCdgAo7VqN5tD",
      "https://m.youtube.com/watch?feature=share&v=KaP7sshv8yQ",
      "https://youtu.be/KaP7sshv8yQ?si=abc",
      "https://www.youtube.com/live/KaP7sshv8yQ"
    ]) {
      const v = parseVideoLink(url);
      expect(v.provider).toBe("youtube");
      expect(v.id).toBe("KaP7sshv8yQ");
      expect(v.shape).toBe("wide");
      expect(v.embed).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/KaP7sshv8yQ\?/);
    }
    expect(parseVideoLink("https://youtube.com/shorts/KaP7sshv8yQ").shape).toBe("tall");
  });

  it("reads Instagram posts and reels, with or without the account name", () => {
    expect(parseVideoLink("https://www.instagram.com/reel/DeQqbNPDHXE/?igsh=x").embed).toBe("https://www.instagram.com/reel/DeQqbNPDHXE/embed/");
    expect(parseVideoLink("https://www.instagram.com/hkbkgroupofficial/reel/DeQqbNPDHXE/").id).toBe("DeQqbNPDHXE");
    expect(parseVideoLink("https://www.instagram.com/p/Dd0gsZaMuNB/").embed).toBe("https://www.instagram.com/p/Dd0gsZaMuNB/embed/");
    expect(parseVideoLink("https://instagram.com/reels/DeQqbNPDHXE").embed).toContain("/reel/DeQqbNPDHXE/");
  });

  it("reads Facebook videos, watch links, reels and share links", () => {
    const page = parseVideoLink("https://www.facebook.com/hkbkedu/videos/1234567890123456/");
    expect(page.provider).toBe("facebook");
    expect(page.id).toBe("1234567890123456");
    expect(decodeURIComponent(page.embed)).toContain("href=https://www.facebook.com/watch/?v=1234567890123456");
    expect(parseVideoLink("https://www.facebook.com/watch/?v=1234567890123456").id).toBe("1234567890123456");
    expect(parseVideoLink("https://www.facebook.com/reel/1234567890123456").shape).toBe("tall");
    expect(parseVideoLink("https://www.facebook.com/share/v/1AbCdEfGh/").id).toBe("1AbCdEfGh");
    expect(parseVideoLink("https://fb.watch/qWeRtY12/").id).toBe("qWeRtY12");
  });

  it("reads LinkedIn post links and feed links", () => {
    const post = parseVideoLink(
      "https://www.linkedin.com/posts/hkbk-college-of-engineering_swagatha2025-activity-7364000000000000000-AbCd?utm_source=share"
    );
    expect(post.provider).toBe("linkedin");
    expect(post.embed).toBe("https://www.linkedin.com/embed/feed/update/urn:li:activity:7364000000000000000");
    expect(parseVideoLink("https://www.linkedin.com/feed/update/urn:li:ugcPost:7364000000000000001/").embed).toBe(
      "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7364000000000000001"
    );
    expect(parseVideoLink("https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7364000000000000002").id).toBe("7364000000000000002");
  });

  it("refuses anything else, so a mistyped link fails the build instead of a page", () => {
    expect(() => parseVideoLink("https://vimeo.com/123")).toThrow(/YouTube, Instagram, Facebook or LinkedIn/);
    expect(() => parseVideoLink("https://www.youtube.com/@HKBKOfficialChannel")).toThrow();
    expect(() => parseVideoLink("not a link")).toThrow(/Not a link/);
  });
});
