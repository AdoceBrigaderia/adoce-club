begin;

-- Decisão do proprietário em 02/11/2026: o carrinho do site pede o WhatsApp
-- antes do nome; se esse WhatsApp já tem cadastro no Clube Adoce, o nome
-- preenche sozinho (sem login, sem código de confirmação -- não é
-- autenticação, é só identificar o pedido e atribuir os carimbos depois do
-- pagamento). Por isso esta função devolve apenas o nome, nunca outro dado
-- do cliente, e só pode ser chamada pelo service_role (a partir de uma
-- function do Netlify, nunca direto do navegador), que aplica limite de
-- tentativas por telefone e por IP antes de consultar.

create or replace function public.server_public_lookup_customer_name_by_phone(requested_phone text)
returns text
language plpgsql security definer set search_path='' as $$
declare found_name text;
begin
 if coalesce(requested_phone,'') !~ '^\+55[0-9]{10,11}$' then raise exception 'Telefone inválido'; end if;
 select p.full_name into found_name
 from public.profiles p
 where p.phone_e164 = requested_phone
   and p.active
   and p.account_status = 'active'
   and p.merged_into_profile_id is null
 order by p.updated_at desc
 limit 1;
 return found_name;
end;$$;

revoke all on function public.server_public_lookup_customer_name_by_phone(text) from public,anon,authenticated;
grant execute on function public.server_public_lookup_customer_name_by_phone(text) to service_role;

commit;
