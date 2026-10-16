import type { Transporter } from "nodemailer";

/*
 * Alumnity's own emails (the daily digest). Sign-in codes are Supabase's, not these.
 * Sent through SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (the college's Google
 * Workspace with an app password works), from MAIL_FROM. Without SMTP, on this computer
 * the email is printed in the server's output; in production it isn't sent.
 */

export type Mail = { to: string; subject: string; text: string; html: string; unsubscribe?: string };

export const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Promise<Transporter> | undefined;

export async function sendMail(mail: Mail): Promise<boolean> {
  if (!smtpReady()) {
    if (process.env.NODE_ENV !== "production") console.log(`\n[alumnity] Email to ${mail.to}: ${mail.subject}\n${mail.text}\n`);
    return false;
  }
  transport ??= import("nodemailer").then((m) =>
    m.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 3
    })
  );
  await (await transport).sendMail({
    from: process.env.MAIL_FROM || `Alumnity <${process.env.SMTP_USER}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: mail.unsubscribe ? { "List-Unsubscribe": `<${mail.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined
  });
  return true;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, readable email: a greeting, some lines, a button, and a footer. */
export function letter(parts: { greeting: string; lines: string[]; button?: { text: string; href: string }; footer: string }): { text: string; html: string } {
  const text = [parts.greeting, "", ...parts.lines, "", parts.button ? `${parts.button.text}: ${parts.button.href}` : "", "", parts.footer].join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1d1b18;max-width:560px">
<p>${escape(parts.greeting)}</p>
${parts.lines.map((l) => `<p>${escape(l)}</p>`).join("\n")}
${parts.button ? `<p><a href="${escape(parts.button.href)}" style="display:inline-block;padding:10px 18px;background:#1f3a5f;color:#fff;border-radius:6px;text-decoration:none">${escape(parts.button.text)}</a></p>` : ""}
<p style="font-size:13px;color:#6b645a">${escape(parts.footer)}</p>
</div>`;
  return { text, html };
}
