import type { Metadata } from "next";
import { AppPage } from "../../components/app/app-page";
import { timeAgo } from "../../lib/format";
import { conversations } from "../../lib/server/social";
import { requireUser } from "../../lib/server/session";

export const metadata: Metadata = { title: "Messages · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Your conversations, newest first. */
export default async function MessagesPage() {
  const me = await requireUser("/messages");
  const list = conversations(me);
  return (
    <AppPage user={me} current="messages" title="Messages" intro="Letters between connections. To write to someone new, connect first, or Ask a senior.">
      {list.length === 0 ? (
        <p className="wf-empty">
          No messages yet. Open a <a href="/connections">connection</a> and write to them.
        </p>
      ) : (
        <ul className="wf-list">
          {list.slice(0, 50).map((c) => (
            <li key={c.with.id} className="wf-member">
              <div className="wf-member__who">
                <a className="wf-member__name" href={`/messages/${c.with.id}`}>
                  {c.with.name}
                  {c.unread > 0 && <span className="wf-count" style={{ marginLeft: 8 }}>{c.unread}</span>}
                </a>
                <span className="wf-muted" style={{ overflowWrap: "anywhere" }}>
                  {c.mine ? "You: " : ""}
                  {c.last.length > 90 ? `${c.last.slice(0, 90)}…` : c.last}
                </span>
              </div>
              <span className="wf-muted">{timeAgo(c.lastAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
