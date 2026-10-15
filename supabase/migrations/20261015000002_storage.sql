-- Supabase only: the private bucket for members' uploads (profile photos, covers, post and
-- story photos and videos). Private: nothing in it is reachable without a short-lived signed
-- link, which Alumnity's server gives out only to members allowed to see the file
-- (app/media/[id]/route.ts). No storage policies: only the server's service key reads or writes.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
