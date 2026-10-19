-- Replies and reactions to a story arrive as direct messages to the story's author (as on
-- Instagram or WhatsApp). The message remembers which story it answered, so the thread can
-- show a small picture of it ("Replied to your story"), and which quick reaction it was, if
-- it was one (the body then holds the same emoji, so older readers still show something).
-- A story that's later deleted for good leaves the message, without its picture.
-- Runs after 20261018000004_post_tags_verified.sql; safe to run again.

alter table messages add column if not exists story_id bigint references stories(id) on delete set null;
alter table messages add column if not exists reaction text;
create index if not exists messages_story on messages(story_id) where story_id is not null;
