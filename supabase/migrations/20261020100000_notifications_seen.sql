-- Notifications: "seen" (the bell's count, cleared by opening the notifications page) apart
-- from "read" (clicked, or answered elsewhere). Each one stays highlighted until it's read.
-- Safe to run more than once; nothing is removed.
alter table notifications add column if not exists seen_at bigint;
update notifications set seen_at = read_at where seen_at is null and read_at is not null;
create index if not exists notifications_unseen on notifications(user_id, seen_at);
