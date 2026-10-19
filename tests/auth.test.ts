import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres, a made-up register and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";

type Auth = typeof import("../lib/server/auth");
let auth: Auth;
let fake: import("../lib/server/auth-provider").FakeAuth;
let db: typeof import("../lib/server/db").db;

beforeAll(async () => {
  auth = await import("../lib/server/auth");
  fake = await (await import("../lib/server/auth-provider")).fakeAuth();
  db = (await import("../lib/server/db")).db;
  for (const [name, usn, branch, branchName, year] of [
    ["Asha Rao", "1HK12CS001", "CSE", "Computer Science & Engineering", 2012],
    ["Priya Nair", "1HK12EC001", "ECE", "Electronics & Communication", 2012],
    ["Ravi Kumar", "1HK24CS009", "CSE", "Computer Science & Engineering", 2024]
  ] as const) {
    await db().run("insert into register (name, usn, branch, branch_name, programme, year) values (?, ?, ?, ?, 'B.Tech', ?)", name, usn, branch, branchName, year);
  }
});

const PASSWORD = "lanterns over the quad";

/** Joins all the way through, on the current browser. */
async function join(name: string, usn: string, email: string, password: string, ip: string) {
  const start = await auth.startJoin({ name, usn, email, ip });
  if (!start.ok) throw new Error(start.error);
  expect((await auth.checkJoinCode(start.ticket, fake.lastCode(email)!)).ok).toBe(true);
  return auth.completeJoin(start.ticket, password);
}

