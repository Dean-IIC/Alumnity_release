import Link from "next/link";
import type { Metadata } from "next";
import { AppPage } from "../../../components/app/app-page";
import { Post } from "../../../components/social/post";
import { feedFor } from "../../../lib/server/posts";
import { photoIdsOf } from "../../../lib/server/profile";
import { isModerator } from "../../../lib/server/roles";
import { requireUser } from "../../../lib/server/session";
import { cleanTag, SUGGESTED_TAGS } from "../../../lib/tags";

export const metadata: Metadata = { title: "HKBK board · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The HKBK board: posts the college desk has checked (jobs, internships, notices,
 * scholarships…), narrowed by #tag. Under a tag, everyone else's posts with it follow,
 * marked as not checked. A post is still a post: the tag and the check mark are all that's
 * different.
 */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const tag = cleanTag((await searchParams).tag);
  const me = await requireUser(tag ? `/board?tag=${tag}` : "/board");
  const [verified, tagged] = await Promise.all([
    feedFor(me, { verified: true, tag: tag ?? undefined, limit: 30 }),
    tag ? feedFor(me, { tag, limit: 15 }) : Promise.resolve([])
  ]);
  const others = tagged.filter((p) => !p.verifiedAt);
  const photos = await photoIdsOf([me.id, ...[...verified, ...others].flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)])]);
  const desk = isModerator(me);

  return (
    <AppPage
      user={me}
      current="board"
      title="HKBK board"
      intro="Jobs, internships, notices and more, checked by the college. Add a #tag to your post, and the college desk may add it here."
    >
      <nav className="wf-tabs board__tags" aria-label="Filter posts by tag">
        <Link href="/board" aria-current={!tag ? "page" : undefined}>
          Everything
        </Link>
        {SUGGESTED_TAGS.map(([t, label]) => (
          <Link key={t} href={`/board?tag=${t}`} aria-current={tag === t ? "page" : undefined}>
            {label}
          </Link>
        ))}
        {tag && !SUGGESTED_TAGS.some(([t]) => t === tag) && (
          <Link href={`/board?tag=${tag}`} aria-current="page">
            #{tag}
          </Link>
        )}
      </nav>

      <div className="feed-layout feed-layout--single board">
        <div className="feed-layout__main">
          <h2 className="board__heading">
            <span className="board__check" aria-hidden="true">
              ✓
            </span>{" "}
            Checked by the college{tag ? `: #${tag}` : ""}
          </h2>
          {verified.length === 0 ? (
            <p className="wf-empty">
              {tag ? `Nothing tagged #${tag} is on the board yet.` : "Nothing on the board yet."}{" "}
              {desk
                ? "Open a post's ••• menu and choose “Add to the HKBK board”."
                : "Posting a job or a notice? Add a #tag, and the college desk can add it here."}
            </p>
          ) : (
            verified.map((p) => <Post key={p.id} post={p} photos={photos} me={me} />)
          )}

          {tag && others.length > 0 && (
            <>
              <h2 className="board__heading board__heading--others">Everyone's #{tag} posts</h2>
              <p className="wf-muted">The college has not checked these posts yet. Read them with care.</p>
              {others.map((p) => (
                <Post key={p.id} post={p} photos={photos} me={me} />
              ))}
            </>
          )}
        </div>
      </div>
    </AppPage>
  );
}
