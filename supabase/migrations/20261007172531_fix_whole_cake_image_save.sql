-- A foto pode ser preparada antes do preço; disponibilidade é uma decisão separada.
-- Preserve o estado publicado do produto ao salvar a imagem.
create or replace function public.manager_save_dynamic_image_asset(
  requested_asset_kind text,
  requested_owner_id text,
  requested_image_url text,
  requested_original_image_url text default null,
  requested_alt_text text default ''
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
  normalized_image text := btrim(coalesce(requested_image_url, ''));
  normalized_original text := nullif(btrim(coalesce(requested_original_image_url, '')), '');
  normalized_alt text := left(btrim(coalesce(requested_alt_text, '')), 300);
  affected integer := 0;
begin
  perform public.manager_assert_dynamic_image_access();

  if normalized_kind not in ('flavor-cover', 'whole-cake', 'commercial-product', 'commercial-segment') then
    raise exception 'Tipo de imagem dinâmica inválido.' using errcode = '22023';
  end if;
  if normalized_owner = '' then
    raise exception 'Identificador do item obrigatório.' using errcode = '22023';
  end if;
  if normalized_image !~ '^https://[^/]+/storage/v1/object/public/adoce-media/' then
    raise exception 'A imagem final deve pertencer ao armazenamento oficial da Adoce.' using errcode = '22023';
  end if;
  if normalized_original is not null
     and normalized_original !~ '^https://[^/]+/storage/v1/object/public/adoce-media/' then
    raise exception 'A imagem original deve pertencer ao armazenamento oficial da Adoce.' using errcode = '22023';
  end if;

  if normalized_kind <> 'commercial-segment' then
    begin
      owner_uuid := normalized_owner::uuid;
    exception when invalid_text_representation then
      raise exception 'Identificador do item inválido.' using errcode = '22023';
    end;
  elsif normalized_owner !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then
    raise exception 'Identificador da categoria inválido.' using errcode = '22023';
  end if;

  if normalized_kind = 'flavor-cover' then
    update public.flavors
       set image_path = normalized_image
     where id = owner_uuid;
    get diagnostics affected = row_count;
  elsif normalized_kind = 'whole-cake' then
    update public.flavors
       set whole_cake_image_path = normalized_image,
           whole_cake_original_image_path = normalized_original
     where id = owner_uuid;
    get diagnostics affected = row_count;
  elsif normalized_kind = 'commercial-product' then
    update public.commercial_products
       set image_url = normalized_image,
           original_image_url = normalized_original,
           updated_by = (select auth.uid())
     where id = owner_uuid;
    get diagnostics affected = row_count;
  else
    insert into public.commercial_segment_media (
      segment,
      image_url,
      original_image_url,
      alt_text,
      updated_by
    ) values (
      normalized_owner,
      normalized_image,
      normalized_original,
      normalized_alt,
      (select auth.uid())
    )
    on conflict (segment) do update
      set image_url = excluded.image_url,
          original_image_url = excluded.original_image_url,
          alt_text = excluded.alt_text,
          updated_by = excluded.updated_by;
    affected := 1;
  end if;

  if affected <> 1 then
    raise exception 'O item solicitado não foi encontrado.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'asset_kind', normalized_kind,
    'owner_id', normalized_owner,
    'image_url', normalized_image,
    'original_image_url', normalized_original,
    'saved_at', now()
  );
end;
$$;



