import type { Metadata } from "next";
import { ActionForm } from "../../components/app/action-form";
import { AppPage } from "../../components/app/app-page";
import { MemberLine } from "../../components/app/member-line";
import { acceptAction, connectAction, declineAction, unblockAction, withdrawAction } from "../../lib/actions/social";
import { timeAgo } from "../../lib/format";
import { batchmates, relationsOf } from "../../lib/server/people";
import { blockedBy, connectionsOf, requestsFor } from "../../lib/server/social";
import { requireUser } from "../../lib/server/session";

export const metadata: Metadata = { title: "Connections · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Requests waiting for you, the ones you sent, your connections, and who you've blocked. */
const PAGE = 50;

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requireUser("/connections");
  const page = Math.max(1, Math.min(1000, Math.floor(Number((await searchParams).page)) || 1));
  const [{ received, sent }, mine, blocked, mates, relationTo] = await Promise.all([requestsFor(me), connectionsOf(me.id), blockedBy(me.id), batchmates(me), relationsOf(me.id)]);
  const suggestions = mates
    .filter((u) => relationTo(u.id) === "none")
    .slice(0, 6);

  return (
    <AppPage user={me} current="connections" title="Connections" intro="Connections can message each other and see what's shared with connections.">
      <section aria-labelledby="waiting">
        <h2 id="waiting">Waiting for you{received.length ? ` · ${received.length}` : ""}</h2>
        {received.length === 0 ? (
          <p className="wf-empty">No requests waiting.</p>
        ) : (
          <ul className="wf-list">
            {received.map((r) => (
              <MemberLine key={r.member.id} member={r.member} detail={[r.note && `“${r.note}”`, timeAgo(r.createdAt)].filter(Boolean).join(" · ")}>
                <ActionForm action={acceptAction}>
                  <input type="hidden" name="id" value={r.member.id} />
                  <button className="button button--primary wf-small" type="submit">
                    Accept
                  </button>
                </ActionForm>
                <ActionForm action={declineAction}>
                  <input type="hidden" name="id" value={r.member.id} />
                  <button className="button button--secondary wf-small" type="submit">
                    Decline
                  </button>
                </ActionForm>
              </MemberLine>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="yours">
        <h2 id="yours">Your connections · {mine.length}</h2>
        {mine.length === 0 ? (
          <p className="wf-empty">
            None yet. Start with <a href="/batch">your batch</a>, or <a href="/people">find people you know</a>.
          </p>
        ) : (
          <ul className="wf-list">
            {mine.slice((page - 1) * PAGE, page * PAGE).map((u) => (
              <MemberLine key={u.id} member={u}>
                <a className="button button--secondary wf-small" href={`/messages/${u.id}`}>
                  Message
                </a>
              </MemberLine>
            ))}
          </ul>
        )}
        {mine.length > PAGE && (
          <div className="wf-actions" style={{ justifyContent: "space-between" }}>
            {page > 1 ? <a href={`/connections?page=${page - 1}#yours`}>← Previous</a> : <span />}
            <span className="wf-muted">
              {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, mine.length)} of {mine.length}
            </span>
            {page * PAGE < mine.length ? <a href={`/connections?page=${page + 1}#yours`}>Next →</a> : <span />}
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="suggest">
          <h2 id="suggest">People from your batch</h2>
          <ul className="wf-list">
            {suggestions.map((u) => (
              <MemberLine key={u.id} member={u}>
                <ActionForm action={connectAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="button button--secondary wf-small" type="submit">
                    Connect
                  </button>
                </ActionForm>
              </MemberLine>
            ))}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        <section aria-labelledby="sent">
          <h2 id="sent">Requests you sent · {sent.length}</h2>
          <ul className="wf-list">
            {sent.map((r) => (
              <MemberLine key={r.member.id} member={r.member} detail={`Sent ${timeAgo(r.createdAt)}`}>
                <ActionForm action={withdrawAction}>
                  <input type="hidden" name="id" value={r.member.id} />
                  <button className="wf-link-button" type="submit">
                    Withdraw
                  </button>
                </ActionForm>
              </MemberLine>
            ))}
          </ul>
        </section>
      )}

      {blocked.length > 0 && (
        <section aria-labelledby="blocked">
          <h2 id="blocked">Blocked</h2>
          <p className="wf-muted">You don't see each other anywhere on Alumnity. They aren't told.</p>
          <ul className="wf-list">
            {blocked.map((u) => (
              <li key={u.id} className="wf-member">
                <span>{u.name}</span>
                <ActionForm action={unblockAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="wf-link-button" type="submit">
                    Unblock
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppPage>
  );
}
