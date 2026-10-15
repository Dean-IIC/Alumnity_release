import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { isLocalDev } from "../../../lib/server/dev-only";
import { outboxDir } from "../../../lib/server/mail";

/*
 * Development only: the emails Alumnity would have sent, newest first (until SMTP is set
 * up they're saved to .mail-outbox/ instead). Not part of the production site.
 */
export const dynamic = "force-dynamic";

export default async function DevMail() {
  if (!(await isLocalDev())) notFound();
  let mails: { file: string; to: string; subject: string; html: string; at: string }[] = [];
  try {
    const dir = outboxDir();
    mails = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 20)
      .map((file) => ({ file, ...JSON.parse(readFileSync(join(dir, file), "utf8")) }));
  } catch {
    // No outbox yet: nothing sent.
  }
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", fontFamily: "var(--font-ui)" }}>
      <h1 style={{ fontFamily: "var(--font-voice)", fontWeight: 400 }}>Outbox (development only)</h1>
      <p style={{ color: "var(--color-ink-muted)" }}>Emails Alumnity would have sent. Set SMTP in .env.local to send them for real.</p>
      {mails.length === 0 && <p>Nothing yet.</p>}
      {mails.map((m) => (
        <section key={m.file} style={{ margin: "24px 0", border: "1px solid var(--color-line)", borderRadius: 10, overflow: "hidden" }}>
          <p style={{ margin: 0, padding: "10px 14px", background: "var(--color-paper-raised)", fontSize: 14 }}>
            <b>{m.subject}</b> · to {m.to} · {new Date(m.at).toLocaleString("en-IN")}
          </p>
          <iframe title={m.subject} srcDoc={m.html} style={{ width: "100%", height: 380, border: 0, background: "#f8f4ea" }} sandbox="" />
        </section>
      ))}
    </main>
  );
}
