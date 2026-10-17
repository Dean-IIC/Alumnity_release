import { pinPostAction } from "../../lib/actions/content";
import { timeAgo } from "../../lib/format";
import { mediaUrl } from "../../lib/media-url";
import type { Post } from "../../lib/server/posts";
import { ActionForm } from "../app/action-form";

/*
 * On someone's page, as on LinkedIn: their recent posts as a strip you scroll sideways
 * ("Activity"), and one of them pinned above it ("Featured"). Only posts this viewer may
 * see reach here (lib/server/posts.ts); the owner can pin and unpin.
 */

const excerpt = (body: string, max: number) => (body.length > max ? `${body.slice(0, max).replace(/\s+\S*$/, "")}…` : body);

function Counts({ post }: { post: Post }) {
  return (
    <span className="preview__counts">
      {post.reactionCount > 0 && <span>{post.reactionCount} {post.reactionCount === 1 ? "reaction" : "reactions"}</span>}
      {post.commentCount > 0 && <span>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</span>}
    </span>
  );
}

function Preview({ post, isOwner, pinned, large = false }: { post: Post; isOwner: boolean; pinned: boolean; large?: boolean }) {
  const photo = post.media.find((m) => m.kind === "image");
  return (
    <article className={`preview ${large ? "preview--large" : ""}`}>
      <a className="preview__open" href={`/notes/${post.id}`} aria-label={`Open the post from ${timeAgo(post.createdAt)}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="preview__photo" src={mediaUrl(photo.id, large ? 640 : 320)} alt="" loading="lazy" decoding="async" />
        )}
        <span className="preview__when">
          {timeAgo(post.createdAt)}
          {post.media.length > 1 ? ` · ${post.media.length} photos` : ""}
        </span>
        <span className="preview__text">{excerpt(post.body, large ? 320 : 140) || (photo ? "A photo" : "A post")}</span>
        <Counts post={post} />
      </a>
      {isOwner && (
        <ActionForm action={pinPostAction} className="preview__pin">
          <input type="hidden" name="id" value={post.id} />
          {pinned && <input type="hidden" name="unpin" value="1" />}
          <button type="submit" className="wf-link-button">
            {pinned ? "Unpin from the top" : "Pin to the top of my page"}
          </button>
        </ActionForm>
      )}
    </article>
  );
}

export function Featured({ post, isOwner }: { post: Post; isOwner: boolean }) {
  return (
    <section className="pcard pcard--featured" aria-labelledby="featured">
      <header className="pcard__head">
        <h2 id="featured">Featured</h2>
      </header>
      <Preview post={post} isOwner={isOwner} pinned large />
    </section>
  );
}

export function Activity({ posts, featuredId, isOwner, first }: { posts: Post[]; featuredId: number | null; isOwner: boolean; first: string }) {
  const rest = posts.filter((p) => p.id !== featuredId);
  if (!rest.length && !isOwner) return null;
  return (
    <section className="pcard pcard--activity" aria-labelledby="activity">
      <header className="pcard__head">
        <h2 id="activity">Activity</h2>
        {rest.length > 2 && <span className="activity__hint">Scroll sideways for more</span>}
      </header>
      {rest.length ? (
        <ul className="activity" tabIndex={0} aria-label={`${isOwner ? "Your" : `${first}'s`} recent posts`}>
          {rest.map((p) => (
            <li key={p.id}>
              <Preview post={p} isOwner={isOwner} pinned={false} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile__prompt">Your posts will show here. Share something from Home, then pin your best one to the top.</p>
      )}
    </section>
  );
}
