-- Members the college added on someone's behalf. They arrive with a shared password, so
-- every page asks them to choose their own until they do. Cleared by changePassword().
alter table users add column if not exists must_change_password integer not null default 0;
