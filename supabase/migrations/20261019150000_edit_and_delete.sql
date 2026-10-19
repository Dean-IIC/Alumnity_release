-- Editing and deleting, as chat apps and LinkedIn allow.
--
-- Messages: the sender may edit one for 15 minutes after sending it (both then see
-- "edited"), or delete it for everyone: its words are cleared here, not just hidden, and
-- both see "This message was deleted". Anyone may delete a message for themselves only
-- (message_hidden), or delete a whole conversation for themselves (chat_cleared: everything
-- up to that message is gone for them; if the other writes again, the new messages show).
--
-- Posts and comments: their writer may edit them (an "Edited" label, with when).
-- Runs after 20261019120001_post_reposts.sql; additive, and safe to run again.

alter table messages add column if not exists edited_at bigint;
alter table messages add column if not exists deleted_at bigint;

create table if not exists message_hidden (
  user_id bigint not null references users(id) on delete cascade,
  message_id bigint not null references messages(id) on delete cascade,
  hidden_at bigint not null,
  primary key (user_id, message_id)
);

create table if not exists chat_cleared (
  user_id bigint not null references users(id) on delete cascade,
  other_id bigint not null references users(id) on delete cascade,
  -- The newest message cleared: this one and every earlier one are gone for user_id.
  before_id bigint not null,
  cleared_at bigint not null,
  primary key (user_id, other_id)
);

alter table posts add column if not exists edited_at bigint;
alter table post_comments add column if not exists edited_at bigint;

-- Locked to the public API, as every other table: only the server reads and writes them.
alter table message_hidden enable row level security;
alter table chat_cleared enable row level security;
