-- Who has seen a post (once each): for the count its writer sees ("48 views"). Names are
-- never shown, only the number. Removed with the post or the member. Safe to run twice.
create table if not exists post_views (
  post_id bigint not null references posts(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  first_at bigint not null,
  primary key (post_id, user_id)
);
-- As every table: nothing through Supabase's public API (the server reads it directly).
alter table post_views enable row level security;
