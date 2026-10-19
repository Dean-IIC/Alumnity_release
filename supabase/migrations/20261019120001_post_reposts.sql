-- Reposts: a post can carry another post inside it, as LinkedIn's do. A plain repost has
-- no words of its own; "Repost with your thoughts" adds some. The original keeps its own
-- audience: anyone who can't see it is told "This post isn't available" instead.
-- If the original is ever hard-deleted, the repost stays and simply loses it.
-- Safe to run again.

alter table posts add column if not exists repost_of bigint references posts(id) on delete set null;

-- How many times a post was reposted, and "have I reposted this already?".
create index if not exists posts_repost_of on posts(repost_of, author) where repost_of is not null;
