import { commentAction, removeCommentAction, removePostAction } from "../../lib/actions/content";
import { batchLabel, timeAgo } from "../../lib/format";
import { mediaUrl } from "../../lib/media-url";
import type { Post as PostData } from "../../lib/server/posts";
import { ActionForm } from "../app/action-form";
import { ReportButton } from "../app/report-button";
import { Avatar } from "./avatar";
import { Icon } from "./icons";
import { MentionInput } from "./mention-input";
import { ReactionBar } from "./reaction-bar";
import { RichText } from "./rich-text";

const AUDIENCE = { everyone: ["everyone", "Everyone"], batch: ["batch", "Batch"], connections: ["connections", "Connections"], group: ["people", "the group"] } as const;

type Props = {
  post: PostData;
  /** Profile photos by member id (for avatars). */
  photos: Map<number, string>;
  /** On the post's own page: every comment, not just the newest. */
  full?: boolean;
  /** The viewer, for the comment box. */
  me: { id: number; name: string };
};

/** One post in the feed: who and when, their words and photos, reactions, and the newest comments. */
export function Post({ post, photos, full = false, me }: Props) {
  const [audienceIcon, audienceLabel] = AUDIENCE[post.audience];
  const href = `/notes/${post.id}`;
  return (
    <article className="post" id={`post-${post.id}`} aria-labelledby={`post-${post.id}-by`}>
      <header className="post__head">
        <a href={`/people/${post.author.id}`} tabIndex={-1} aria-hidden="true">
          <Avatar name={post.author.name} photoId={photos.get(post.author.id)} size={44} />
        </a>
        <div className="post__who">
          <a className="post__name" id={`post-${post.id}-by`} href={`/people/${post.author.id}`}>
            {post.author.name}
          </a>
          <span className="post__meta">
            {batchLabel(post.author) && <span>{batchLabel(post.author)}</span>}
            <a href={href}>
              <time dateTime={new Date(post.createdAt).toISOString()}>{timeAgo(post.createdAt)}</time>
            </a>
            {post.group && !full && <a href={`/groups/${post.group.id}`}>{post.group.name}</a>}
            <span className="post__audience" title={`Shown to: ${audienceLabel}`}>
              <Icon name={audienceIcon} size={13} />
              <span className="sr-only">Shown to {audienceLabel}</span>
            </span>
          </span>
        </div>
        <details className="post__menu">
          <summary aria-label="More">
            <Icon name="more" size={22} />
          </summary>
          <div className="post__menu-list">
            {post.mine ? (
              <ActionForm action={removePostAction} confirm="Delete this post? It can't be brought back.">
                <input type="hidden" name="id" value={post.id} />
                <button type="submit">Delete post</button>
              </ActionForm>
            ) : (
              <ReportButton kind="post" id={post.id} back={full ? href : `/home#post-${post.id}`} label="Report post" />
            )}
            <a href={href}>Open post</a>
          </div>
        </details>
      </header>

      {post.body && (
        <p className={`post__body ${post.media.length === 0 && post.body.length < 90 ? "post__body--large" : ""}`}>
          <RichText body={post.body} />
        </p>
      )}

      {post.media.length > 0 && (
        <div className={`post__media post__media--${Math.min(post.media.length, 4)}`}>
          {post.media.map((m, i) =>
            m.kind === "video" ? (
              <video key={m.id} src={mediaUrl(m.id)} controls playsInline preload="metadata" className="post__print" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={mediaUrl(m.id, full ? 640 : post.media.length > 1 ? 320 : 640)} alt={`Photo ${i + 1} of ${post.media.length} posted by ${post.author.name}`} loading="lazy" decoding="async" className="post__print" />
            )
          )}
        </div>
      )}

      <ReactionBar postId={post.id} mine={post.myReaction} counts={post.reactions} commentCount={post.commentCount} commentsHref={full ? "#comment-box" : `${href}#comments`} shareUrl={href} />

      {(post.comments.length > 0 || full) && (
        <section className="post__comments" id={full ? "comments" : undefined} aria-label="Comments">
          {!full && post.commentCount > post.comments.length && (
            <a className="post__all-comments" href={`${href}#comments`}>
              View all {post.commentCount} comments
            </a>
          )}
          {post.comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar name={c.author.name} photoId={photos.get(c.author.id)} size={32} />
              <div className="comment__bubble">
                <a className="comment__name" href={`/people/${c.author.id}`}>
                  {c.author.name}
                </a>
                <p>
                  <RichText body={c.body} />
                </p>
                <span className="comment__meta">
                  {timeAgo(c.createdAt)}
                  {c.mine ? (
                    <ActionForm action={removeCommentAction} className="comment__inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit">Delete</button>
                    </ActionForm>
                  ) : (
                    <ReportButton kind="comment" id={c.id} back={full ? href : `/home#post-${post.id}`} />
                  )}
                </span>
              </div>
            </div>
          ))}
          {full && (
            <ActionForm action={commentAction} resetOnSuccess className="comment comment--new" showDone={false}>
              <input type="hidden" name="id" value={post.id} />
              <Avatar name={me.name} photoId={photos.get(me.id)} size={32} />
              <MentionInput id="comment-box" name="body" label="Write a comment" rows={1} maxLength={500} required placeholder="Write a comment… (@ to mention)" className="comment__input" />
              <button className="button button--primary comment__send" type="submit">
                Send
              </button>
            </ActionForm>
          )}
        </section>
      )}
    </article>
  );
}
