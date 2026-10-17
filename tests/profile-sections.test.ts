import { describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";

const { parseProfile, profileFor } = await import("../lib/server/profile");

const owner = { id: 1, branch: "CSE", joined: 2012 };
const batchmate = { id: 2, branch: "CSE", joined: 2012 };
const stranger = { id: 3, branch: "ECE", joined: 2015 };

async function parse(sections: unknown, sectionsVisibility: unknown = {}) {
  const out = await parseProfile({ sections, sectionsVisibility });
  if ("error" in out) throw new Error(out.error);
  return out.profile;
}

describe("the sections someone adds to their page", () => {
  it("keeps what's filled in, cleaned, newest first; drops blank entries and empty sections", async () => {
    const p = await parse({
      experience: [
        { title: "  Intern ", org: "Infosys", from: 2019, to: 2019 },
        { title: "Engineer", org: "Zoho", from: 2021, current: true, to: 2023 },
        { title: "", org: "Blank" }
      ],
      projects: [{ title: "" }],
      languages: [{ title: "Kannada", org: "Mother tongue" }],
      honours: [{ title: "First prize", from: 1800 }]
    });
    expect(p.sections.experience).toEqual([
      { title: "Engineer", org: "Zoho", from: 2021, to: null, current: true, link: "", detail: "" },
      { title: "Intern", org: "Infosys", from: 2019, to: 2019, current: false, link: "", detail: "" }
    ]);
    expect(p.sections.projects).toBeUndefined();
    // A language's level is one of the list's; anything else becomes "Fluent".
    expect(p.sections.languages?.[0].org).toBe("Fluent");
    // A year out of range isn't kept.
    expect(p.sections.honours?.[0].from).toBeNull();
  });

  it("refuses a link that isn't a web address", async () => {
    const out = await parseProfile({ sections: { projects: [{ title: "Bot", link: "javascript:alert(1)" }] } });
    expect("error" in out).toBe(true);
  });

  it("shows each section only to those its owner chose", async () => {
    const p = await parse(
      { experience: [{ title: "Engineer", org: "Zoho", from: 2021 }], education: [{ title: "M.Tech", org: "IISc", from: 2016, to: 2018 }] },
      { experience: "everyone", education: "batch" }
    );
    expect(Object.keys(profileFor(owner, owner, p).sections).sort()).toEqual(["education", "experience"]);
    expect(Object.keys(profileFor(batchmate, owner, p).sections).sort()).toEqual(["education", "experience"]);
    const seen = profileFor(stranger, owner, p);
    expect(Object.keys(seen.sections)).toEqual(["experience"]);
    // Nor does anyone but the owner learn how each section is set.
    expect(seen.sectionsVisibility.education).toBe("everyone");
  });
});
