"use client";

import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { moreFromHkbkAction, olderPostsAction } from "../../lib/actions/feed";
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
 * Home's feed, carrying on as its reader scrolls, like LinkedIn's: when the end comes near,
 * the next posts are fetched and added below (grey placeholders while they come). When the
 * posts run out it doesn't stop: "More from HKBK" follows (people, groups, questions, and the
 * college's photos, a card at a time) until there's truly nothing left. The "Older posts"
 * link stays underneath, for anyone without JavaScript or who'd rather tap.
 *
 * `filters`: Home's filters, as in its address ("tag=job&role=alumnus"). Every page that
 * follows keeps to them, and a filtered feed ends with its last matching post (what it was
 * narrowed to is done; "More from HKBK" would only be in the way). Give it a `key` that
 * changes with the filters, so a new set starts afresh. `empty`: the first page had no posts
 * (the page says so itself, so the end needn't).
 *
 * "More from HKBK" loads by itself for a few pages, then waits for a tap ("Show more"): it
 * can run to hundreds of cards (every album's photos), and a phone that kept them all
 * ran out of memory at the end of the feed. Each added page is fenced off, so one that
 * fails to draw shows "Try again" in its place rather than taking Home down with it.
 */
const AUTO_MORE = 4;
export function InfiniteFeed({ scope, next: first, filters = "", empty = false }: { scope: FeedScope; next: number | null; filters?: string; empty?: boolean }) {
  const filtered = filters !== "";
  const [pages, setPages] = useState<ReactNode[]>([]);
  // Posts first (the next one's time), then "more" pages (their number), then the end.
  const [cursor, setCursor] = useState<{ posts: number } | { more: number } | null>(first !== null ? { posts: first } : filtered ? null : { more: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || cursor === null) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      if ("posts" in cursor) {
        const result = await olderPostsAction(scope, cursor.posts, filters);
        setPages((list) => [...list, <Fenced key={`p${list.length}`}>{result.posts}</Fenced>]);
        setCursor(result.next !== null ? { posts: result.next } : filtered ? null : { more: 0 });
      } else {
        const result = await moreFromHkbkAction(cursor.more);
        setPages((list) => [...list, ...(cursor.more === 0 ? [<MoreHeading key="more" />] : []), <Fenced key={`m${list.length}`}>{result.cards}</Fenced>]);
        setCursor(result.next === null ? null : { more: result.next });
      }
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor, scope, filters, filtered]);

  useEffect(() => {
    const target = end.current;
    if (!target || cursor === null || failed) return;
    // Past the first few "More from HKBK" pages, only a tap loads more.
    if ("more" in cursor && cursor.more >= AUTO_MORE) return;
    // Start fetching a screen before the end, so it's there when the reader is.
    const watch = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: "900px 0px" });
    watch.observe(target);
    // The watcher only speaks when the end comes into reach. If a page was short and the end
    // is still in reach after it loaded, nothing would change: so look once more ourselves.
    const frame = requestAnimationFrame(() => {
      if (target.getBoundingClientRect().top < window.innerHeight + 900) void loadMore();
    });
    return () => {
      watch.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [loadMore, cursor, failed]);

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
            Couldn't load more posts. Try again
          </button>
        ) : cursor === null ? (
          filtered ? (
            empty ? null : <p className="feed-more__end">No more posts match these filters.</p>
          ) : (
            <p className="feed-more__end">You've seen everything on Alumnity for now. Come back later for new posts.</p>
          )
        ) : "more" in cursor && cursor.more >= AUTO_MORE ? (
          loading ? null : (
            <button type="button" className="button button--secondary wf-small" onClick={loadMore}>
              Show more from HKBK
            </button>
          )
        ) : "posts" in cursor ? (
          <Link href={`/home?${[scope === "following" ? "view=following" : "", filters, `before=${cursor.posts}`].filter(Boolean).join("&")}`}>Older posts →</Link>
        ) : null}
      </div>
    </>
  );
}

function MoreHeading() {
  return (
    <div className="more-heading" role="separator" aria-label="More from HKBK">
      <span>More from HKBK</span>
    </div>
  );
}

/** One added page, kept apart: if it can't be drawn, it says so (and the rest of Home stays). */
class Fenced extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    return this.state.broken ? <p className="feed-more__end">Some posts here couldn't be shown. Reload the page to try again.</p> : this.props.children;
  }
}
