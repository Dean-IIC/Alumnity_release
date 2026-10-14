import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway database, a made-up register and an outbox, set before the modules load.
const dir = mkdtempSync(join(tmpdir(), "alumnity-auth-"));
process.env.ALUMNITY_DB = join(dir, "test.db");
process.env.ALUMNITY_OUTBOX = join(dir, "outbox");
process.env.ALUMNITY_REGISTER = join(dir, "register.csv");
writeFileSync(
  process.env.ALUMNITY_REGISTER,
  `name,usn,branch,branch_name,programme,year
Asha Rao,1HK12CS001,CSE,Computer Science & Engineering,B.Tech,2012
Priya Nair,1HK12EC001,ECE,Electronics & Communication,B.Tech,2012
Ravi Kumar,1HK24CS009,CSE,Computer Science & Engineering,B.Tech,2024`
);

type Auth = typeof import("../lib/server/auth");
let auth: Auth;
beforeAll(async () => {
  auth = await import("../lib/server/auth");
});

/** The newest email to `to`, and the code in it. */
function lastMail(to: string) {
  const files = readdirSync(process.env.ALUMNITY_OUTBOX!).filter((f) => f.includes(to.replace(/[^a-z0-9@.]/gi, "_"))).sort();
  const mail = JSON.parse(readFileSync(join(process.env.ALUMNITY_OUTBOX!, files.at(-1)!), "utf8"));
  return { ...mail, code: (mail.text.match(/Your code: (\d{6})/) ?? [])[1] as string | undefined, count: files.length };
}

const PASSWORD = "lanterns over the quad";

describe("accounts", () => {
  it("joins: register line → emailed code → password → signed in; one USN, one account", async () => {
    const start = await auth.startJoin({ name: "Asha Rao", usn: "1HK12CS001", email: "Asha@Example.com", ip: "1" });
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const mail = lastMail("asha@example.com");
    expect(mail.code).toMatch(/^\d{6}$/);
    expect(auth.checkCode(start.ticket, "000000" === mail.code ? "111111" : "000000", "join").ok).toBe(false);
    expect(auth.checkCode(start.ticket, mail.code!, "join").ok).toBe(true);
    expect((await auth.completeJoin(start.ticket, "short")).ok).toBe(false);
    const done = await auth.completeJoin(start.ticket, PASSWORD);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.user).toMatchObject({ email: "asha@example.com", usn: "1HK12CS001", role: "alumnus" });
    expect(auth.userForSession(done.token)?.name).toBe("Asha Rao");
    // The ticket can't be used twice, and the same line can't join again.
    expect((await auth.completeJoin(start.ticket, PASSWORD)).ok).toBe(false);
    const again = await auth.startJoin({ name: "Asha Rao", usn: "1HK12CS001", email: "other@example.com", ip: "2" });
    expect(again.ok).toBe(false);
  });

  it("joining with someone's email tells its owner, not the visitor", async () => {
    const before = lastMail("asha@example.com").count;
    const start = await auth.startJoin({ name: "Priya Nair", branch: "ECE", year: 2012, email: "asha@example.com", ip: "3" });
    expect(start.ok).toBe(true); // looks the same as a real start…
    const mail = lastMail("asha@example.com");
    expect(mail.count).toBe(before + 1);
    expect(mail.subject).toMatch(/tried to join/);
    expect(mail.code).toBeUndefined(); // …but no code is sent, so it goes nowhere
  });

  it("knows students from alumni by the register's joining year", async () => {
    const start = await auth.startJoin({ name: "Ravi Kumar", usn: "1HK24CS009", email: "ravi@example.com", ip: "4" });
    if (!start.ok) throw new Error(start.error);
    auth.checkCode(start.ticket, lastMail("ravi@example.com").code!, "join");
    const done = await auth.completeJoin(start.ticket, "ravens and rainclouds");
    expect(done.ok && done.user.role).toBe("student");
  });

  it("locks a code after five wrong tries", async () => {
    const start = await auth.startJoin({ name: "Priya Nair", usn: "1HK12EC001", email: "priya@example.com", ip: "5" });
    if (!start.ok) throw new Error(start.error);
    const right = lastMail("priya@example.com").code!;
    const wrong = right === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) auth.checkCode(start.ticket, wrong, "join");
    expect(auth.checkCode(start.ticket, right, "join")).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });

  it("logs in with email and password, saying the same thing for a wrong email or a wrong password", async () => {
    const wrongPassword = await auth.logIn("asha@example.com", "not the password", "6");
    const wrongEmail = await auth.logIn("nobody@example.com", PASSWORD, "6");
    expect(wrongPassword).toEqual(wrongEmail);
    const ok = await auth.logIn(" ASHA@example.com ", PASSWORD, "6");
    expect(ok.ok).toBe(true);
  });

  it("resets a forgotten password with an emailed code, and signs out every other browser", async () => {
    const before = await auth.logIn("asha@example.com", PASSWORD, "7");
    if (!before.ok) throw new Error(before.error);

    // An email with no account gets the same answer, and no email.
    const ghost = await auth.startReset("ghost@example.com", "7");
    expect(ghost.ok).toBe(true);
    expect(readdirSync(process.env.ALUMNITY_OUTBOX!).some((f) => f.includes("ghost"))).toBe(false);

    const start = await auth.startReset("asha@example.com", "7");
    if (!start.ok) throw new Error(start.error);
    const code = lastMail("asha@example.com").code!;
    expect((await auth.completeReset(start.ticket, code, "password123")).ok).toBe(false); // too common: try again
    const done = await auth.completeReset(start.ticket, code, "a quieter, longer phrase");
    expect(done.ok).toBe(true);
    expect(auth.userForSession(before.token)).toBeNull();
    expect((await auth.logIn("asha@example.com", PASSWORD, "8")).ok).toBe(false);
    expect((await auth.logIn("asha@example.com", "a quieter, longer phrase", "8")).ok).toBe(true);
  });

  it("slows down repeated tries", async () => {
    const results = [];
    for (let i = 0; i < 10; i++) results.push((await auth.logIn("asha@example.com", "wrong guess here", "9")).ok);
    const last = await auth.logIn("asha@example.com", "a quieter, longer phrase", "9");
    expect(last).toMatchObject({ ok: false, error: expect.stringMatching(/a lot of tries/) });
  });
});
