import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Security: what members write is shown as text, never run as code. Pages are drawn by
 * React, which escapes text; the risks are links (an href of "javascript:…" runs when
 * clicked), anything put in as raw HTML, and text going into emails, spreadsheets and
 * calendar files. These draw real posts and pages with attack text in them and check
 * that nothing of it is live.
 */

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "xss-admin@example.com";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let profile: typeof import("../lib/server/profile");
let events: typeof import("../lib/server/events");

const ATTACKS = [
  "<script>alert(document.cookie)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "<a href=\"javascript:alert(1)\">click</a>",
  "javascript:alert(1)",
  "\"><iframe src=//evil.example>",
  "<style>body{display:none}</style>"
];
const ATTACK = ATTACKS.join(" ");

/** Live markup an attack would need: a tag it opened, or an href that runs code. */
function expectInert(html: string) {
  expect(html).not.toMatch(/<script>alert|<img src=x|<svg onload|<iframe src=\/\/evil|<style>body/i);
  // No event handler on a real tag: an attribute named on…, outside any quoted value
  // (escaped text has no "<" of its own to start a tag).
  for (const tag of html.match(/<[a-z][^>]*>/gi) ?? []) expect(tag.replace(/"[^"]*"/g, '""')).not.toMatch(/\son[a-z]+\s*=/i);
  expect(html).not.toMatch(/href="\s*(javascript|data|vbscript):/i);
  expect(html).not.toMatch(/src="\s*(javascript|data:text\/html)/i);
}

let n = 0;
async function member(name: string, extra: { email?: string; role?: string } = {}): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', 2012, ?, ?) returning id",
    extra.email ?? `xss${n}@example.com`,
    name,
    extra.role ?? "alumnus",
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  profile = await import("../lib/server/profile");
  events = await import("../lib/server/events");
});

describe("what members write, on the page", () => {
  it("a post, its comments, its mentions and tags draw as text", async () => {
    const { Post } = await import("../components/social/post");
    // A member whose very name is an attack (names come from the register, but still).
    const writer = await member("<img src=x onerror=alert('name')>");
    const reader = await member("Rita Reader");
    const made = await posts.createPost(writer, `${ATTACK} #job @[<script>x</script>](${reader.id}) @[Fake](999999)`, "everyone");
    expect((await posts.addComment(reader, made.id!, ATTACK)).ok).toBe(true);
    const shared = await posts.repost(reader, made.id!, ATTACK);
    for (const id of [made.id!, shared.id!]) {
      const post = (await posts.postFor(reader, id))!;
      const html = renderToStaticMarkup(<Post post={post} photos={new Map()} me={reader} full />);
      expectInert(html);
      expect(html).toContain("&lt;script&gt;alert(document.cookie)&lt;/script&gt;");
    }
    // The mention's name is the member's real one (the server rewrote it), still as text.
    expect((await posts.postFor(reader, made.id!))!.body).toContain(`@[Rita Reader](${reader.id})`);
  });

  it("a message's links are only web addresses and Alumnity's own pages", async () => {
    const { MessageText } = await import("../components/social/message-text");
    const html = renderToStaticMarkup(<MessageText body={`${ATTACK} see /notes/12 and javascript:alert(2) data:text/html,<script>alert(3)</script>`} />);
    expectInert(html);
    expect(html).toContain('href="/notes/12"');
  });

  it("a page's links must be web addresses: javascript: and data: are refused when saved", async () => {
    const me = await member("Link Person");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "javascript://%0aalert(1)"]) {
      const asWebsite = await profile.parseProfile({ links: { website: bad } }, me.id);
      if (!("error" in asWebsite)) expect(asWebsite.profile.links.website).toMatch(/^https?:\/\//);
      const asLinkedin = await profile.parseProfile({ links: { linkedin: bad } }, me.id);
      expect("error" in asLinkedin).toBe(true);
      const inSection = await profile.parseProfile({ sections: { projects: [{ title: "A project", link: bad }] } }, me.id);
      if (!("error" in inSection)) expect(inSection.profile.sections.projects?.[0].link ?? "").toMatch(/^(https?:\/\/|$)/);
    }
  });

  it("someone's page draws their words as text", async () => {
    const { ProfileSheet } = await import("../components/profile/profile-sheet");
    const owner = await member("Page Owner");
    const parsed = await profile.parseProfile(
      {
        title: ATTACKS[0],
        company: ATTACKS[1],
        city: ATTACKS[2],
        about: ATTACK,
        skills: ATTACKS,
        journey: [{ year: 2015, text: ATTACKS[3] }],
        links: { website: "https://example.com/\"><script>alert(1)</script>" },
        sections: { projects: [{ title: ATTACKS[1], detail: ATTACK, link: "https://example.com" }] }
      },
      owner.id
    );
    if ("error" in parsed) throw new Error(parsed.error);
    const html = renderToStaticMarkup(
      <ProfileSheet person={{ id: owner.id, name: owner.name, branch: "CSE", branchName: "CSE", programme: "B.Tech", joined: 2012, role: "alumnus" }} profile={parsed.profile} isOwner={false} />
    );
    expectInert(html);
    expect(html).toContain("&lt;script&gt;");
  });

  it("an event's online link must be a web address", async () => {
    const organiser = await member("Event Organiser", { role: "faculty" });
    for (const link of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com"]) {
      expect((await events.createEvent(organiser, { title: ATTACK, body: ATTACK, startsAt: "2031-02-01T10:00", endsAt: "", place: "Online", onlineLink: link, capacity: "" })).ok).toBe(false);
    }
  });

  it("notification links can only lead within Alumnity", async () => {
    const { safeNext } = await import("../lib/safe-next");
    for (const link of ["javascript:alert(1)", "//evil.example", "/\\evil.example", "https://evil.example", "data:text/html,x"]) expect(safeNext(link)).toBe("/home");
    expect(safeNext("/notes/12#comments")).toBe("/notes/12#comments");
  });
});

