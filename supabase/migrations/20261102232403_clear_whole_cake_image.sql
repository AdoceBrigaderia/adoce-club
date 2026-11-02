begin;

-- Permite excluir a foto da torta inteira G sem precisar substituí-la por outra.
-- manager_save_dynamic_image_asset só sabe gravar uma foto nova; faltava uma
-- forma de limpar o campo quando o gerente só quer remover a foto atual.
create or replace function public.manager_clear_dynamic_image_asset(
  requested_asset_kind text,
  requested_owner_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid;
  normalized_kind text := btrim(coalesce(requested_asset_kind, ''));
  normalized_owner text := btrim(coalesce(requested_owner_id, ''));
  affected integer := 0;
begin
  perform public.manager_assert_dynamic_image_access();

  if normalized_kind <> 'whole-cake' then
    raise exception 'Tipo de imagem dinâmica inválido para remoção.' using errcode = '22023';
  end if;
  if normalized_owner = '' then
    raise exception 'Identificador do item obrigatório.' using errcode = '22023';
  end if;

  begin
    owner_uuid := normalized_owner::uuid;
  exception when invalid_text_representation then
    raise exception 'Identificador do item inválido.' using errcode = '22023';
  end;

  update public.flavors
     set whole_cake_image_path = null,
         whole_cake_original_image_path = null,
         whole_cake_available = false
   where id = owner_uuid;
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'O item solicitado não foi encontrado.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'asset_kind', normalized_kind,
    'owner_id', normalized_owner,
    'cleared_at', now()
  );
end;
$$;

revoke all on function public.manager_clear_dynamic_image_asset(text, text)
  from public, anon;
grant execute on function public.manager_clear_dynamic_image_asset(text, text)
  to authenticated;

commit;
