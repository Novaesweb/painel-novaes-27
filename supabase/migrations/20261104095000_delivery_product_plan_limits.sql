-- Master 1: limite de produtos ATIVOS por loja, sem alterar pedidos ou registros existentes.
-- Compatível com Supabase compartilhado, onde a identidade oficial é public.managed_sites.id.
-- Apenas planos comerciais NOVAES_BUSINESS e NOVAES_PREMIUM possuem limites fixos.
create index if not exists delivery_products_active_store_idx
  on public.delivery_products (store_id) where is_active = true;

create or replace function delivery_private.enforce_active_product_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  official_plan text;
  max_active integer;
  current_active bigint;
begin
  if new.is_active is distinct from true then return new; end if;

  -- A edição de produto já ativo não consome uma vaga adicional.
  if tg_op = 'UPDATE' and old.is_active = true and old.store_id = new.store_id then
    return new;
  end if;

  -- Serialização POR LOJA: impede dois cadastros concorrentes ultrapassarem o limite.
  select m.plan_code into official_plan
    from public.managed_sites as m
   where m.id = new.store_id
   for update;
  if not found then
    raise exception 'STORE_NOT_FOUND' using errcode = '23503';
  end if;

  max_active := case official_plan
    when 'NOVAES_BUSINESS' then 200
    when 'NOVAES_PREMIUM' then 500
    else null
  end;
  -- Não inventar limite para plano legado/Empresarial sem contrato confirmado.
  if max_active is null then return new; end if;

  select count(*) into current_active
    from public.delivery_products as p
   where p.store_id = new.store_id and p.is_active = true;

  if current_active >= max_active then
    raise exception 'PRODUCT_ACTIVE_LIMIT_REACHED: % of % active products', current_active, max_active
      using errcode = '23514', detail = 'Desative um produto antes de cadastrar ou ativar outro.';
  end if;
  return new;
end;
$$;

revoke all on function delivery_private.enforce_active_product_plan_limit()
  from public, anon, authenticated;

drop trigger if exists enforce_active_product_plan_limit on public.delivery_products;
create trigger enforce_active_product_plan_limit
before insert or update of is_active,store_id
on public.delivery_products
for each row
execute function delivery_private.enforce_active_product_plan_limit();