describe("accounts", () => {
  it("joins: register line → emailed code → password → signed in; one USN, one account", async () => {
    fake.use("asha-laptop");
    const start = await auth.startJoin({ name: "Asha Rao", usn: "1HK12CS001", email: "Asha@Example.com", ip: "1" });
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const code = fake.lastCode("asha@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect((await auth.checkJoinCode(start.ticket, code === "000000" ? "111111" : "000000")).ok).toBe(false);
    // Not signed in to anything yet, so there's no account to finish.
    expect((await auth.completeJoin(start.ticket, PASSWORD)).ok).toBe(false);
    expect((await auth.checkJoinCode(start.ticket, code!)).ok).toBe(true);
    expect((await auth.completeJoin(start.ticket, "short")).ok).toBe(false);
    const done = await auth.completeJoin(start.ticket, PASSWORD);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.user).toMatchObject({ email: "asha@example.com", usn: "1HK12CS001", role: "alumnus" });
    expect((await auth.signedInUser())?.name).toBe("Asha Rao");
    // The ticket can't be used twice, and the same line can't join again.
    expect((await auth.completeJoin(start.ticket, PASSWORD)).ok).toBe(false);
    const again = await auth.startJoin({ name: "Asha Rao", usn: "1HK12CS001", email: "other@example.com", ip: "2" });
    expect(again.ok).toBe(false);
  });

  it("joining with someone's email looks the same, but no code is sent", async () => {
    fake.use("someone-else");
    const before = fake.sent.length;
    const start = await auth.startJoin({ name: "Priya Nair", branch: "ECE", year: 2012, email: "asha@example.com", ip: "3" });
    expect(start.ok).toBe(true); // looks the same as a real start…
    expect(fake.sent.length).toBe(before); // …but no code goes anywhere
    if (start.ok) expect((await auth.checkJoinCode(start.ticket, "123456")).ok).toBe(false);
  });

  it("a code can't be used for someone else's sign-up", async () => {
    fake.use("mallory");
    const theirs = await auth.startJoin({ name: "Priya Nair", usn: "1HK12EC001", email: "priya@example.com", ip: "4" });
    const mine = await auth.startJoin({ name: "Ravi Kumar", usn: "1HK24CS009", email: "mallory@example.com", ip: "4" });
    if (!theirs.ok || !mine.ok) throw new Error("start failed");
    // Mallory's own code, against Priya's ticket: it's checked for Priya's email, so it's wrong.
    expect((await auth.checkJoinCode(theirs.ticket, fake.lastCode("mallory@example.com")!)).ok).toBe(false);
  });

  it("knows students from alumni by the register's joining year", async () => {
    fake.use("ravi-phone");
    const done = await join("Ravi Kumar", "1HK24CS009", "ravi@example.com", "ravens and rainclouds", "5");
    expect(done.ok && done.user.role).toBe("student");
  });

  it("locks a code after five wrong tries", async () => {
    fake.use("priya-phone");
    const start = await auth.startJoin({ name: "Priya Nair", usn: "1HK12EC001", email: "priya@example.com", ip: "6" });
    if (!start.ok) throw new Error(start.error);
    const right = fake.lastCode("priya@example.com")!;
    const wrong = right === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await auth.checkJoinCode(start.ticket, wrong);
    expect(await auth.checkJoinCode(start.ticket, right)).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });

  it("logs in with email and password, saying the same thing for a wrong email or a wrong password", async () => {
    fake.use("asha-phone");
    const wrongPassword = await auth.logIn("asha@example.com", "not the password", "7");
    const wrongEmail = await auth.logIn("nobody@example.com", PASSWORD, "7");
    expect(wrongPassword).toEqual(wrongEmail);
    expect(await auth.signedInUser()).toBeNull();
    const ok = await auth.logIn(" ASHA@example.com ", PASSWORD, "7");
    expect(ok.ok).toBe(true);
    expect((await auth.signedInUser())?.email).toBe("asha@example.com");
  });

  it("a Supabase account with no member behind it (a join never finished) can't log in", async () => {
    fake.use("half");
    await fake.sendCode("half@example.com", true);
    await fake.verifyCode("half@example.com", fake.lastCode("half@example.com")!);
    await fake.setPassword(PASSWORD);
    await fake.signOut("local");
    expect((await auth.logIn("half@example.com", PASSWORD, "8")).ok).toBe(false);
    expect(await auth.signedInUser()).toBeNull();
  });

  it("resets a forgotten password with an emailed code, and signs out every other browser", async () => {
    fake.use("asha-phone");
    expect(await auth.signedInUser()).not.toBeNull();

    fake.use("asha-library");
    // An email with no account gets the same answer, and no code.
    const before = fake.sent.length;
    expect((await auth.startReset("ghost@example.com", "9")).ok).toBe(true);
    expect(fake.sent.length).toBe(before);

    const start = await auth.startReset("asha@example.com", "9");
    if (!start.ok) throw new Error(start.error);
    const code = fake.lastCode("asha@example.com")!;
    expect((await auth.completeReset(start.ticket, code, "password123")).ok).toBe(false); // too common: the code isn't spent
    const done = await auth.completeReset(start.ticket, code, "a quieter, longer phrase");
    expect(done.ok).toBe(true);
    expect((await auth.signedInUser())?.email).toBe("asha@example.com");
    fake.use("asha-phone");
    expect(await auth.signedInUser()).toBeNull();
    expect((await auth.logIn("asha@example.com", PASSWORD, "10")).ok).toBe(false);
    expect((await auth.logIn("asha@example.com", "a quieter, longer phrase", "10")).ok).toBe(true);
  });

  it("changing the password needs the current one, and signs out the other browsers", async () => {
    fake.use("asha-phone");
    const me = (await auth.signedInUser())!;
    fake.use("asha-tablet");
    await auth.logIn("asha@example.com", "a quieter, longer phrase", "11");
    fake.use("asha-phone");
    expect((await auth.changePassword(me, "wrong one", "a brand new long phrase")).ok).toBe(false);
    expect((await auth.changePassword(me, "a quieter, longer phrase", "a brand new long phrase")).ok).toBe(true);
    expect(await auth.signedInUser()).not.toBeNull(); // this browser stays in
    fake.use("asha-tablet");
    expect(await auth.signedInUser()).toBeNull();
  });

  it("a member signed out everywhere by the desk is turned away, even holding a token", async () => {
    fake.use("ravi-phone");
    const ravi = (await auth.signedInUser())!;
    expect(ravi).not.toBeNull();
    // The stand-in keeps the session (as an access token would live on until it expires),
    // from a sign-in a minute ago…
    const session = { ...fake.browsers.get("ravi-phone")!, authAt: Date.now() - 60_000 };
    await auth.signOutMember(ravi.id);
    fake.browsers.set("ravi-phone", session);
    // …but it was signed in before the sign-out, so it no longer counts.
    expect(await auth.signedInUser()).toBeNull();
  });

  it("paused members can't log in", async () => {
    await db().run("update users set suspended_at = ? where email = 'ravi@example.com'", Date.now());
    fake.use("ravi-laptop");
    expect(await auth.logIn("ravi@example.com", "ravens and rainclouds", "12")).toMatchObject({ ok: false, error: expect.stringMatching(/paused/) });
    expect(await auth.signedInUser()).toBeNull();
  });

  it("deleting an account needs the password, and removes the member and their sign-in", async () => {
    fake.use("asha-phone");
    const me = (await auth.signedInUser())!;
    expect((await auth.deleteAccount(me, "wrong")).ok).toBe(false);
    expect((await auth.deleteAccount(me, "a brand new long phrase")).ok).toBe(true);
    expect(await db().one("select 1 from users where email = 'asha@example.com'")).toBeUndefined();
    expect(fake.accounts.has("asha@example.com")).toBe(false);
  });

  it("slows down repeated tries", async () => {
    fake.use("guesser");
    for (let i = 0; i < 10; i++) await auth.logIn("priya@example.com", "wrong guess here", "13");
    expect(await auth.logIn("priya@example.com", "anything at all", "13")).toMatchObject({ ok: false, error: expect.stringMatching(/tried too many times/) });
  });
});
