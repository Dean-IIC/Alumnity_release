import { cheerAction, commentAction, removeCommentAction, removePostAction } from "../../lib/actions/content";
import { batchLabel, timeAgo } from "../../lib/format";
import type { Post } from "../../lib/server/posts";
import { ActionForm } from "./action-form";
import { ReportButton } from "./report-button";

const AUDIENCE_LABEL = { everyone: "Everyone", batch: "Batch", connections: "Connections", group: "Group" } as const;

/** One note on Home: who, when, for whom; cheers, comments, and Report. `full`: on its own page, with every comment. */
export function PostCard({ post, full = false }: { post: Post; full?: boolean }) {
  const back = full ? `/notes/${post.id}` : `/home#post-${post.id}`;
  return (
    <article className="wf-card" id={`post-${post.id}`}>
      <div className="wf-card__meta">
        <a href={`/people/${post.author.id}`}>{post.author.name}</a>
        <span>{batchLabel(post.author)}</span>
        <span>{timeAgo(post.createdAt)}</span>
        <span className="wf-tag" title="Who can see this">
          {AUDIENCE_LABEL[post.audience]}
        </span>
      </div>
      <p>{post.body}</p>
      <div className="wf-actions">
        <ActionForm action={cheerAction} showDone={false}>
          <input type="hidden" name="id" value={post.id} />
          <button className="button button--secondary wf-small" type="submit" aria-pressed={post.cheered}>
            {post.cheered ? "Cheered" : "Cheer"} · {post.cheers}
          </button>
        </ActionForm>
        {post.mine ? (
          <ActionForm action={removePostAction} confirm="Remove this note? It can't be brought back.">
            <input type="hidden" name="id" value={post.id} />
            <button className="wf-link-button" type="submit">
              Remove
            </button>
          </ActionForm>
        ) : (
          <ReportButton kind="post" id={post.id} back={back} />
        )}
      </div>
      {post.comments.length > 0 && (
        <ul className="wf-list">
          {post.comments.map((c) => (
            <li key={c.id} className="wf-member">
              <div className="wf-member__who">
                <span>
                  <a className="wf-member__name" href={`/people/${c.author.id}`}>
                    {c.author.name}
                  </a>{" "}
                  <span className="wf-muted">{timeAgo(c.createdAt)}</span>
                </span>
                <span style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{c.body}</span>
              </div>
              <div className="wf-actions">
                {c.mine ? (
                  <ActionForm action={removeCommentAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="wf-link-button" type="submit">
                      Remove
                    </button>
                  </ActionForm>
                ) : (
                  <ReportButton kind="comment" id={c.id} back={back} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!full && post.commentCount > post.comments.length && (
        <p>
          <a className="wf-link-button" href={`/notes/${post.id}`}>
            Show all {post.commentCount} comments
          </a>
        </p>
      )}
      <ActionForm action={commentAction} resetOnSuccess className="wf-stack" showDone={false}>
        <input type="hidden" name="id" value={post.id} />
        <label className="sr-only" htmlFor={`comment-${post.id}`}>
          Write a comment
        </label>
        <textarea id={`comment-${post.id}`} name="body" rows={1} maxLength={500} placeholder="Write a comment…" required />
        <div>
          <button className="button button--secondary wf-small" type="submit">
            Comment
          </button>
        </div>
      </ActionForm>
    </article>
  );
}
