"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { olderPostsAction } from "../../lib/actions/feed";
import type { FeedScope } from "../../lib/server/posts";

/** A post's shape while it loads: grey bars where the name, the words and the photo will be. */
export function PostSkeleton() {
  return (
    <div className="post post--skeleton" aria-hidden="true">
      <div className="skeleton-row">
        <span className="skeleton skeleton--circle" />
        <span className="skeleton-lines">
          <span className="skeleton skeleton--line" style={{ width: "40%" }} />
          <span className="skeleton skeleton--line" style={{ width: "25%" }} />
        </span>
      </div>
      <span className="skeleton skeleton--line" style={{ width: "90%" }} />
      <span className="skeleton skeleton--line" style={{ width: "70%" }} />
      <span className="skeleton skeleton--block" />
    </div>
  );
}

/**
 * Home's feed, carrying on as its reader scrolls: when the end comes near, the next posts
 * are fetched and added below, with grey placeholders while they come. The "Older posts"
 * link stays underneath, for anyone without JavaScript or who'd rather tap.
 */
export function InfiniteFeed({ scope, next: first }: { scope: FeedScope; next: number | null }) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const result = await olderPostsAction(scope, next);
      setPages((list) => [...list, result.posts]);
      setNext(result.next);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [next, scope]);

  useEffect(() => {
    const target = end.current;
    if (!target || next === null || failed) return;
    // Start fetching a screen before the end, so the posts are there when the reader is.
    const watch = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: "900px 0px" });
    watch.observe(target);
    return () => watch.disconnect();
  }, [loadMore, next, failed]);

  return (
    <>
      {pages}
      {loading && (
        <div role="status" aria-label="Loading more posts">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}
      <div ref={end} className="feed-more">
        {failed ? (
          <button type="button" className="button button--secondary wf-small" onClick={loadMore}>
            Couldn't load more. Try again
          </button>
        ) : next === null ? (
          <p className="feed-more__end">You're all caught up.</p>
        ) : (
          <a href={`/home?${scope === "following" ? "view=following&" : ""}before=${next}`}>Older posts →</a>
        )}
      </div>
    </>
  );
}
