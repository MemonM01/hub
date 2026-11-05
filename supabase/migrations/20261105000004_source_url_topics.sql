-- Files added from a web link keep where they came from; files and modules get topics.
alter table public.files add column if not exists source_url text;
alter table public.files add column if not exists topic text;
alter table public.modules add column if not exists topics text[] not null default '{}';
create unique index if not exists files_user_source_url on public.files (user_id, source_url) where source_url is not null;
alter table public.files drop constraint if exists files_source_check;
alter table public.files add constraint files_source_check check (source in ('upload', 'minerva', 'link'));
