"use server";

import { z } from "zod";
import { BRANCHES } from "../branches";
import { peopleHref } from "../people-href";
import { askAi, memberText } from "../server/ai";
import { cleanTag } from "../tags";
import { actor } from "./common";

/*
 * The three AI helpers, as the pages call them. Each only suggests: a search to run, or
 * words for the member to read and choose to use. Everything the AI answers is checked and
 * cut to size here again before it reaches the page.
 */

type Answer<T> = { ok: true } & T;
type Failed = { ok: false; error: string };

const SIGNED_OUT: Failed = { ok: false, error: "Log in to use the AI helper." };
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

// ---------- 1. Network: a search in plain English ----------

const CODES = BRANCHES.map(([code]) => code) as [string, ...string[]];

const SearchShape = z.object({
  words: z.array(z.string()),
  branch: z.enum([...CODES, "any"]),
  joinedYear: z.number().int(),
  help: z.enum(["mentor", "refer", "talk", "any"]),
  summary: z.string()
});

const SEARCH_TASK = `Turn a member's search for people into Alumnity's Network filters.
- words: 0 to 3 key words, each matched against a member's name, job title, company, city and skills (every word must match). Use only specific words: a company (Infosys), a city (Bengaluru), a skill (Python), a job word (data, product, embedded). Leave out general words such as alumni, seniors, students, people, HKBK, college, working, who, in, at, find, show.
- branch: one of ${BRANCHES.map(([c, n]) => `${c} (${n})`).join(", ")}, or "any".
- joinedYear: the year they joined HKBK, or 0 for any. A batch written "2012" or "2012-16" joined in 2012; "graduated in 2016" from B.E./B.Tech joined in 2012.
- help: "mentor" if they want mentors or guidance, "refer" for job referrals, "talk" for people happy to chat, otherwise "any".
- summary: one short sentence saying what will be searched for, e.g. "Mentors in Bengaluru who work in data".`;

export async function aiPeopleSearchAction(sentence: string): Promise<Answer<{ href: string; summary: string }> | Failed> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const said = clip(sentence, 300).trim();
  if (said.length < 3) return { ok: false, error: "Type what kind of people you're looking for." };
  const answer = await askAi(me, SEARCH_TASK, memberText("search", said), SearchShape);
  if (!answer.ok) return answer;
  const a = answer.value;
  // Only words the search itself understands (letters, numbers, + # .), three at most.
  const words = a.words
    .flatMap((w) => w.toLowerCase().split(/[^a-z0-9+#.]+/))
    .filter((w) => w.length >= 2 && w.length <= 30)
    .slice(0, 3);
  const year = a.joinedYear >= 1997 && a.joinedYear <= new Date().getFullYear() ? a.joinedYear : undefined;
  const href = peopleHref({
    q: words.join(" "),
    branch: a.branch !== "any" ? a.branch : undefined,
    year,
    help: a.help !== "any" ? a.help : undefined
  });
  return { ok: true, href, summary: clip(a.summary, 160) };
}

// ---------- 2. Ask a senior: a clearer question ----------

const AskShape = z.object({ title: z.string(), details: z.string(), topics: z.array(z.string()) });

const ASK_TASK = `Help a student ask a senior (an HKBK alumnus) a clear, polite question.
- title: the question in one line, at most 120 characters, ending with a question mark.
- details: 2 to 5 short sentences a senior needs to help: what the student is aiming for, what they've tried, where they're stuck. Use only what the student wrote. Where something useful is missing, leave a short gap in square brackets for the student to fill, such as [your branch and year] or [what you have tried so far]. Never make up facts about the student.
- topics: 1 to 4 short topic words, e.g. Placements, Java, Higher studies.
Keep the student's own meaning. Don't answer the question.`;

export async function aiAskHelpAction(input: { title: string; details: string; topics: string }): Promise<Answer<{ title: string; details: string; topics: string }> | Failed> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const title = clip(input.title, 140).trim();
  const details = clip(input.details, 2000).trim();
  if ((title + details).length < 5) return { ok: false, error: "Write a few words about your question first." };
  const answer = await askAi(
    me,
    ASK_TASK,
    [memberText("question", title), memberText("details", details), memberText("topics", clip(input.topics, 200))].join("\n"),
    AskShape
  );
  if (!answer.ok) return answer;
  return {
    ok: true,
    title: clip(answer.value.title.trim(), 140),
    details: clip(answer.value.details.trim(), 2000),
    topics: answer.value.topics
      .map((t) => t.replace(/[,\s]+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ")
      .slice(0, 200)
  };
}

// ---------- 3. Posts: a polished draft ----------

const PostShape = z.object({ text: z.string(), hashtags: z.array(z.string()) });

const POST_TASK = `Polish a member's draft post for their alumni network feed.
- text: fix spelling and grammar and make it clear and friendly, in the member's own voice. Keep its meaning, its facts and roughly its length. Don't add facts, numbers, names, links or emojis that aren't there. Keep every word that starts with @ exactly as written (those are people being mentioned), and keep existing #tags.
- hashtags: 0 to 3 short topic words that fit the post (no # sign), e.g. placements, alumnimeet, internship.`;

/** The words starting with @ in a draft (mentions): each must survive the polish unchanged. */
const mentionsIn = (text: string) => [...text.matchAll(/@[\p{L}.]+/gu)].map((m) => m[0]);

export async function aiPostHelpAction(draft: string): Promise<Answer<{ text: string; hashtags: string[] }> | Failed> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const text = clip(draft, 2000).trim();
  if (text.length < 10) return { ok: false, error: "Write a little more first, then ask for help." };
  const answer = await askAi(me, POST_TASK, memberText("draft", text), PostShape);
  if (!answer.ok) return answer;
  const polished = clip(answer.value.text.trim(), 2000);
  const missing = mentionsIn(text).filter((m) => !polished.includes(m));
  if (!polished || missing.length) return { ok: false, error: "The AI helper changed who you mentioned, so we didn't use it. Try again." };
  const hashtags = [...new Set(answer.value.hashtags.flatMap((h) => cleanTag(h.replace(/^#/, "")) ?? []))].filter((h) => !polished.toLowerCase().includes(`#${h}`)).slice(0, 3);
  return { ok: true, text: polished, hashtags };
}
