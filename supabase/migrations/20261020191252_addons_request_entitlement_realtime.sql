-- Realtime para as etapas do fluxo de adicionais. Os eventos continuam sujeitos às policies RLS.
do $migration$
declare
  v_table text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'PUBLICATION_SUPABASE_REALTIME_NOT_FOUND';
  end if;

  foreach v_table in array array['addon_requests', 'store_addons', 'store_addon_installations']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$migration$;
