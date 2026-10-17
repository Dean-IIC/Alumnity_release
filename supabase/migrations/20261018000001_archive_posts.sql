-- Posts brought over from the old HKBK alumni portal (notices, news), owned by the
-- college's "HKBK Alumni Association" account and dated as the portal had them. Marked so
-- the feed labels them as from the old portal and nobody takes them for new.
-- Runs after 20261016000002; safe to run again.

alter table posts add column if not exists from_archive integer not null default 0;
