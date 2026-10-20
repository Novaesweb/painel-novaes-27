-- Permite que os painéis autenticados das lojas recebam novos itens do catálogo central.
-- O payload continua sujeito à policy RLS addon_catalog_read_authorized.
do $migration$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'PUBLICATION_SUPABASE_REALTIME_NOT_FOUND';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'addon_catalog'
  ) then
    execute 'alter publication supabase_realtime add table public.addon_catalog';
  end if;
end;
$migration$;
