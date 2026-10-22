begin;

-- Tela de decisão do inventário funcional (docs/25-inventario-funcional-completo.md):
-- o proprietario revisa cada funcao do sistema e registra o que fazer com ela
-- antes do rebranding. Mesmo padrao de seguranca das demais tabelas internas:
-- RLS + revoke publico + acesso so via RPC security definer restrita ao owner.

create table public.product_audit_items (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null,
  area text not null,
  item_name text not null,
  files text,
  access_route text,
  purpose text,
  frequency text,
  necessary text,
  recommendation text,
  status text not null default 'pending' check (status in ('pending', 'decided')),
  decision text,
  decision_note text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_audit_items_status_idx on public.product_audit_items (status, sort_order);

alter table public.product_audit_items enable row level security;
revoke all on public.product_audit_items from public, anon, authenticated;
grant all on public.product_audit_items to service_role;

create or replace function public.owner_list_audit_items()
returns setof public.product_audit_items
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.product_audit_items
  where private.is_owner()
  order by status = 'decided', sort_order;
$$;

create or replace function public.owner_set_audit_decision(
  target_id uuid,
  new_decision text,
  new_note text
)
returns public.product_audit_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.product_audit_items;
begin
  if not private.is_owner() then
    raise exception 'Apenas o proprietario pode registrar decisoes de auditoria.';
  end if;

  update public.product_audit_items
  set status = 'decided',
      decision = new_decision,
      decision_note = new_note,
      decided_at = now(),
      decided_by = auth.uid(),
      updated_at = now()
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Item de auditoria nao encontrado.';
  end if;

  return result;
end;
$$;

create or replace function public.owner_reopen_audit_item(target_id uuid)
returns public.product_audit_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.product_audit_items;
begin
  if not private.is_owner() then
    raise exception 'Apenas o proprietario pode reabrir itens de auditoria.';
  end if;

  update public.product_audit_items
  set status = 'pending',
      decision = null,
      decision_note = null,
      decided_at = null,
      decided_by = null,
      updated_at = now()
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Item de auditoria nao encontrado.';
  end if;

  return result;
end;
$$;

revoke all on function public.owner_list_audit_items() from public, anon;
revoke all on function public.owner_set_audit_decision(uuid, text, text) from public, anon;
revoke all on function public.owner_reopen_audit_item(uuid) from public, anon;
grant execute on function public.owner_list_audit_items() to authenticated;
grant execute on function public.owner_set_audit_decision(uuid, text, text) to authenticated;
grant execute on function public.owner_reopen_audit_item(uuid) to authenticated;

commit;
