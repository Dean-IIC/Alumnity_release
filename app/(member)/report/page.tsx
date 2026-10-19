import type { Metadata } from "next";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { reportAction } from "../../../lib/actions/social";
import { safeNext } from "../../../lib/safe-next";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Report · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const WHAT = { member: "this member", post: "this post", comment: "this comment", message: "this message", ask: "this question", group: "this group", cause: "this cause" } as const;

/** Report something to the college desk. Whether it may be reported is checked when it's sent. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string; back?: string }> }) {
  const p = await searchParams;
  const me = await requireUser("/report");
  const kind = (p.kind && p.kind in WHAT ? p.kind : "post") as keyof typeof WHAT;
  const id = Number(p.id);
  const back = safeNext(p.back, "/home");
  return (
    <AppPage user={me} current="home" back={{ href: p.back && p.back.startsWith("/") && !p.back.startsWith("//") ? p.back : "/home", label: "Back" }} title={`Report ${WHAT[kind]}`} intro="The college's alumni team will look at it. They won't tell anyone it was you.">
      {Number.isSafeInteger(id) && id > 0 ? (
        <ActionForm action={reportAction} className="wf-stack">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <label className="field">
            <span className="field__label">What's wrong?</span>
            <textarea name="reason" rows={3} maxLength={500} required placeholder="For example: spam, rude words, a fake account, or something unsafe" />
          </label>
          <div className="wf-actions">
            <button className="button button--primary" type="submit">
              Send report
            </button>
            <a className="wf-link-button" href={back}>
              ← Back
            </a>
          </div>
        </ActionForm>
      ) : (
        <p className="wf-empty">There's nothing to report here.</p>
      )}
    </AppPage>
  );
}
