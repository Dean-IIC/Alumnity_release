import Link from "next/link";
import { commentAction, verifyPostAction } from "../../lib/actions/content";
import { referralAction } from "../../lib/actions/social";
import { tagHref } from "../../lib/feed-filters";
import { batchLabel, timeAgo, when } from "../../lib/format";
import { plainText } from "../../lib/mentions";
import type { User } from "../../lib/server/auth";
import { COMMENT_LIMIT, POST_LIMIT, type Post as PostData } from "../../lib/server/posts";
import { isModerator } from "../../lib/server/roles";
import { WORK_TAGS } from "../../lib/tags";
import { ActionForm } from "../app/action-form";
import { ReportButton } from "../app/report-button";
import { Avatar } from "./avatar";
import { CommentEditDelete, PostEditDelete } from "./edit-delete";
import { Icon } from "./icons";
import { MentionInput } from "./mention-input";
import { NameMark } from "./name-mark";
import { PostMedia } from "./post-media";
import { ReactionBar } from "./reaction-bar";
import { RepostCard } from "./repost-card";
import { RichText } from "./rich-text";
import "../../app/styles/posts-plus.css";

const AUDIENCE = { everyone: ["everyone", "Everyone"], batch: ["batch", "Batch"], connections: ["connections", "Connections"], group: ["people", "the group"] } as const;

type Props = {
  post: PostData;
  /** Profile photos by member id (for avatars). */
  photos: Map<number, string>;
  /** On the post's own page: every comment, not just the newest. */
  full?: boolean;
  /** The viewer, for the comment box (and, for the college desk, the check mark; and whether a repost can go to their batch). */
  me: Pick<User, "id" | "name" | "role"> & Partial<Pick<User, "branch" | "joined">>;
  /** The viewer runs the post's group (its owner or an admin): they may delete anyone's post in it. */
  groupAdmin?: boolean;
};

/**
 * One post in the feed: who and when, their words and photos, reactions, and the newest
 * comments. A repost carries its original as a compact card; a plain repost (no words of
 * its own) is headed "X reposted" instead.
 */