describe("what members write, elsewhere", () => {
  it("emails escape it", async () => {
    const { letter } = await import("../lib/server/mail");
    const { html } = letter({ greeting: `Dear ${ATTACKS[0]},`, lines: [ATTACK], button: { text: ATTACKS[1], href: "https://example.com/\"><script>alert(1)</script>" }, footer: ATTACKS[2] });
    expectInert(html);
    expect(html).toContain("&lt;script&gt;");
  });

  it("spreadsheets never run it as a formula", async () => {
    const desk = await import("../lib/server/desk");
    const causes = await import("../lib/server/causes");
    const admin = await member("Xss Admin", { email: "xss-admin@example.com" });
    const author = await member("=HYPERLINK(\"http://evil.example\",\"Click\")");
    const made = await causes.proposeCause(author, { title: "=cmd|' /C calc'!A0", story: "w".repeat(80), goal: "5000", cover: "", days: "30" });
    expect((await causes.reviewCause(admin, made.id!, true, "")).ok).toBe(true);
    await db.db().run(
      "insert into donations (cause_id, donor, amount, order_id, payment_id, status, paid_at, created_at) values (?, ?, 1000, '+order', '@pay', 'paid', ?, ?)",
      made.id!,
      author.id,
      Date.now(),
      Date.now()
    );
    await desk.audit(admin, "=1+1", "-2+3", "@SUM(1)");
    for (const csv of [await causes.donationsCsv(admin), await desk.auditCsv(admin)]) {
      for (const line of csv!.split("\r\n").slice(1)) {
        for (const cell of line.match(/"(?:[^"]|"")*"/g) ?? []) expect(cell).not.toMatch(/^"[=+\-@]/);
      }
    }
  });

  it("a calendar file can't be given extra lines", async () => {
    const event = { id: 1, organiser: null, title: "Meet\r\nATTENDEE:mailto:evil@example.com", body: "x\nBEGIN:VALARM", startsAt: Date.now(), endsAt: null, place: "Hall;A,B", onlineLink: null, capacity: null, cancelled: false, going: 0, imGoing: false, mine: false };
    const ics = events.eventIcs(event, "https://alumnity.example");
    expect(ics.split("\r\n").some((line) => line.startsWith("ATTENDEE") || line.startsWith("BEGIN:VALARM"))).toBe(false);
  });

  it("notifications carry names as plain text for the bell, push and email", async () => {
    const a = await member("<b>Bold</b> Name");
    const b = await member("Plain Name");
    expect((await social.requestConnection(a, b.id, ATTACK)).ok).toBe(true);
    const note = (await social.notificationsFor(b.id))[0];
    expect(note.link).toBe("/connections");
    const { letter } = await import("../lib/server/mail");
    expectInert(letter({ greeting: "Hi", lines: [note.text], footer: "" }).html);
  });
});
