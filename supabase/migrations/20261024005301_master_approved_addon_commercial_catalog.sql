-- Atualiza somente o catálogo comercial; preserva IDs/códigos, contratos e solicitações existentes.
-- Os quatro adicionais ausentes são criados como planned. Nenhuma instalação ou ativação.
begin;
create temporary table approved_addons(code text primary key,name text,price numeric,billing_type text,description text,sort_order int) on commit drop;
insert into approved_addons values
('novaes_fideliza','Novaes Fideliza',29,'monthly','Programa de pontos, benefícios e recompensas para clientes recorrentes.',100),
('novaes-gift','Novaes Gift',25,'monthly','Emissão e resgate de cartões-presente e vouchers digitais com saldo.',101),
('novaes-promo','Novaes Promo',15,'monthly','Banners, combos e ofertas no site reunidos em um único adicional, sem cobrança duplicada por essas funções.',102),
('novaes-marketing','Novaes Marketing',35,'monthly','Links rastreáveis, campanhas segmentadas e métricas de canais.',103),
('novaes-grupo','Novaes Pedido em Grupo',19,'monthly','Link compartilhável para pedidos coletivos entre amigos e colegas.',104),
('novaes-mesa','Novaes Mesa',39,'monthly','Cardápio QR Code por mesa, com pedidos identificados e painel da equipe, usando o cadastro da loja.',105),
('novaes-tv','Novaes TV',25,'monthly','Cardápio para televisores com preços, produtos, imagens, vídeos e ofertas já cadastrados na loja, sem recadastro.',106),
('novaes-whatsapp-notify','Novaes WhatsApp Notify',25,'monthly','Notificações automáticas de status de pedido via WhatsApp para o cliente.',107),
('novaes-360','Novaes 360°',29,'monthly','Visualizador interativo de produtos em 360°, com rotação visual de produtos compatíveis, inclusive pratos e pizzas.',108),
('novaes-finance','Novaes Finance',30,'monthly','Controle operacional de receitas, despesas e conciliação de recebíveis.',109),
('novaes-insights','Novaes Insights',20,'monthly','Relatórios de vendas, itens populares, horários de pico e ticket médio.',110),
('novaes-commerce-insights','Novaes Commerce Insights',39,'monthly','Análise de comportamento e vendas: produtos mais vistos e vendidos, funil, abandono de carrinho e oportunidades.',111),
('novaes-voz','Novaes Voz do Cliente',29,'monthly','Coleta e organiza avaliações e feedbacks, identificando reclamações recorrentes para melhoria do atendimento.',112),
('novaes-os','Novaes OS',39,'monthly','Gestão de Ordens de Serviço com etapas, técnicos responsáveis e prazos.',113),
('novaes-equipe','Novaes Equipe',20,'monthly','Escalas de funcionários, turnos e permissões de acesso da equipe.',114),
('novaes-multiusuario','Novaes Multiusuário',15,'monthly','Pacote de 3 administradores extras por R$ 15/mês, com login independente.',115),
('novaes-multiunidade','Novaes Multiunidade',39,'monthly','R$ 39/mês por filial extra, com gestão integrada e cadastros por unidade.',116),
('novaes-backup-plus','Novaes Backup Plus',null,'quote','Preço e escopo pendentes de aprovação. Retenção estendida de backups sem substituir os backups essenciais de segurança.',117),
('novaes-import','Novaes Import',49,'one_time','Importação de arquivos compatíveis por R$ 49 uma vez, reutilizável enquanto houver plano pago elegível ativo.',118);
-- Reconhecer divergência de código por nome antes de inserir; nunca duplicar um correspondente.
do $$ begin
 if exists(select 1 from approved_addons a join public.addon_catalog c
   on lower(c.name)=lower(a.name) and c.code<>a.code) then
   raise exception 'Adicional correspondente com outro código; preservar e reconciliar manualmente.';
 end if;