export function Post({ post, photos, full = false, me, groupAdmin = false }: Props) {
  const [audienceIcon, audienceLabel] = AUDIENCE[post.audience];
  const href = `/notes/${post.id}`;
  const desk = isModerator(me);
  const work = !post.mine && post.tags.some((t) => WORK_TAGS.includes(t));
  const plainRepost = post.repostOf !== null && !post.body && post.media.length === 0;
  // What Repost and Share say about it: a plain repost passes on its original.
  const shown = plainRepost && post.repostOf?.post ? post.repostOf.post : post;
  const excerpt = plainText(shown.body).replace(/\s+/g, " ").slice(0, 140);
  return (
    <article className={`post ${plainRepost ? "post--repost" : ""}`} id={`post-${post.id}`} aria-labelledby={`post-${post.id}-by`}>
      <header className="post__head">
        <Link href={`/people/${post.author.id}`} tabIndex={-1} aria-hidden="true">
          <Avatar name={post.author.name} photoId={photos.get(post.author.id)} size={plainRepost ? 32 : 44} />
        </Link>
        <div className="post__who">
          <span className="name-line">
            {plainRepost && <Icon name="repost" size={16} className="post__repost-mark" />}
            <Link className="post__name" id={`post-${post.id}-by`} href={`/people/${post.author.id}`}>
              {post.author.name}
            </Link>
            <NameMark who={post.author} />
            {plainRepost && <span className="post__reposted">reposted</span>}
          </span>
          {post.archive && (
            <span className="post__archive" title="Moved here from the old HKBK alumni website. It keeps its original date.">
              From the old HKBK alumni website
            </span>
          )}
          <span className="post__meta">
            {batchLabel(post.author) && <span>{batchLabel(post.author)}</span>}
            <a href={href}>
              <time dateTime={new Date(post.createdAt).toISOString()}>{timeAgo(post.createdAt)}</time>
            </a>
            {post.editedAt && (
              <span className="post__edited" title={`Edited ${when(post.editedAt)}`}>
                Edited{full && <> <time dateTime={new Date(post.editedAt).toISOString()}>{timeAgo(post.editedAt)}</time></>}
                {!full && <span className="sr-only"> {timeAgo(post.editedAt)}</span>}
              </span>
            )}
            {post.group && !full && <Link href={`/groups/${post.group.id}`}>{post.group.name}</Link>}
            <span className="post__audience" title={`Shown to: ${audienceLabel}`}>
              <Icon name={audienceIcon} size={13} />
              <span className="sr-only">Shown to {audienceLabel}</span>
            </span>
          </span>
          {post.verifiedAt && (
            <Link className="post__verified" href="/board" title="The college checked this post. It is on the HKBK board.">
              <span aria-hidden="true">✓</span> Checked by HKBK
            </Link>
          )}
        </div>
        <details className="post__menu">
          <summary aria-label="More options">
            <Icon name="more" size={22} />
          </summary>
          <div className="post__menu-list">
            {(post.mine || (groupAdmin && post.group !== null)) && (
              <PostEditDelete
                id={post.id}
                body={post.body}
                mine={post.mine}
                verified={post.verifiedAt !== null}
                limit={POST_LIMIT}
                // Deleted from its own page: back to where it lived (the page itself is gone).
                after={full ? (post.group ? `/groups/${post.group.id}` : "/home") : undefined}
              />
            )}
            {!post.mine && <ReportButton kind="post" id={post.id} back={full ? href : `/home#post-${post.id}`} label="Report post" />}
            {desk && (post.verifiedAt || post.audience === "everyone") && (
              <ActionForm action={verifyPostAction} showDone={false}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="on" value={post.verifiedAt ? "0" : "1"} />
                <button type="submit">{post.verifiedAt ? "Remove from the HKBK board" : "Add to the HKBK board"}</button>
              </ActionForm>
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
      {post.tags.some((t) => !post.body.toLowerCase().includes(`#${t}`)) && (
        <p className="post__tags">
          {post.tags
            .filter((t) => !post.body.toLowerCase().includes(`#${t}`))
            .map((t) => (
              <Link key={t} className="hashtag" href={tagHref(t)}>
                #{t}
              </Link>
            ))}
        </p>
      )}

      {post.media.length > 0 && <PostMedia media={post.media} author={post.author.name} full={full} />}

      {post.repostOf && <RepostCard repost={post.repostOf} />}

      {work && (
        <details className="post__refer">
          <summary>Ask {post.author.name.split(" ")[0]} for a referral</summary>
          <ActionForm action={referralAction} className="wf-stack" resetOnSuccess>
            <input type="hidden" name="id" value={post.id} />
            <label className="field">
              <span className="field__label">Why you are a good fit</span>
              <textarea name="note" rows={3} required minLength={20} maxLength={1500} placeholder="Your branch and year. What you've built or studied that fits. Keep it short." />
              <span className="field__hint">Not connected yet? We send it with a connection request. Connected? We send it as a message.</span>
            </label>
            <div>
              <button className="button button--primary wf-small" type="submit">
                Send
              </button>
            </div>
          </ActionForm>
        </details>
      )}

      <ReactionBar
        postId={post.id}
        mine={post.myReaction}
        counts={post.reactions}
        commentCount={post.commentCount}
        commentsHref={full ? "#comment-box" : `${href}#comments`}
        shareUrl={href}
        audience={post.audience}
        author={shown.author.name}
        excerpt={excerpt}
        // A group's posts stay in the group; and a repost of a post the viewer can't see has nothing to pass on.
        canRepost={post.group === null && post.audience !== "group" && !(plainRepost && !post.repostOf?.post)}
        repostCount={post.repostCount}
        hasBatch={Boolean(me.branch && me.joined)}
        views={post.views}
      />

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
                <span className="name-line">
                  <Link className="comment__name" href={`/people/${c.author.id}`}>
                    {c.author.name}
                  </Link>
                  <NameMark who={c.author} />
                </span>
                <p>
                  <RichText body={c.body} />
                </p>
                <span className="comment__meta">
                  {timeAgo(c.createdAt)}
                  {c.editedAt && (
                    <span className="comment__edited" title={`Edited ${when(c.editedAt)}`}>
                      edited
                    </span>
                  )}
                  {c.mine ? (
                    <CommentEditDelete id={c.id} body={c.body} limit={COMMENT_LIMIT} />
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
              <MentionInput id="comment-box" name="body" label="Write a comment" rows={1} maxLength={500} required placeholder="Write a comment (type @ to mention someone)" className="comment__input" />
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
