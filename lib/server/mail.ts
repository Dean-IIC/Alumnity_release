import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

/*
 * Sending email. With SMTP set up (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM,
 * in .env.local, never committed) it sends for real, e.g. through the college's Google
 * mail with an app password. Without it, in development, each email is written to
 * .mail-outbox/ instead and can be read at /dev/mail, so every flow can be tried end to
 * end. In production without SMTP it refuses, rather than silently not sending.
 */

export type Mail = { to: string; subject: string; text: string; html: string };

const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const outboxDir = () => process.env.ALUMNITY_OUTBOX || join(process.cwd(), ".mail-outbox");

let transport: Transporter | undefined;

export async function sendMail(mail: Mail): Promise<void> {
  if (smtpReady()) {
    transport ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...mail });
    return;
  }
  // In production, emails must really go out; only a demo (ALUMNITY_DEMO_CODE set) may keep them in the outbox.
  if (process.env.NODE_ENV === "production" && !process.env.ALUMNITY_DEMO_CODE) throw new Error("Email isn't set up: add SMTP_HOST, SMTP_USER and SMTP_PASS.");
  const dir = outboxDir();
  mkdirSync(dir, { recursive: true });
  const file = `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, "_")}.json`;
  writeFileSync(join(dir, file), JSON.stringify({ ...mail, at: new Date().toISOString() }, null, 2));
  console.log(`[mail] to ${mail.to}: ${mail.subject} (saved to ${join(dir, file)})`);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The one look every Alumnity email has: paper, the wordmark, a few lines, and (often) a code. */
export function letter({ greeting, lines, code, footer }: { greeting: string; lines: string[]; code?: string; footer?: string }) {
  const text = [greeting, "", ...lines, ...(code ? ["", `Your code: ${code}`] : []), "", footer ?? "Alumnity · HKBK College of Engineering"].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f8f4ea;font-family:Arial,sans-serif;color:#392820">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="margin:0 0 24px;font:700 22px Arial,sans-serif;color:#143f68;letter-spacing:-1px">alumnity<span style="color:#c6842a">.</span></p>
<p style="margin:0 0 16px;font-size:17px">${escape(greeting)}</p>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#73665c">${escape(l)}</p>`).join("")}
${code ? `<p style="margin:24px 0;padding:16px;border:1px solid rgba(57,40,32,.18);border-radius:10px;background:#fffdf7;text-align:center;font:700 30px Georgia,serif;letter-spacing:8px;color:#a83932">${code}</p>` : ""}
<p style="margin:32px 0 0;font-size:12px;color:#6f5d45">${escape(footer ?? "Alumnity · HKBK College of Engineering")}</p>
</div></body></html>`;
  return { text, html };
}
