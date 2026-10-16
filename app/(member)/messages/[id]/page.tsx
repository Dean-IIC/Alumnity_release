import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../components/app/action-form";
import { AppPage } from "../../../../components/app/app-page";
import { ReportButton } from "../../../../components/app/report-button";
import { messageAction } from "../../../../lib/actions/social";
import { firstName, timeAgo } from "../../../../lib/format";
import { memberById, relation } from "../../../../lib/server/people";
import { PAUSED, settings } from "../../../../lib/server/settings";
import { thread } from "../../../../lib/server/social";
import { requireUser } from "../../../../lib/server/session";

export const metadata: Metadata = { title: "Messages · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One conversation. Opening it marks their messages read. */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/messages/${raw}`);
  const id = Number(raw);
  const other = Number.isSafeInteger(id) && id > 0 && id !== me.id ? await memberById(id) : null;
  const rel = other ? await relation(me.id, other.id) : "none";
  if (!other || rel === "blocked" || rel === "blocked-by") notFound();
  const messages = await thread(me, other.id);
  const first = firstName(other.name);

  return (
    <AppPage
      user={me}
      current="messages"
      back={{ href: "/messages", label: "Messages" }}
      title={other.name}
      intro={<a href={`/people/${other.id}`}>Their page →</a>}
      thread={{ with: other.id, latest: messages.at(-1)?.id ?? 0 }}
    >
      <div className="wf-thread">
        {messages.length === 0 && <p className="wf-empty">No messages yet. Say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`wf-bubble ${m.mine ? "wf-bubble--mine" : ""}`}>
            {m.body}
            <small>
              {timeAgo(m.createdAt)}
              {!m.mine && (
                <>
                  {" · "}
                  <ReportButton kind="message" id={m.id} back={`/messages/${other.id}`} />
                </>
              )}
            </small>
          </div>
        ))}
      </div>
      {!(await settings()).features.messages ? (
        <p className="wf-empty">{PAUSED}</p>
      ) : rel === "connected" ? (
        <ActionForm action={messageAction} resetOnSuccess className="wf-stack" showDone={false}>
          <input type="hidden" name="id" value={other.id} />
          <label className="sr-only" htmlFor="message-body">
            Message to {first}
          </label>
          <textarea id="message-body" name="body" rows={3} maxLength={2000} required placeholder={`Write to ${first}…`} />
          <div>
            <button className="button button--primary wf-small" type="submit">
              Send
            </button>
          </div>
        </ActionForm>
      ) : (
        <p className="wf-empty">
          You can write to {first} once you're connected. <a href={`/people/${other.id}`}>Connect from their page</a>.
        </p>
      )}
    </AppPage>
  );
}
