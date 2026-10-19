import Link from "next/link";
import "../../app/styles/posts-plus.css";

/** A post's address inside a message ("/notes/12"), as Send and referral requests write it. */
const POST_LINK = /(\/notes\/\d{1,12})(?!\w)/g;

/**
 * A message's words, with any post's address in it as a link to that post (a post sent
 * with Send, or a referral request). Everything else stays plain text. The post itself is
 * still checked when it's opened: a link shows nothing to someone who may not see it.
 */
export function MessageText({ body }: { body: string }) {
  const parts = body.split(POST_LINK);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} className="message-post-link" href={part}>
            Open the post <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
