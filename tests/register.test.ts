import { describe, expect, it } from "vitest";
import { lookup, namesMatch, parseRegister, registerFacts } from "../lib/register";

// A made-up register in the real one's shape (the real one is never committed).
const REGISTER = parseRegister(`﻿name,usn,branch,branch_name,programme,year
Asha Rao,1HK12CS001,CSE,Computer Science & Engineering,B.Tech,2012
Mohammed Imran K,1HK12CS002,CSE,Computer Science & Engineering,B.Tech,2012
Mohammed Imran S,1HK12CS003,CSE,Computer Science & Engineering,B.Tech,2012
Priya Nair,1HK12EC001,ECE,Electronics & Communication,B.Tech,2012
Ravi Kumar,1HK12MBA01,GEN,General / MBA,MBA,2012
Asha Rao,1HK13CS001,CSE,Computer Science & Engineering,Mtech 2012 to 2015,2012`);

describe("the college register", () => {
  it("matches names the way people type them: initials optional, case and spacing ignored, one slip allowed", () => {
    expect(namesMatch("mohammed imran", "Mohammed Imran K")).toBe(true);
    expect(namesMatch("Asha  RAO", "Asha Rao")).toBe(true);
    expect(namesMatch("Mohamed Imran", "Mohammed Imran K")).toBe(true); // one letter off
    expect(namesMatch("Asha Rai", "Asha Rao")).toBe(false); // short words must be exact
    expect(namesMatch("Priya", "Asha Rao")).toBe(false);
  });

  it("finds you by USN and name, which must agree", () => {
    const found = lookup(REGISTER, { usn: "1hk12 cs001", name: "Asha Rao" });
    expect(found.status).toBe("found");
    if (found.status === "found") {
      expect(found).toMatchObject({ branch: "CSE", joined: 2012 });
      // Her batch is the B.Tech CSE students who joined in 2012, not the M.Tech ones.
      expect(found.batchSize).toBe(3);
    }
    // A USN alone, with someone else's name, finds nothing: the register can't be read by USN.
    expect(lookup(REGISTER, { usn: "1HK12CS001", name: "Priya Nair" }).status).toBe("not-found");
  });

  it("finds you by name, branch and year, and asks for a USN when that fits more than one person", () => {
    expect(lookup(REGISTER, { name: "Priya Nair", branch: "ECE", year: 2012 }).status).toBe("found");
    expect(lookup(REGISTER, { name: "Mohammed Imran", branch: "CSE", year: 2012 }).status).toBe("ambiguous");
    expect(lookup(REGISTER, { name: "Priya Nair", branch: "CSE", year: 2012 }).status).toBe("not-found");
  });

  it("calls MBA students' branch MBA, and says only its size, span and branches in public", () => {
    const facts = registerFacts(REGISTER);
    expect(facts).toMatchObject({ count: 6, from: 2012, to: 2012 });
    expect(facts.branches.map((b) => b.name)).toContain("MBA");
    expect(JSON.stringify(facts)).not.toMatch(/Asha|1HK/);
  });
});
