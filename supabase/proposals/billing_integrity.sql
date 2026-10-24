-- Proposta preliminar preservada para histórico. Substituída no remoto auditado por 20261024005305_master_billing_integrity_verified.sql; não executar novamente.
-- PROPOSTA LOCAL, NÃO EXECUTADA. Requer revisão do backend financeiro antes de virar migration.
-- Primeiro auditar duplicidades, referências vazias e recebimentos históricos; não os alterar automaticamente.
begin;
-- Impede um item de ciclo de A apontar para loja B.
alter table public.master_billing_cycles add constraint master_billing_cycle_store_pair unique (id, store_id);
alter table public.master_billing_items add constraint master_billing_item_same_store
  foreign key (cycle_id, store_id) references public.master_billing_cycles(id, store_id) not valid;
-- Unicidade por origem mesmo se um reprocessamento tentar cobrar em outro ciclo.
-- Chaves exigidas no backend: criacao:<contrato>:1|2; mensalidade:<contrato>:AAAA-MM;
-- adicional-mensal:<contrato-adicional>:AAAA-MM; adicional-unico:<contrato-adicional>;
-- excedente:<store_id>:<competência-de-consumo> (cobrado na competência seguinte, vence dia 10).
create unique index master_billing_item_unique_origin
  on public.master_billing_items(store_id, kind, source_reference)
  where status <> 'void' and source_reference is not null;
alter table public.master_billing_items add constraint master_billing_origin_required
  check (kind = 'manual_adjustment' or nullif(btrim(source_reference), '') is not null) not valid;
-- NOT VALID mantém registros antigos sem reescrita, mas exige a regra para novas gravações.
-- Índice único falha em duplicidade histórica: investigar; jamais remover recebimentos para fazê-lo passar.
commit;
