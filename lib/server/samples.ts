import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import type { User } from "./auth";
import { removeMedia, saveUpload } from "./media";
import { EMPTY_PROFILE, saveProfile } from "./profile";

/*
 * Development only: clearly made-up members ("… Sample", users.sample = 1) so every page
 * has someone on it while it's built and tried out. They have no Supabase account, so
 * nobody can sign in as them, and password reset ignores them. Removing them
 * removes everything they made (the database cascades).
 */

type Sample = { first: string; branch: string; branchName: string; joined: number; role: "alumnus" | "student" | "faculty"; title: string; company: string; city: string; skills: string[]; mentor: boolean };

const SAMPLES: Sample[] = [
  { first: "Aarav", branch: "CSE", branchName: "Computer Science & Engineering", joined: 2008, role: "alumnus", title: "Engineering manager", company: "a product company", city: "Bengaluru", skills: ["Careers", "Interviews", "Java"], mentor: true },
  { first: "Meera", branch: "CSE", branchName: "Computer Science & Engineering", joined: 2012, role: "alumnus", title: "Data scientist", company: "a bank", city: "Hyderabad", skills: ["Python", "Data", "Higher studies"], mentor: true },
  { first: "Kabir", branch: "ECE", branchName: "Electronics & Communication", joined: 2010, role: "alumnus", title: "VLSI engineer", company: "a chip design firm", city: "Bengaluru", skills: ["VLSI", "Embedded", "Placements"], mentor: true },
  { first: "Sana", branch: "ISE", branchName: "Information Science & Engineering", joined: 2014, role: "alumnus", title: "Product designer", company: "a startup", city: "Pune", skills: ["Design", "Portfolio", "Freelancing"], mentor: true },
  { first: "Rohit", branch: "MECH", branchName: "Mechanical Engineering", joined: 2006, role: "alumnus", title: "Plant head", company: "a manufacturing company", city: "Chennai", skills: ["Manufacturing", "Six Sigma", "Careers"], mentor: false },
  { first: "Fatima", branch: "CIVIL", branchName: "Civil Engineering", joined: 2011, role: "alumnus", title: "Site engineer", company: "an infrastructure firm", city: "Dubai", skills: ["Construction", "Working abroad"], mentor: true },
  { first: "Nikhil", branch: "CSE", branchName: "Computer Science & Engineering", joined: 2016, role: "alumnus", title: "Software engineer", company: "a cloud company", city: "Bengaluru", skills: ["React", "Cloud", "Interviews"], mentor: true },
  { first: "Ayesha", branch: "ECE", branchName: "Electronics & Communication", joined: 2015, role: "alumnus", title: "MS student", company: "a university abroad", city: "Germany", skills: ["Higher studies", "GRE", "Scholarships"], mentor: true },
  { first: "Zaid", branch: "CSE", branchName: "Computer Science & Engineering", joined: 2023, role: "student", title: "Student", company: "", city: "Bengaluru", skills: ["Web", "DSA"], mentor: false },
  { first: "Priya", branch: "ISE", branchName: "Information Science & Engineering", joined: 2024, role: "student", title: "Student", company: "", city: "Bengaluru", skills: ["Python"], mentor: false },
  { first: "Imran", branch: "MECH", branchName: "Mechanical Engineering", joined: 2022, role: "student", title: "Student", company: "", city: "Bengaluru", skills: ["CAD"], mentor: false },
  { first: "Lakshmi", branch: "CSE", branchName: "Computer Science & Engineering", joined: 1998, role: "faculty", title: "Professor", company: "HKBK College of Engineering", city: "Bengaluru", skills: ["Networks", "Research"], mentor: true }
];

const NOTES = [
  { by: 0, audience: "everyone", body: "Hiring two freshers for backend roles this quarter. If you're in your final year, ask me how our interviews work." },
  { by: 1, audience: "everyone", body: "Wrote up the three things I wish I knew before my MS applications. Happy to share; ask me." },
  { by: 3, audience: "everyone", body: "Batch of 2014 ISE — anyone up for a reunion in December?" },
  { by: 11, audience: "everyone", body: "The department's project expo is next month. Alumni judges welcome." }
] as const;

/** Photo posts by sample members, using the college's own gallery photos (development only). */
const PHOTO_POSTS = [
  { by: 0, body: "So proud of the Class of 2025! Graduation Day at HKBK, and the hall was full. Congratulations to every one of you.", photos: ["graduation-day-2025/01.jpg"] },
  { by: 3, body: "The alumni meet was so good. Some of us hadn't seen each other in ten years.", photos: ["alumni-meets/02.jpg", "alumni-meets/03.jpg", "alumni-meets/05.jpg"] },
  { by: 9, body: "Onam on campus! The pookalam took all morning.", photos: ["onam-2025/01.jpg"] },
  { by: 11, body: "Our students at the Cyber Security Conclave. Alumni in security: we'd love you to come and speak next year.", photos: ["cyber-security-conclave-2025/01.jpg"] },
  { by: 2, body: "Sports Day memories. Who else was on the relay team?", photos: ["sports-day/01.jpg", "sports-day/02.jpg", "sports-day/03.jpg", "sports-day/04.jpg"] }
];

/** Stories by sample members (they last a day, so re-add the samples to see them again). */
const STORIES = [
  { by: 1, photo: "around-campus-2024-25/01.jpg", caption: "Back on campus after twelve years" },
  { by: 6, photo: "swagatha-2025/02.jpg", caption: "Swagatha 2025: welcome, freshers!" },
  { by: 7, photo: "independence-day-2025/01.jpg", caption: "" }
];

