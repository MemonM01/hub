-- Lecture preview images, copied from Panopto by the bookmarklet into R2.
alter table public.lectures add column if not exists thumbnail_key text;
