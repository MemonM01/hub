-- New tables, sequences and functions in public never grant anything to anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
revoke execute on function public.set_updated_at() from anon, authenticated;
