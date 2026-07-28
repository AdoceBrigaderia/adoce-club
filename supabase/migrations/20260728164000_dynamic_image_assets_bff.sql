begin;

create or replace function public.manager_assert_dynamic_image_access()
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (select private.is_manager()) then
    raise exception 'Acesso restrito a proprietário e gerente.' using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke all on function public.manager_assert_dynamic_image_access()
  from public, anon;
grant execute on function public.manager_assert_dynamic_image_access()
  to authenticated;

create or replace function public.manager_get_dynamic_image_workspace()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.manager_assert_dynamic_image_access();

  return jsonb_build_object(
    'flavors', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.name)
      from (
        select
          f.id,
          f.name,
          f.image_path,
          f.whole_cake_image_path,
          f.whole_cake_original_image_path,
          f.whole_cake_available,
          f.active
        from public.flavors f
      ) source_row
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.name)
      from (
        select
          p.id,
          p.name,
          p.segment,
          p.image_url,
          p.original_image_url,
          p.active
        from public.commercial_products p
      ) source_row
    ), '[]'::jsonb),
    'segments', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.segment)
      from (
        select
          s.segment,
          s.image_url,
          s.original_image_url
        from public.commercial_segment_media s
      ) source_row
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.manager_get_dynamic_image_workspace()
  from public, anon;
grant execute on function public.manager_get_dynamic_image_workspace()
  to authenticated;

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
           whole_cake_original_image_path = normalized_original,
           whole_cake_available = true
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

revoke all on function public.manager_save_dynamic_image_asset(text, text, text, text, text)
  from public, anon;
grant execute on function public.manager_save_dynamic_image_asset(text, text, text, text, text)
  to authenticated;

create or replace function public.manager_list_dynamic_image_versions(
  requested_asset_key text,
  requested_limit integer default 20
)
returns table (
  id uuid,
  asset_key text,
  asset_kind text,
  owner_id text,
  label text,
  image_url text,
  original_image_url text,
  change_type text,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(requested_limit, 20), 1), 50);
  normalized_key text := btrim(coalesce(requested_asset_key, ''));
begin
  perform public.manager_assert_dynamic_image_access();

  if normalized_key !~ '^(flavor|product|segment):[a-zA-Z0-9_-]+:(cover|whole-cake)$' then
    raise exception 'Identificador do histórico inválido.' using errcode = '22023';
  end if;

  return query
  select
    v.id,
    v.asset_key,
    v.asset_kind,
    v.owner_id,
    v.label,
    v.image_url,
    v.original_image_url,
    v.change_type,
    v.changed_by,
    v.changed_by_name,
    v.changed_at
  from public.dynamic_image_asset_versions v
  where v.asset_key = normalized_key
  order by v.changed_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.manager_list_dynamic_image_versions(text, integer)
  from public, anon;
grant execute on function public.manager_list_dynamic_image_versions(text, integer)
  to authenticated;

create or replace function public.manager_restore_dynamic_image_version(
  requested_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.dynamic_image_asset_versions%rowtype;
  owner_uuid uuid;
  affected integer := 0;
begin
  perform public.manager_assert_dynamic_image_access();

  select * into version_row
  from public.dynamic_image_asset_versions
  where id = requested_version_id;

  if not found then
    raise exception 'Versão da imagem não encontrada.' using errcode = 'P0002';
  end if;

  if version_row.asset_kind <> 'commercial-segment' then
    owner_uuid := version_row.owner_id::uuid;
  end if;

  if version_row.asset_kind = 'flavor-cover' then
    update public.flavors
       set image_path = version_row.image_url
     where id = owner_uuid;
    get diagnostics affected = row_count;
  elsif version_row.asset_kind = 'whole-cake' then
    update public.flavors
       set whole_cake_image_path = version_row.image_url,
           whole_cake_original_image_path = version_row.original_image_url,
           whole_cake_available = true
     where id = owner_uuid;
    get diagnostics affected = row_count;
  elsif version_row.asset_kind = 'commercial-product' then
    update public.commercial_products
       set image_url = version_row.image_url,
           original_image_url = version_row.original_image_url,
           updated_by = (select auth.uid())
     where id = owner_uuid;
    get diagnostics affected = row_count;
  elsif version_row.asset_kind = 'commercial-segment' then
    update public.commercial_segment_media
       set image_url = version_row.image_url,
           original_image_url = version_row.original_image_url,
           updated_by = (select auth.uid())
     where segment = version_row.owner_id;
    get diagnostics affected = row_count;
  else
    raise exception 'Tipo de versão não suportado.' using errcode = '22023';
  end if;

  if affected <> 1 then
    raise exception 'O item relacionado à versão não foi encontrado.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'version_id', version_row.id,
    'asset_key', version_row.asset_key,
    'asset_kind', version_row.asset_kind,
    'owner_id', version_row.owner_id,
    'image_url', version_row.image_url,
    'original_image_url', version_row.original_image_url,
    'restored_at', now()
  );
end;
$$;

revoke all on function public.manager_restore_dynamic_image_version(uuid)
  from public, anon;
grant execute on function public.manager_restore_dynamic_image_version(uuid)
  to authenticated;

commit;
