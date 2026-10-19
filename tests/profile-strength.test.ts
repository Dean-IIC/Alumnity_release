import { describe, expect, it } from "vitest";
import type { Role } from "../lib/server/auth";
import type { Profile } from "../lib/server/profile";
import { profileStrength, strengthItems, strengthLevel } from "../lib/profile-strength";

process.env.ALUMNITY_DB = "pglite";

// Only the empty page is needed from here; nothing is read from the database.
const { EMPTY_PROFILE } = await import("../lib/server/profile");

const ROLES: Role[] = ["student", "alumnus", "faculty", "coordinator", "admin", "superadmin"];

const empty = (): Profile => structuredClone(EMPTY_PROFILE);

/** A page with everything filled in, for anyone. */
function full(): Profile {
  return {
    ...empty(),
    photo: { id: "photo-1", kind: "image" },
    title: "Backend engineer",
    company: "Zoho",
    city: "Bengaluru",
    about: "I build payment systems and still miss the canteen.",
    skills: ["Java", "System design", "Placements"],
    happyTo: { mentor: true, refer: false, talk: false },
    seeking: { mentor: true, internship: false, referral: false },
    links: { linkedin: "https://www.linkedin.com/in/someone/", website: "" },
    sections: {
      experience: [{ title: "Engineer", org: "Zoho", from: 2019, to: null, current: true, link: "", detail: "" }],
      projects: [{ title: "Canteen app", org: "", from: 2022, to: null, current: false, link: "", detail: "" }]
    }
  };
}

describe("profile strength", () => {
  it("adds up to exactly 100 for every role, with no item counted twice", () => {
    for (const role of ROLES) {
      const items = strengthItems(role);
      expect(items.reduce((sum, i) => sum + i.weight, 0), role).toBe(100);
      expect(new Set(items.map((i) => i.key)).size, role).toBe(items.length);
      for (const i of items) {
        expect(i.weight, `${role} ${i.key}`).toBeGreaterThan(0);
        // Every item links to the field that fills it.
        expect(i.href, `${role} ${i.key}`).toMatch(/^\/me\/edit#edit-[a-z-]+$/);
      }
    }
  });

  it("is 0% on an empty page, with everything left, the biggest gains first", () => {
    for (const role of ROLES) {
      const s = profileStrength({ role }, empty());
      expect(s.percent).toBe(0);
      expect(s.done).toEqual([]);
      expect(s.missing).toHaveLength(strengthItems(role).length);
      const weights = s.missing.map((m) => m.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    }
    expect(profileStrength({ role: "alumnus" }, empty()).missing[0]).toMatchObject({ key: "photo", label: "Add a photo", weight: 15 });
  });

  it("is 100% on a full page, with nothing left", () => {
    for (const role of ROLES) {
      const s = profileStrength({ role }, full());
      expect(s.percent, role).toBe(100);
      expect(s.missing, role).toEqual([]);
    }
    expect(strengthLevel(100)).toBe("Complete");
  });

  it("counts what fits the role: a student what they're looking for, an alumnus what they're happy to do", () => {
    const keys = (role: Role) => strengthItems(role).map((i) => i.key);
    expect(keys("student")).toContain("seeking");
    expect(keys("student")).not.toContain("happyTo");
    expect(keys("alumnus")).toContain("happyTo");
    expect(keys("alumnus")).not.toContain("seeking");
    // Staff work at HKBK: they aren't asked where.
    expect(keys("faculty")).not.toContain("company");
    expect(keys("faculty")).toContain("happyTo");

    // Ticking "happy to mentor" counts for an alumnus, and nothing for a student.
    const helping = { ...empty(), happyTo: { mentor: true, refer: false, talk: false } };
    expect(profileStrength({ role: "alumnus" }, helping).percent).toBe(10);
    expect(profileStrength({ role: "student" }, helping).percent).toBe(0);
    const looking = { ...empty(), seeking: { mentor: false, internship: true, referral: false } };
    expect(profileStrength({ role: "student" }, looking).percent).toBe(10);
    expect(profileStrength({ role: "alumnus" }, looking).percent).toBe(0);

    // A project fills a student's background, not an alumnus's (theirs is experience or education).
    const project = { ...empty(), sections: { projects: full().sections.projects! } };
    expect(profileStrength({ role: "student" }, project).done.map((i) => i.key)).toEqual(["background"]);
    expect(profileStrength({ role: "alumnus" }, project).percent).toBe(0);
  });

  it("wants three skills, and doesn't count blanks", () => {
    expect(profileStrength({ role: "alumnus" }, { ...empty(), skills: ["Java", "SQL"] }).percent).toBe(0);
    expect(profileStrength({ role: "alumnus" }, { ...empty(), skills: ["Java", "SQL", "Go"] }).percent).toBe(15);
    expect(profileStrength({ role: "alumnus" }, { ...empty(), title: "   ", about: " " }).percent).toBe(0);
  });

  it("gives a word for how far along it is", () => {
    expect(strengthLevel(0)).toBe("Getting started");
    expect(strengthLevel(39)).toBe("Getting started");
    expect(strengthLevel(40)).toBe("Good");
    expect(strengthLevel(70)).toBe("Strong");
    expect(strengthLevel(95)).toBe("Strong");
  });
});
