"use server";

import type { ReactNode } from "react";
import { Post } from "../../components/social/post";
import { feedFor, type FeedScope } from "../server/posts";
import { photoIdsOf } from "../server/profile";
import { actor } from "./common";

/** How many posts each scroll brings in (the same as Home's first page). */
const PAGE = 15;

/**
 * The next posts of Home's feed, older than `before`, drawn on the server exactly as the
 * first page is (so reacting, commenting and reporting work the same), for the feed to add
 * as its reader scrolls. `next` is where the page after starts, or null at the end.
 */
export async function olderPostsAction(scope: FeedScope, before: number): Promise<{ posts: ReactNode; next: number | null }> {
  const me = await actor();
  if (!me || !Number.isSafeInteger(before) || before <= 0) return { posts: null, next: null };
  const posts = await feedFor(me, { limit: PAGE, before, scope: scope === "following" ? "following" : "all" });
  const photos = await photoIdsOf([me.id, ...posts.flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)])]);
  return {
    posts: posts.map((p) => <Post key={p.id} post={p} photos={photos} me={me} />),
    next: posts.length === PAGE ? posts[posts.length - 1].createdAt : null
  };
}
