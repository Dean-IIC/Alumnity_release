import Link from "next/link";
import { batchLabel, timeAgo } from "../../lib/format";
import type { Post } from "../../lib/server/posts";
import { Avatar } from "./avatar";
import { NameMark } from "./name-mark";
import { PostMedia } from "./post-media";
import { RichText } from "./rich-text";

/**
 * The post inside a repost, as a compact card: its writer, its words (a few lines; the
 * rest on its own page) and its photos, small. If the reader may not see the original
 * (it's for people they aren't among, there's a block, or it was deleted), the card says
 * only that, and nothing of the original is sent to their browser.
 */
export function RepostCard({ repost }: { repost: NonNullable<Post["repostOf"]> }) {
  const original = repost.post;
  if (!original) {
    return (
      <div className="repost-card repost-card--gone">
        <strong>This post isn&apos;t available</strong>
        <span>It may have been deleted, or it&apos;s shared with people you aren&apos;t among.</span>
      </div>
    );
  }
  const href = `/notes/${original.id}`;
  return (
    <article className="repost-card" aria-label={`${original.author.name}'s post, reposted`}>
      <header className="repost-card__head">
        <Avatar name={original.author.name} photoId={original.authorPhoto} size={32} />
        <span className="repost-card__who">
          <span className="name-line">
            <Link className="repost-card__name" href={`/people/${original.author.id}`}>
              {original.author.name}
            </Link>
            <NameMark who={original.author} />
          </span>
          <span className="repost-card__meta">
            {batchLabel(original.author) && <span>{batchLabel(original.author)}</span>}
            <Link href={href}>
              <time dateTime={new Date(original.createdAt).toISOString()}>{timeAgo(original.createdAt)}</time>
            </Link>
          </span>
        </span>
      </header>
      {original.body && (
        <p className="repost-card__body">
          <RichText body={original.body} />
        </p>
      )}
      {original.media.length > 0 && <PostMedia media={original.media} author={original.author.name} compact />}
      <Link className="repost-card__open" href={href}>
        View the original post <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
