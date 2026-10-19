-- Supabase only (PGlite skips files named "storage"): the public bucket for the college's
-- showcase, the gallery photos added from the college desk. Public, because the gallery is
-- public: anyone may see these files, by their address. Members' uploads stay in the
-- private bucket "media" (20261015000002_storage.sql), never here. No storage policies:
-- only the server's service key writes to it (the desk is checked on the server first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 20971520, null)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;
