import Link from "next/link";
import type { Metadata } from "next";
import { AppPage } from "../../../../components/app/app-page";
import { WhoReactedButton } from "../../../../components/social/who-reacted-button";
import { timeAgo } from "../../../../lib/format";
import { feedFor } from "../../../../lib/server/posts";
import { requireUser } from "../../../../lib/server/session";
import "../../../styles/activity.css";

export const metadata: Metadata = { title: "Your activity · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The words a post starts with, for the list (mentions shown as names). */
const excerpt = (body: string) => {
  const plain = body.replace(/@\[([^\]]+)\]\(\d+\)/g, "@$1").replace(/\s+/g, " ").trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain || "A photo or video";
};

/**
 * Your posts and how they're doing: how many people saw each one, reacted and commented,
 * and who reacted. Views are a number only, never names: nobody is told who looked.
 */
export default async function ActivityPage() {
  const me = await requireUser("/me/activity");
  const posts = await feedFor(me, { authorId: me.id, limit: 30 });
  const sum = (f: (p: (typeof posts)[number]) => number) => posts.reduce((a, p) => a + f(p), 0);
  const views = sum((p) => p.views ?? 0);
  const reactions = sum((p) => p.reactionCount);
  const comments = sum((p) => p.commentCount);
  const totals = [
    { n: views, label: views === 1 ? "view" : "views" },
    { n: reactions, label: reactions === 1 ? "reaction" : "reactions" },
    { n: comments, label: comments === 1 ? "comment" : "comments" },
    { n: posts.length, label: posts.length === 30 ? "latest posts" : posts.length === 1 ? "post" : "posts" }
  ];
  return (
    <AppPage user={me} current="me" back={{ href: "/me", label: "Your page" }} title="Your activity" intro="How your posts are doing: who saw them, reacted and commented.">
      <ul className="activity-totals" aria-label="In total">
        {totals.map((t) => (
          <li key={t.label} className="sheet">
            <strong>{t.n.toLocaleString("en-IN")}</strong>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
      {posts.length === 0 ? (
        <section className="sheet activity-empty">
          <p>You haven't posted yet. When you do, you'll see here how many people saw it, and who reacted.</p>
          <Link className="button button--primary" href="/home">
            Write a post
          </Link>
        </section>
      ) : (
        <ul className="activity-list">
          {posts.map((p) => (
            <li key={p.id} className="sheet activity-post">
              <Link href={`/notes/${p.id}`} className="activity-post__text">
                {excerpt(p.body)}
              </Link>
              <span className="activity-post__when">{timeAgo(p.createdAt)}</span>
              <span className="activity-post__stats">
                <span>
                  <strong>{(p.views ?? 0).toLocaleString("en-IN")}</strong> {p.views === 1 ? "view" : "views"}
                </span>
                <span>
                  <strong>{p.reactionCount}</strong> {p.reactionCount === 1 ? "reaction" : "reactions"}
                </span>
                <Link href={`/notes/${p.id}`}>
                  <strong>{p.commentCount}</strong> {p.commentCount === 1 ? "comment" : "comments"}
                </Link>
                {p.repostCount > 0 && (
                  <span>
                    <strong>{p.repostCount}</strong> {p.repostCount === 1 ? "repost" : "reposts"}
                  </span>
                )}
              </span>
              <WhoReactedButton postId={p.id} count={p.reactionCount} />
            </li>
          ))}
        </ul>
      )}
      <p className="wf-muted activity-note">Views count each person once. Only you see your numbers, and nobody is told who looked.</p>
    </AppPage>
  );
}
