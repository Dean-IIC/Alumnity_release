"use server";

import type { ActionState } from "../action-state";
import {
  deleteRegisterLine,
  describeAudience,
  importRegister,
  readAudience,
  saveMemberRecord,
  saveRegisterLine,
  sendMailoutBatch,
  startMailout,
  testMail,
  type Audience
} from "../server/hq";
import { actor, answer, idFrom, SIGNED_OUT, textFrom } from "./common";

/* HQ's buttons (/hq). The rules (lib/server/hq.ts) check for a super administrator every time. */

async function origin() {
  const { headers } = await import("next/headers");
  const h = await headers();
  return process.env.SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

const lineFrom = (form: FormData) => ({
  name: textFrom(form, "name", 200),
  usn: textFrom(form, "usn", 30),
  branch: textFrom(form, "branch", 10),
  programme: textFrom(form, "programme", 40),
  year: Number(textFrom(form, "year", 6))
});

export async function saveRegisterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const id = idFrom(form);
  return answer(await saveRegisterLine(me, id || null, lineFrom(form)), id ? "Saved." : "Added to the register.");
}

export async function deleteRegisterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  return answer(await deleteRegisterLine(me, idFrom(form)), "Deleted from the register.");
}

const n = (x: number) => x.toLocaleString("en-IN");

export async function importRegisterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a CSV file first." };
  if (file.size > 3_000_000) return { ok: false, error: "That file is too big (at most 3 MB)." };
  const apply = textFrom(form, "mode", 10) === "apply";
  const done = await importRegister(me, await file.text(), apply);
  if (!done.ok) return done;
  const r = done.report;
  const summary = `${n(r.added)} new, ${n(r.changed)} changed, ${n(r.same)} the same, ${n(r.skipped.length)} skipped.`;
  const skipped = r.skipped.length ? ` Skipped: ${r.skipped.slice(0, 15).join(" · ")}${r.skipped.length > 15 ? " …" : ""}` : "";
  if (!apply) return { ok: true, message: `Checked, nothing changed yet: ${summary}${skipped} Press "Import" to apply.` };
  return answer({ ok: true }, `Imported: ${summary}${skipped}`);
}

export async function saveMemberRecordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const joined = Number(textFrom(form, "joined", 6));
  return answer(
    await saveMemberRecord(me, idFrom(form), {
      name: textFrom(form, "name", 200),
      usn: textFrom(form, "usn", 30),
      branch: textFrom(form, "branch", 10),
      programme: textFrom(form, "programme", 40),
      joined: joined > 0 ? joined : null
    }),
    "Saved."
  );
}

const audienceFrom = (form: FormData): Audience =>
  readAudience(
    JSON.stringify({
      who: textFrom(form, "who", 20),
      branch: textFrom(form, "branch", 10) || undefined,
      year: Number(textFrom(form, "year", 6)) || undefined,
      skipOptedOut: form.get("everyone") !== "1"
    })
  );

/** "Send me a test", or start the real thing and send its first batch. */
export async function mailAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const subject = textFrom(form, "subject", 200);
  const body = textFrom(form, "body", 12_000);
  const site = await origin();
  if (textFrom(form, "mode", 10) !== "send") return answer(await testMail(me, subject, body, site), `Test sent to ${me.email}. Check how it looks before sending to everyone.`);
  const a = audienceFrom(form);
  const started = await startMailout(me, subject, body, a);
  if (!started.ok) return started;
  const first = await sendMailoutBatch(me, started.id, site);
  if (!first.ok) return first;
  return answer(
    { ok: true },
    `Started (${describeAudience(a)}): ${n(first.sent)} sent${first.failed ? `, ${n(first.failed)} failed` : ""}. ${first.left ? `${n(first.left)} still to send: press "Send the next batch" below.` : "All sent."}`
  );
}

export async function mailBatchAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await actor();
  if (!me) return SIGNED_OUT;
  const done = await sendMailoutBatch(me, idFrom(form), await origin());
  if (!done.ok) return done;
  return answer({ ok: true }, `${n(done.sent)} sent${done.failed ? `, ${n(done.failed)} failed` : ""}. ${done.left ? `${n(done.left)} still to send.` : "All sent."}`);
}
