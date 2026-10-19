import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres, the stand-in for Supabase Auth, and uploads in a scratch folder.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_UPLOADS = mkdtempSync(join(tmpdir(), "alumnity-card-"));

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let card: typeof import("../lib/alumni-card");
let server: typeof import("../lib/server/alumni-card");
let image: typeof import("../lib/server/alumni-card-image");
let qr: typeof import("../lib/qr");
let GET: typeof import("../app/(member)/me/card/route").GET;
let n = 0;

const USN = "1HK12CS042";
const JOINED_ALUMNITY = Date.UTC(2025, 5, 1);

async function member(name: string, usn: string | null, role = "alumnus"): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, usn, branch, branch_name, programme, joined, role, auth_id, created_at) values (?, ?, ?, 'CSE', 'Computer Science and Engineering', 'B.Tech', 2012, ?, ?::uuid, ?) returning id",
    `card${n}@example.com`,
    name,
    usn,
    role,
    crypto.randomUUID(),
    JOINED_ALUMNITY + n
  );
  return (await people.memberById(row!.id))!;
}

/** Signs `who` in on the fake auth (or nobody), then asks for /me/card. */
async function fetchCard(who: U | null, query = "") {
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  if (who) {
    const authId = (await db.db().one<{ auth_id: string }>("select auth_id from users where id = ?", who.id))!.auth_id;
    auth.accounts.set(who.email, { authId, password: "a long test password", code: null });
    auth.use(`browser-${who.id}`);
    await auth.signInWithPassword(who.email, "a long test password");
  } else {
    auth.use("nobody-signed-in");
  }
  try {
    return await GET(new Request(`http://localhost/me/card${query}`));
  } finally {
    auth.use("main");
  }
}

/** Everything in a React element tree that would be drawn or sent, as one string. */
const flatten = (node: unknown) => JSON.stringify(node);

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  card = await import("../lib/alumni-card");
  server = await import("../lib/server/alumni-card");
  image = await import("../lib/server/alumni-card-image");
  qr = await import("../lib/qr");
  ({ GET } = await import("../app/(member)/me/card/route"));
});

describe("the member number", () => {
  it("is ALM- and the account id, six digits at least", () => {
    expect(card.memberNumber(1)).toBe("ALM-000001");
    expect(card.memberNumber(123)).toBe("ALM-000123");
    expect(card.memberNumber(1234567)).toBe("ALM-1234567");
    for (const id of [1, 42, 999999, 1000000]) expect(card.memberNumber(id)).toMatch(card.MEMBER_NUMBER);
  });

  it("is never the USN", async () => {
    const u = await member("Asha Rao", USN);
    const c = await server.cardFor(u, "https://alumnity.example");
    expect(c.memberNo).toBe(card.memberNumber(u.id));
    expect(c.memberNo).not.toContain(USN);
  });
});

describe("what goes on the card", () => {
  it("carries no USN and no email, only the fields a card shows", async () => {
    const u = await member("Bharath Kumar", USN.replace("042", "043"));
    const c = await server.cardFor(u, "https://alumnity.example");
    expect(Object.keys(c).sort()).toEqual(["batch", "department", "initials", "link", "memberNo", "name", "photoId", "role", "shortLink", "since"]);
    const all = flatten(c);
    expect(all).not.toContain(u.usn!);
    expect(all).not.toContain(u.email);
    expect(c).toMatchObject({
      name: "Bharath Kumar",
      role: "Alumnus",
      department: "Computer Science and Engineering",
      batch: "Batch 2012–16",
      since: 2025,
      link: `https://alumnity.example/people/${u.id}`,
      shortLink: `alumnity.example/people/${u.id}`
    });
  });

  it("draws no USN or email on either side of the image", async () => {
    const u = await member("Chitra Shenoy", USN.replace("042", "044"));
    const c = await server.cardFor(u, "https://alumnity.example");
    for (const side of [image.CardFrontImage({ card: c, photo: null, crest: null }), image.CardBackImage({ card: c, crest: null })]) {
      const drawn = flatten(side);
      expect(drawn).toContain(c.memberNo);
      expect(drawn).not.toContain(u.usn!);
      expect(drawn).not.toContain(u.email);
    }
  });

  it("names staff by their role, with no batch", () => {
    const c = card.alumniCard({ id: 7, name: "Dr. K. Asha Rao", role: "faculty", branch: "ECE", branchName: null, programme: null, joined: null }, { since: 2026, photoId: null, origin: "http://localhost:3000/" });
    expect(c).toMatchObject({ role: "Faculty", department: "ECE", batch: null, link: "http://localhost:3000/people/7", shortLink: "localhost:3000/people/7" });
  });
});

describe("/me/card", () => {
  it("needs you to be signed in", async () => {
    const response = await fetchCard(null);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).not.toContain("image");
  });

  it("draws your own card as a PNG, kept private", async () => {
    const u = await member("Deepa Nair", USN.replace("042", "045"));
    for (const query of ["", "?side=back&download=1"]) {
      const response = await fetchCard(u, query);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("content-disposition")).toContain(card.memberNumber(u.id).toLowerCase());
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  }, 60_000);
});

describe("the QR code", () => {
  it("is a square grid of the right size, with the three corner squares", () => {
    const m = qr.qrModules("https://alumnity.example/people/123");
    const size = m.length;
    expect((size - 17) % 4).toBe(0);
    expect(m.every((row) => row.length === size)).toBe(true);
    // A finder square: dark ring, light ring, dark 3×3 centre.
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      expect(m[y][x] && m[y][x + 6] && m[y + 6][x] && m[y + 6][x + 6]).toBe(true);
      expect(m[y + 1][x + 1]).toBe(false);
      expect(m[y + 3][x + 3]).toBe(true);
    }
    expect(qr.qrModules("https://alumnity.example/people/123")).toEqual(m);
  });

  it("grows with the text, and refuses what won't fit", () => {
    expect(qr.qrModules("x").length).toBe(21);
    expect(qr.qrModules("a".repeat(200)).length).toBe(57);
    expect(() => qr.qrModules("a".repeat(400))).toThrow();
  });
});