end $$;
with before_catalog as materialized (
 select id,price,billing_type,setup_fee,summary,description from public.addon_catalog
), updated as (
 update public.addon_catalog c set price=a.price,billing_type=a.billing_type,
   summary=case when a.code in ('novaes-tv','novaes-360','novaes-promo','novaes-import','novaes-backup-plus') then left(a.description,240) else c.summary end,
   description=case when a.code in ('novaes-tv','novaes-360','novaes-promo','novaes-import','novaes-backup-plus') then a.description else c.description end,
   setup_fee=0
 from approved_addons a where c.code=a.code
   and (c.price is distinct from a.price or c.billing_type is distinct from a.billing_type or c.setup_fee<>0
    or a.code in ('novaes-tv','novaes-360','novaes-promo','novaes-import','novaes-backup-plus') and c.description is distinct from a.description)
 returning c.id,c.code
)
insert into public.addon_audit_log(addon_id,action,metadata)
select u.id,'approved_commercial_catalog_corrected',jsonb_build_object('code',u.code,'authorization','Autorização expressa do proprietário na conversa','executor','supabase_migration','before',to_jsonb(b)-'id','historical_contracts_changed',false) from updated u join before_catalog b on b.id=u.id;
with inserted as (
 insert into public.addon_catalog(code,name,summary,description,icon,category,billing_type,price,setup_fee,development_status,is_visible,is_active,compatible_site_types,activation_location,integration_requirements,activation_rules,disable_rules,sort_order)
 select a.code,a.name,left(a.description,240),a.description,'PackagePlus','future',a.billing_type,a.price,0,'planned',true,true,array['*'],'client_panel',
   'Implementação e homologação pendentes; validar isolamento e permissões no backend.',
   'Exige módulo ready, check-in técnico available, compatibilidade e confirmação comercial do Master.',
   'Negar operações sem contratação ativa, preservando dados históricos.',a.sort_order
 from approved_addons a where not exists(select 1 from public.addon_catalog c where c.code=a.code)
 returning id,code
)
insert into public.addon_audit_log(addon_id,action,metadata)
select id,'approved_catalog_item_registered_planned',jsonb_build_object('code',code,'authorization','Autorização expressa do proprietário na conversa','implemented',false,'activated',false) from inserted;
-- Não criar cobranças por uma função já incluída no módulo Promo.
update public.addon_catalog set description='Serviço avulso de conteúdo com escopo previamente aprovado. A gestão de banners já incluída no Novaes Promo não gera cobrança adicional por utilização.'
where code='banner-update' and description is distinct from 'Serviço avulso de conteúdo com escopo previamente aprovado. A gestão de banners já incluída no Novaes Promo não gera cobrança adicional por utilização.';

-- Reforço no banco, inclusive para chamadas diretas ao backend existente.
create function public.novaesweb_approved_addon_commercial_terms(p_code text) returns jsonb
language sql immutable set search_path = '' as $$ select '{"novaes_fideliza": {"price": 29, "billing": "monthly"}, "novaes-gift": {"price": 25, "billing": "monthly"}, "novaes-promo": {"price": 15, "billing": "monthly"}, "novaes-marketing": {"price": 35, "billing": "monthly"}, "novaes-grupo": {"price": 19, "billing": "monthly"}, "novaes-mesa": {"price": 39, "billing": "monthly"}, "novaes-tv": {"price": 25, "billing": "monthly"}, "novaes-whatsapp-notify": {"price": 25, "billing": "monthly"}, "novaes-360": {"price": 29, "billing": "monthly"}, "novaes-finance": {"price": 30, "billing": "monthly"}, "novaes-insights": {"price": 20, "billing": "monthly"}, "novaes-commerce-insights": {"price": 39, "billing": "monthly"}, "novaes-voz": {"price": 29, "billing": "monthly"}, "novaes-os": {"price": 39, "billing": "monthly"}, "novaes-equipe": {"price": 20, "billing": "monthly"}, "novaes-multiusuario": {"price": 15, "billing": "monthly"}, "novaes-multiunidade": {"price": 39, "billing": "monthly"}, "novaes-backup-plus": {"price": null, "billing": "quote"}, "novaes-import": {"price": 49, "billing": "one_time"}}'::jsonb -> p_code $$;

