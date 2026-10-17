-- Accounts the college keeps rather than people (the "HKBK Alumni Association" that owns
-- the old portal's posts and events). They're never suggested, found in People, or asked to
-- connect: there's nobody behind them to answer.
-- Runs after 20261018000001; safe to run again.

alter table users add column if not exists college_account integer not null default 0;
