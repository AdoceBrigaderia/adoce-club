begin;

create index if not exists staff_quick_sale_favorites_flavor_idx
  on public.staff_quick_sale_favorites (flavor_id, staff_profile_id);

create policy staff_quick_sale_favorites_deny_direct
  on public.staff_quick_sale_favorites
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.staff_quick_sale_favorites is
  'Preferências privadas da venda rápida. Acesso direto de anon/authenticated é negado; operações passam pelo BFF e RPCs autorizados.';

comment on policy staff_quick_sale_favorites_deny_direct
  on public.staff_quick_sale_favorites is
  'Defesa explícita contra acesso direto à tabela; o BFF chama RPCs com validação de capacidade e auth.uid().';

commit;