create function public.novaesweb_guard_pending_addon_terms() returns trigger
language plpgsql set search_path = '' as $$
declare v_code text; v_rule jsonb; v_data jsonb:=to_jsonb(new);
begin
 if tg_table_name='addon_catalog' then v_code:=new.code;
 else select code into v_code from public.addon_catalog where id=new.addon_id; end if;
 v_rule:=public.novaesweb_approved_addon_commercial_terms(v_code);
 if v_rule is not null then
   if tg_table_name='addon_catalog' then
     if new.price is distinct from (v_rule->>'price')::numeric or new.billing_type is distinct from v_rule->>'billing' or new.setup_fee<>0 then
       raise exception 'CATALOG_TERMS_REQUIRE_APPROVED_PRICE_AND_NO_EXTRA_SETUP';
     end if;
   elsif tg_table_name='store_addons' and new.status='active' then
     if (v_data->>'contracted_price')::numeric is distinct from (v_rule->>'price')::numeric or v_data->>'billing_type' is distinct from v_rule->>'billing' or (v_data->>'setup_fee')::numeric is distinct from 0::numeric then
       raise exception 'ADDON_CONTRACT_TERMS_NOT_APPROVED';
     end if;
   elsif tg_table_name='addon_requests' and (v_data->>'commercial_confirmed_at' is not null or new.status='activated') then
     if (v_data->>'approved_price')::numeric is distinct from (v_rule->>'price')::numeric or (v_data->>'setup_fee')::numeric is distinct from 0::numeric then
       raise exception 'ADDON_REQUEST_TERMS_NOT_APPROVED';
     end if;
   end if;
 end if;
 if v_code='novaes-backup-plus' and tg_table_name<>'addon_catalog' then
   if tg_table_name='store_addons' and new.status='active' then
     raise exception 'BACKUP_PLUS_PRICE_AND_SCOPE_PENDING';
   elsif tg_table_name='addon_requests' and (new.status in ('approved','activated') or to_jsonb(new)->>'commercial_confirmed_at' is not null or to_jsonb(new)->>'approved_price' is not null) then
     raise exception 'BACKUP_PLUS_PRICE_AND_SCOPE_PENDING';
   end if;
 end if;
 if v_code='novaes-import' and tg_table_name='store_addons' and new.status='active' then
   if new.contracted_price is distinct from 49::numeric or new.setup_fee<>0 or new.billing_type<>'one_time' then
     raise exception 'IMPORT_REQUIRES_SINGLE_APPROVED_PRICE_49';
   end if;
   if not exists(select 1 from public.managed_sites s where s.id=new.store_id and s.status='active' and s.billing_active and
      (s.plan_code in ('NOVAES_BUSINESS','NOVAES_PREMIUM') or s.plan_code='NOVAES_EMPRESARIAL' and exists(
       select 1 from public.master_contracts c where c.store_id=s.id and c.plan_code=s.plan_code and c.status='active'))) then
     raise exception 'IMPORT_REQUIRES_ACTIVE_ELIGIBLE_PAID_PLAN';
   end if;
 end if;
 return new;
end $$;
revoke all on function public.novaesweb_guard_pending_addon_terms() from public,anon,authenticated;
create trigger addon_catalog_guard_approved_terms before insert or update on public.addon_catalog
 for each row execute function public.novaesweb_guard_pending_addon_terms();
create trigger addon_request_guard_pending_terms before insert or update on public.addon_requests
 for each row execute function public.novaesweb_guard_pending_addon_terms();
create trigger store_addon_guard_pending_terms before insert or update on public.store_addons
 for each row execute function public.novaesweb_guard_pending_addon_terms();
commit;
