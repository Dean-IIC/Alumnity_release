-- Posts stay one kind of thing: #tags say what a post is about (#job, #internship, #notice…),
-- and the college can verify a post, which puts it on the HKBK board. This replaces the
-- separate openings of 20261018000003 (live for an afternoon, never used: both tables were
-- empty), so those go.
-- Runs after 20261018000003_openings.sql; safe to run again.

create table if not exists post_tags (
  post_id bigint not null references posts(id) on delete cascade,
  tag text not null,
  primary key (post_id, tag)
);
create index if not exists post_tags_tag on post_tags(tag, post_id);

-- The college's check mark: when, and which member of the desk gave it.
alter table posts add column if not exists verified_at bigint;
alter table posts add column if not exists verified_by bigint references users(id) on delete set null;
create index if not exists posts_verified on posts(verified_at);

drop table if exists referral_requests;
drop table if exists openings;

-- Locked to the public API, as every other table: only the server reads and writes it.
alter table post_tags enable row level security;
