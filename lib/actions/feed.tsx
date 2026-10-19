"use server";

import type { ReactNode } from "react";
import { AsksCard, GroupsCard, MEMORIES, MemoryCard, PeopleCard } from "../../components/home/more-from-hkbk";
import { Post } from "../../components/social/post";
import { asksFor } from "../server/asks";
import { groupsFor } from "../server/groups";
import { peopleToMeet } from "../server/people";
import { isSenior } from "../server/roles";
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

/**
 * After the last post, Home carries on (as LinkedIn's does) with "More from HKBK", a page at
 * a time: first people to meet, a photo memory and (for seniors) questions waiting; then
 * groups and more memories; then the college's albums, three photos a card, until they've
 * all been seen. `next` is the page after, or null at the very end.
 */
export async function moreFromHkbkAction(page: number): Promise<{ cards: ReactNode; next: number | null }> {
  const me = await actor();
  if (!me || !Number.isSafeInteger(page) || page < 0) return { cards: null, next: null };
  const cards: ReactNode[] = [];
  let memories: number[];
  if (page === 0) {
    const [people, asks] = await Promise.all([peopleToMeet(me, 4), isSenior(me) ? asksFor(me) : Promise.resolve(null)]);
    const photos = await photoIdsOf(people.map((u) => u.id));
    cards.push(<PeopleCard key="people" people={people} photos={photos} />);
    memories = [0];
    if (asks) cards.push(<AsksCard key="asks" asks={asks.forMe.filter((a) => a.status === "open").slice(0, 3)} />);
  } else if (page === 1) {
    const { discover } = await groupsFor(me);
    memories = [1, 2];
    cards.push(<GroupsCard key="groups" groups={discover.slice(0, 3)} />);
  } else {
    const first = 3 + (page - 2) * 3;
    memories = [first, first + 1, first + 2];
  }
  for (const i of memories) {
    const m = MEMORIES[i];
    if (m) cards.push(<MemoryCard key={`memory-${i}`} album={m.album} photos={m.photos} />);
  }
  const last = memories[memories.length - 1];
  return { cards, next: last + 1 < MEMORIES.length ? page + 1 : null };
}