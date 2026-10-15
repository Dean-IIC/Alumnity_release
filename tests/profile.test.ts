import { describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";

const { canSee, parseProfile, profileFor, EMPTY_PROFILE } = await import("../lib/server/profile");

const owner = { id: 1, branch: "CSE", joined: 2012 };
const batchmate = { id: 2, branch: "CSE", joined: 2012 };
const stranger = { id: 3, branch: "ECE", joined: 2015 };

describe("member pages", () => {
  it("shows each part only to who it's meant for, and hides the rest on the server", async () => {
    const parsed = await parseProfile({
      title: "Engineer",
      company: "Example Co",
      about: "Hello",
      skills: "Java, java, SQL",
      links: { linkedin: "linkedin.com/in/someone" },
      visibility: { now: "everyone", about: "batch", links: "me" }
    });
    if ("error" in parsed) throw new Error(parsed.error);
    const p = parsed.profile;
    expect(p.skills).toEqual(["Java", "SQL"]); // duplicates dropped, whatever the case
    expect(p.links.linkedin).toBe("https://linkedin.com/in/someone");

    const seenByBatch = profileFor(batchmate, owner, p);
    expect(seenByBatch).toMatchObject({ title: "Engineer", about: "Hello" });
    expect(seenByBatch.links.linkedin).toBe("");

    const seenByStranger = profileFor(stranger, owner, p);
    expect(seenByStranger.title).toBe("Engineer");
    expect(seenByStranger.about).toBe("");
    // Nobody else learns the owner's visibility choices.
    expect(seenByStranger.visibility).toEqual(EMPTY_PROFILE.visibility);

    expect(profileFor(owner, owner, p).links.linkedin).toBe("https://linkedin.com/in/someone");
    expect(canSee(null, owner, "everyone")).toBe(false); // pages are for members
  });

  it("refuses links that aren't what they say, and anything but http(s)", async () => {
    expect(await parseProfile({ links: { linkedin: "https://evil.example/in/x" } })).toHaveProperty("error");
    expect(await parseProfile({ links: { website: "javascript:alert(1)" } })).toHaveProperty("error");
    expect(await parseProfile({ links: { website: "mysite.dev" } })).toMatchObject({ profile: { links: { website: "https://mysite.dev/" } } });
  });

  it("keeps text within its limits", async () => {
    const parsed = await parseProfile({ title: "x".repeat(500), about: "y".repeat(5000), skills: Array.from({ length: 30 }, (_, i) => `skill ${i}`) });
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.profile.title).toHaveLength(80);
    expect(parsed.profile.about).toHaveLength(600);
    expect(parsed.profile.skills).toHaveLength(12);
  });
});
