import Link from "next/link";
import type { Metadata } from "next";
import { photoIdsOf } from "../../../lib/server/profile";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { MemberLine } from "../../../components/app/member-line";
import { acceptAction, connectAction, declineAction, followAction, unblockAction, unfollowAction, withdrawAction } from "../../../lib/actions/social";
import { timeAgo } from "../../../lib/format";
import { followersOf, followingOf } from "../../../lib/server/follows";
import { batchmates, relationsOf } from "../../../lib/server/people";
import { blockedBy, connectionsOf, requestsFor } from "../../../lib/server/social";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "Connections · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Requests waiting for you, the ones you sent, your connections, and who you've blocked. */
const PAGE = 50;

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requireUser("/connections");
  const page = Math.max(1, Math.min(1000, Math.floor(Number((await searchParams).page)) || 1));
  const [{ received, sent }, mine, blocked, mates, relationTo, followers, following] = await Promise.all([
    requestsFor(me),
    connectionsOf(me.id),
    blockedBy(me.id),
    batchmates(me),
    relationsOf(me.id),
    followersOf(me.id),
    followingOf(me.id)
  ]);
  const followingSet = new Set(following.map((u) => u.id));
  const photos = await photoIdsOf(
    [...received, ...sent].map((r) => r.member.id).concat(mine.map((u) => u.id), blocked.map((u) => u.id), mates.map((u) => u.id), followers.map((u) => u.id), following.map((u) => u.id))
  );
  const suggestions = mates
    .filter((u) => relationTo(u.id) === "none")
    .slice(0, 6);

  return (
    <AppPage user={me} current="connections" title="Connections" intro="Connections can message each other and see what's shared with connections. Followers only see your posts in their Following feed.">
      <section aria-labelledby="waiting">
        <h2 id="waiting">Waiting for you{received.length ? ` · ${received.length}` : ""}</h2>
        {received.length === 0 ? (
          <p className="wf-empty">No requests waiting.</p>
        ) : (
          <ul className="wf-list">
            {received.map((r) => (
              <MemberLine key={r.member.id} member={r.member} photoId={photos.get(r.member.id)} detail={[r.note && `“${r.note}”`, timeAgo(r.createdAt)].filter(Boolean).join(" · ")}>
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
        <h2 id="yours">
          Your connections <span className="h-count">· {mine.length}</span>
        </h2>
        {mine.length === 0 ? (
          <p className="wf-empty">
            None yet. Start with <Link href="/batch">your batch</Link>, or <Link href="/people">find people you know</Link>.
          </p>
        ) : (
          <ul className="wf-list">
            {mine.slice((page - 1) * PAGE, page * PAGE).map((u) => (
              <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
                <Link className="button button--secondary wf-small" href={`/messages/${u.id}`}>
                  Message
                </Link>
              </MemberLine>
            ))}
          </ul>
        )}
        {mine.length > PAGE && (
          <div className="wf-actions" style={{ justifyContent: "space-between" }}>
            {page > 1 ? <Link href={`/connections?page=${page - 1}#yours`}>← Previous</Link> : <span />}
            <span className="wf-muted">
              {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, mine.length)} of {mine.length}
            </span>
            {page * PAGE < mine.length ? <Link href={`/connections?page=${page + 1}#yours`}>Next →</Link> : <span />}
          </div>
        )}
      </section>

      {/* Following is one-way and separate from connecting: these lists are only follows,
          never mixed into "Your connections" above. */}
      <section aria-labelledby="followers-title" id="followers">
        <h2 id="followers-title">
          Your followers <span className="h-count">· {followers.length}</span>
        </h2>
        {followers.length === 0 ? (
          <p className="wf-empty">Nobody follows you yet. When someone does, their name shows here.</p>
        ) : (
          <ul className="wf-list">
            {followers.slice(0, PAGE * 2).map((u) => (
              <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
                {followingSet.has(u.id) ? (
                  <span className="wf-tag">You follow each other</span>
                ) : (
                  <ActionForm action={followAction} showDone={false}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="button button--follow wf-small" type="submit">
                      Follow back
                    </button>
                  </ActionForm>
                )}
              </MemberLine>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="following-title" id="following">
        <h2 id="following-title">
          You follow <span className="h-count">· {following.length}</span>
        </h2>
        {following.length === 0 ? (
          <p className="wf-empty">
            You don&apos;t follow anyone yet. Follow someone from <Link href="/people">People</Link> to see their posts in your Following feed.
          </p>
        ) : (
          <ul className="wf-list">
            {following.slice(0, PAGE * 2).map((u) => (
              <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
                <ActionForm action={unfollowAction} showDone={false}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="button button--secondary wf-small" type="submit">
                    Unfollow
                  </button>
                </ActionForm>
              </MemberLine>
            ))}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="suggest">
          <h2 id="suggest">People from your batch</h2>
          <ul className="wf-list">
            {suggestions.map((u) => (
              <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
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
          <h2 id="sent">
            Requests you sent <span className="h-count">· {sent.length}</span>
          </h2>
          <ul className="wf-list">
            {sent.map((r) => (
              <MemberLine key={r.member.id} member={r.member} photoId={photos.get(r.member.id)} detail={`Sent ${timeAgo(r.createdAt)}`}>
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
