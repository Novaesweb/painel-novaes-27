-- Tabelas vazias no preflight: valida restrições sem alterar valores.
begin;
alter table public.master_billing_items validate constraint master_billing_item_same_store;
alter table public.master_billing_items validate constraint master_billing_origin_required;
commit;