/** A gallery photo, uploaded as `userId`'s own (development only). */
async function galleryUpload(userId: number, file: string, use: "post" | "story"): Promise<string | null> {
  try {
    const saved = await saveUpload(userId, use, new Uint8Array(readFileSync(join(process.cwd(), "public", "assets", "gallery", file))));
    return saved.ok ? saved.media.id : null;
  } catch {
    return null; // a missing photo just means a post without it
  }
}

export const sampleCount = async () => (await db().one<{ n: number }>("select count(*) as n from users where sample = 1"))?.n ?? 0;

/** Adds the sample members (once), a few notes and an event, and has two of them ask to connect with `me`. */
export async function addSamples(me: User | null): Promise<number> {
  if (process.env.NODE_ENV === "production") throw new Error("Sample members are for development only.");
  if ((await sampleCount()) > 0) return 0;
  const d = db();
  const now = Date.now();
  const ids: number[] = [];
  for (const [i, s] of SAMPLES.entries()) {
    // No Supabase account (auth_id is null), so nobody can sign in as them.
    const row = await d.one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, sample, created_at) values (?, ?, ?, ?, 'B.Tech', ?, ?, 1, ?) returning id",
      `sample-${i + 1}@example.invalid`,
      `${s.first} Sample`,
      s.branch,
      s.branchName,
      s.joined,
      s.role,
      now - (SAMPLES.length - i) * 3_600_000
    );
    const id = row!.id;
    await saveProfile(id, {
      ...structuredClone(EMPTY_PROFILE),
      title: s.title,
      company: s.company,
      city: s.city,
      skills: s.skills,
      about: `Sample member for trying Alumnity out (not a real person). ${s.title}${s.company ? ` at ${s.company}` : ""}.`,
      happyTo: { mentor: s.mentor, refer: s.role === "alumnus", talk: true }
    });
    ids.push(id);
  }
  // A few connections among them.
  for (const [a, b] of [[0, 1], [0, 6], [1, 7], [2, 7], [3, 9], [6, 8]]) {
    await d.run("insert into connections (requester, addressee, status, created_at, responded_at) values (?, ?, 'accepted', ?, ?)", ids[a], ids[b], now, now);
  }
  for (const [i, note] of NOTES.entries()) {
    await d.run("insert into posts (author, body, audience, created_at) values (?, ?, ?, ?)", ids[note.by], note.body, note.audience, now - i * 5_400_000);
  }
  // Photo posts, a few reactions and comments (one with a mention), and stories.
  const reactions = ["cheer", "proud", "congrats", "support", "insightful"];
  for (const [i, p] of PHOTO_POSTS.entries()) {
    const row = await d.one<{ id: number }>("insert into posts (author, body, audience, created_at) values (?, ?, 'everyone', ?) returning id", ids[p.by], p.body, now - (i + 1) * 2_700_000);
    const postId = row!.id;
    for (const [position, file] of p.photos.entries()) {
      const media = await galleryUpload(ids[p.by], file, "post");
      if (media) await d.run("insert into post_media (post_id, media_id, position) values (?, ?, ?)", postId, media, position);
    }
    for (const [k, uid] of ids.entries()) {
      if (uid !== ids[p.by] && (k + i) % 3 !== 0) {
        await d.run("insert into post_cheers (post_id, user_id, kind) values (?, ?, ?) on conflict do nothing", postId, uid, reactions[(k + i) % reactions.length]);
      }
    }
    if (i === 0) {
      await d.run("insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)", postId, ids[1], "What a day. Congratulations to everyone!", now - 2_000_000);
      await d.run(
        "insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)",
        postId,
        ids[8],
        `Next year that's us! @[Aarav Sample](${ids[0]}) any tips for final year?`,
        now - 1_500_000
      );
    }
  }
  for (const s of STORIES) {
    const media = await galleryUpload(ids[s.by], s.photo, "story");
    if (media) {
      await d.run("insert into stories (author, media_id, caption, created_at, expires_at) values (?, ?, ?, ?, ?)", ids[s.by], media, s.caption, now - 3_600_000, now + 20 * 3_600_000);
    }
  }

  await d.run(
    "insert into events (organiser, title, body, starts_at, place, capacity, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    ids[11],
    "Alumni talk: life after HKBK (sample)",
    "A sample event: three alumni on their first five years after college, then questions.",
    now + 9 * 24 * 3_600_000,
    "Seminar hall, HKBK College of Engineering",
    120,
    now
  );
  if (me) {
    // You follow the three with stories, so the stories row has someone in it.
    for (const s of STORIES) await d.run("insert into follows (follower, followee, created_at) values (?, ?, ?) on conflict do nothing", me.id, ids[s.by], now);
    for (const i of [0, 3]) {
      await d.run(
        "insert into connections (requester, addressee, status, note, created_at) values (?, ?, 'pending', ?, ?) on conflict do nothing",
        ids[i],
        me.id,
        "Sample request, to try accepting.",
        now
      );
      await d.run(
        "insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, 'connect-request', ?, '/connections', ?)",
        me.id,
        ids[i],
        `${SAMPLES[i].first} Sample would like to connect.`,
        now
      );
    }
  }
  return ids.length;
}

/** Removes every sample member and all they made. */
export async function removeSamples(): Promise<number> {
  if (process.env.NODE_ENV === "production") throw new Error("Sample members are for development only.");
  // Their uploaded files go too, not just the rows.
  for (const m of await db().all<{ id: string; user_id: number }>("select media.id, media.user_id from media join users on users.id = media.user_id where users.sample = 1")) {
    await removeMedia(m.user_id, m.id);
  }
  return db().run("delete from users where sample = 1");
}
