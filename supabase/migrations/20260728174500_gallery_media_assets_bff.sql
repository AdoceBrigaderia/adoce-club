begin;

revoke insert, update, delete on public.flavor_images from authenticated;
revoke insert, update, delete on public.commercial_media_items from authenticated;
revoke select on public.gallery_media_versions from authenticated;

drop policy if exists gallery_media_versions_manager_read
  on public.gallery_media_versions;

create or replace function public.manager_assert_gallery_media_access()
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

revoke all on function public.manager_assert_gallery_media_access()
  from public, anon;
grant execute on function public.manager_assert_gallery_media_access()
  to authenticated;

create or replace function public.manager_get_gallery_media_workspace()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.manager_assert_gallery_media_access();

  return jsonb_build_object(
    'flavors', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.name)
      from (
        select f.id, f.name, f.active
        from public.flavors f
      ) source_row
    ), '[]'::jsonb),
    'flavor_images', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.flavor_id, source_row.sort_order, source_row.id)
      from (
        select
          image.id,
          image.flavor_id,
          image.image_path,
          image.original_image_path,
          image.alt_text,
          image.caption,
          image.image_role,
          image.sort_order,
          image.active
        from public.flavor_images image
      ) source_row
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.name)
      from (
        select product.id, product.name, product.segment, product.active
        from public.commercial_products product
      ) source_row
    ), '[]'::jsonb),
    'commercial_media', coalesce((
      select jsonb_agg(to_jsonb(source_row) order by coalesce(source_row.product_id::text, source_row.segment), source_row.sort_order, source_row.id)
      from (
        select
          media.id,
          media.segment,
          media.product_id,
          media.media_type,
          media.image_url,
          media.original_image_url,
          media.external_url,
          media.alt_text,
          media.caption,
          media.sort_order,
          media.active
        from public.commercial_media_items media
      ) source_row
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.manager_get_gallery_media_workspace()
  from public, anon;
grant execute on function public.manager_get_gallery_media_workspace()
  to authenticated;

create or replace function public.manager_save_gallery_media_asset(
  requested_owner_kind text,
  requested_owner_id text,
  requested_image_url text,
  requested_original_image_url text default null,
  requested_media_id uuid default null,
  requested_alt_text text default '',
  requested_caption text default '',
  requested_role text default 'gallery',
  requested_sort_order integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_kind text := btrim(coalesce(requested_owner_kind, ''));
  normalized_owner text := btrim(coalesce(requested_owner_id, ''));
  normalized_image text := btrim(coalesce(requested_image_url, ''));
  normalized_original text := nullif(btrim(coalesce(requested_original_image_url, '')), '');
  normalized_alt text := left(btrim(coalesce(requested_alt_text, '')), 300);
  normalized_caption text := left(btrim(coalesce(requested_caption, '')), 500);
  normalized_role text := left(coalesce(nullif(btrim(coalesce(requested_role, '')), ''), 'gallery'), 50);
  owner_uuid uuid;
  media_uuid uuid := requested_media_id;
  resolved_sort integer;
  active_count integer := 0;
  affected integer := 0;
begin
  perform public.manager_assert_gallery_media_access();

  if normalized_kind not in (
    'flavor-gallery',
    'commercial-product-gallery',
    'commercial-segment-gallery'
  ) then
    raise exception 'Tipo de galeria inválido.' using errcode = '22023';
  end if;
  if normalized_owner = '' then
    raise exception 'Identificador da galeria obrigatório.' using errcode = '22023';
  end if;
  if normalized_image !~ '^https://[^/]+/storage/v1/object/public/adoce-media/' then
    raise exception 'A imagem final deve pertencer ao armazenamento oficial da Adoce.' using errcode = '22023';
  end if;
  if normalized_original is not null
     and normalized_original !~ '^https://[^/]+/storage/v1/object/public/adoce-media/' then
    raise exception 'A imagem original deve pertencer ao armazenamento oficial da Adoce.' using errcode = '22023';
  end if;
  if requested_sort_order is not null and (requested_sort_order < 0 or requested_sort_order > 100000) then
    raise exception 'Ordem da mídia inválida.' using errcode = '22023';
  end if;

  if normalized_kind = 'commercial-segment-gallery' then
    if normalized_owner !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then
      raise exception 'Identificador da categoria inválido.' using errcode = '22023';
    end if;
  else
    begin
      owner_uuid := normalized_owner::uuid;
    exception when invalid_text_representation then
      raise exception 'Identificador da galeria inválido.' using errcode = '22023';
    end;
  end if;

  if normalized_kind = 'flavor-gallery' then
    if not exists (select 1 from public.flavors where id = owner_uuid) then
      raise exception 'Sabor não encontrado.' using errcode = 'P0002';
    end if;

    if media_uuid is null then
      select count(*)::integer,
             coalesce(max(sort_order) + 10, 10)
        into active_count, resolved_sort
      from public.flavor_images
      where flavor_id = owner_uuid and active;

      if active_count >= 8 then
        raise exception 'A galeria já atingiu o limite de 8 mídias.' using errcode = '22023';
      end if;

      insert into public.flavor_images (
        flavor_id,
        image_path,
        original_image_path,
        alt_text,
        caption,
        image_role,
        sort_order,
        active
      ) values (
        owner_uuid,
        normalized_image,
        normalized_original,
        normalized_alt,
        normalized_caption,
        normalized_role,
        coalesce(requested_sort_order, resolved_sort),
        true
      ) returning id into media_uuid;
    else
      update public.flavor_images
         set image_path = normalized_image,
             original_image_path = normalized_original,
             alt_text = normalized_alt,
             caption = normalized_caption,
             image_role = normalized_role,
             sort_order = coalesce(requested_sort_order, sort_order),
             active = true
       where id = media_uuid
         and flavor_id = owner_uuid;
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'A mídia não pertence à galeria informada.' using errcode = 'P0002';
      end if;
    end if;
  else
    if normalized_kind = 'commercial-product-gallery'
       and not exists (select 1 from public.commercial_products where id = owner_uuid) then
      raise exception 'Produto não encontrado.' using errcode = 'P0002';
    end if;

    if media_uuid is null then
      if normalized_kind = 'commercial-product-gallery' then
        select count(*)::integer,
               coalesce(max(sort_order) + 10, 10)
          into active_count, resolved_sort
        from public.commercial_media_items
        where product_id = owner_uuid and active;
      else
        select count(*)::integer,
               coalesce(max(sort_order) + 10, 10)
          into active_count, resolved_sort
        from public.commercial_media_items
        where segment = normalized_owner and product_id is null and active;
      end if;

      if active_count >= 8 then
        raise exception 'O carrossel já atingiu o limite de 8 mídias.' using errcode = '22023';
      end if;

      insert into public.commercial_media_items (
        segment,
        product_id,
        media_type,
        image_url,
        original_image_url,
        external_url,
        alt_text,
        caption,
        sort_order,
        active,
        created_by,
        updated_by
      ) values (
        case when normalized_kind = 'commercial-segment-gallery' then normalized_owner else null end,
        case when normalized_kind = 'commercial-product-gallery' then owner_uuid else null end,
        'image',
        normalized_image,
        normalized_original,
        null,
        normalized_alt,
        normalized_caption,
        coalesce(requested_sort_order, resolved_sort),
        true,
        (select auth.uid()),
        (select auth.uid())
      ) returning id into media_uuid;
    else
      update public.commercial_media_items
         set segment = case when normalized_kind = 'commercial-segment-gallery' then normalized_owner else null end,
             product_id = case when normalized_kind = 'commercial-product-gallery' then owner_uuid else null end,
             media_type = 'image',
             image_url = normalized_image,
             original_image_url = normalized_original,
             external_url = null,
             alt_text = normalized_alt,
             caption = normalized_caption,
             sort_order = coalesce(requested_sort_order, sort_order),
             active = true,
             updated_by = (select auth.uid())
       where id = media_uuid
         and (
           (normalized_kind = 'commercial-product-gallery' and product_id = owner_uuid)
           or
           (normalized_kind = 'commercial-segment-gallery' and product_id is null and segment = normalized_owner)
         );
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'A mídia não pertence ao carrossel informado.' using errcode = 'P0002';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'owner_kind', normalized_kind,
    'owner_id', normalized_owner,
    'media_id', media_uuid,
    'image_url', normalized_image,
    'original_image_url', normalized_original,
    'saved_at', now()
  );
end;
$$;

revoke all on function public.manager_save_gallery_media_asset(text, text, text, text, uuid, text, text, text, integer)
  from public, anon;
grant execute on function public.manager_save_gallery_media_asset(text, text, text, text, uuid, text, text, text, integer)
  to authenticated;

create or replace function public.manager_disable_gallery_media(
  requested_owner_kind text,
  requested_owner_id text,
  requested_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_kind text := btrim(coalesce(requested_owner_kind, ''));
  normalized_owner text := btrim(coalesce(requested_owner_id, ''));
  owner_uuid uuid;
  affected integer := 0;
begin
  perform public.manager_assert_gallery_media_access();

  if normalized_kind not in (
    'flavor-gallery',
    'commercial-product-gallery',
    'commercial-segment-gallery'
  ) then
    raise exception 'Tipo de galeria inválido.' using errcode = '22023';
  end if;

  if normalized_kind = 'commercial-segment-gallery' then
    if normalized_owner !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then
      raise exception 'Identificador da categoria inválido.' using errcode = '22023';
    end if;
  else
    begin
      owner_uuid := normalized_owner::uuid;
    exception when invalid_text_representation then
      raise exception 'Identificador da galeria inválido.' using errcode = '22023';
    end;
  end if;

  if normalized_kind = 'flavor-gallery' then
    update public.flavor_images
       set active = false
     where id = requested_media_id and flavor_id = owner_uuid;
  elsif normalized_kind = 'commercial-product-gallery' then
    update public.commercial_media_items
       set active = false,
           updated_by = (select auth.uid())
     where id = requested_media_id and product_id = owner_uuid;
  else
    update public.commercial_media_items
       set active = false,
           updated_by = (select auth.uid())
     where id = requested_media_id and product_id is null and segment = normalized_owner;
  end if;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'A mídia não pertence à galeria informada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'owner_kind', normalized_kind,
    'owner_id', normalized_owner,
    'media_id', requested_media_id,
    'active', false,
    'disabled_at', now()
  );
end;
$$;

revoke all on function public.manager_disable_gallery_media(text, text, uuid)
  from public, anon;
grant execute on function public.manager_disable_gallery_media(text, text, uuid)
  to authenticated;

create or replace function public.manager_list_gallery_media_versions(
  requested_media_key text,
  requested_limit integer default 20
)
returns table (
  id uuid,
  media_key text,
  media_kind text,
  media_id uuid,
  owner_kind text,
  owner_id text,
  label text,
  media_type text,
  image_url text,
  original_image_url text,
  external_url text,
  alt_text text,
  caption text,
  role text,
  sort_order integer,
  active boolean,
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
  normalized_key text := btrim(coalesce(requested_media_key, ''));
begin
  perform public.manager_assert_gallery_media_access();

  if normalized_key !~ '^(flavor-media|commercial-media):[0-9a-fA-F-]{36}$' then
    raise exception 'Identificador do histórico inválido.' using errcode = '22023';
  end if;

  return query
  select
    version.id,
    version.media_key,
    version.media_kind,
    version.media_id,
    version.owner_kind,
    version.owner_id,
    version.label,
    version.media_type,
    version.image_url,
    version.original_image_url,
    version.external_url,
    version.alt_text,
    version.caption,
    version.role,
    version.sort_order,
    version.active,
    version.change_type,
    version.changed_by,
    version.changed_by_name,
    version.changed_at
  from public.gallery_media_versions version
  where version.media_key = normalized_key
  order by version.changed_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.manager_list_gallery_media_versions(text, integer)
  from public, anon;
grant execute on function public.manager_list_gallery_media_versions(text, integer)
  to authenticated;

create or replace function public.manager_restore_gallery_media_version(
  requested_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.gallery_media_versions%rowtype;
  affected integer := 0;
begin
  perform public.manager_assert_gallery_media_access();

  select * into version_row
  from public.gallery_media_versions
  where id = requested_version_id;

  if not found then
    raise exception 'Versão da mídia não encontrada.' using errcode = 'P0002';
  end if;

  if version_row.owner_kind = 'flavor-gallery' then
    if version_row.media_type <> 'image' or version_row.image_url is null then
      raise exception 'A galeria de sabores aceita apenas imagens.' using errcode = '22023';
    end if;
    update public.flavor_images
       set image_path = version_row.image_url,
           original_image_path = version_row.original_image_url,
           alt_text = version_row.alt_text,
           caption = version_row.caption,
           image_role = coalesce(version_row.role, 'gallery'),
           sort_order = version_row.sort_order,
           active = true
     where id = version_row.media_id
       and flavor_id::text = version_row.owner_id;
  elsif version_row.owner_kind in ('commercial-product-gallery', 'commercial-segment-gallery') then
    update public.commercial_media_items
       set segment = case when version_row.owner_kind = 'commercial-segment-gallery' then version_row.owner_id else null end,
           product_id = case when version_row.owner_kind = 'commercial-product-gallery' then version_row.owner_id::uuid else null end,
           media_type = version_row.media_type,
           image_url = version_row.image_url,
           original_image_url = version_row.original_image_url,
           external_url = version_row.external_url,
           alt_text = version_row.alt_text,
           caption = version_row.caption,
           sort_order = version_row.sort_order,
           active = true,
           updated_by = (select auth.uid())
     where id = version_row.media_id;
  else
    raise exception 'Tipo de versão não suportado.' using errcode = '22023';
  end if;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'A mídia relacionada à versão não foi encontrada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'version_id', version_row.id,
    'media_key', version_row.media_key,
    'media_id', version_row.media_id,
    'owner_kind', version_row.owner_kind,
    'owner_id', version_row.owner_id,
    'restored_at', now()
  );
end;
$$;

revoke all on function public.manager_restore_gallery_media_version(uuid)
  from public, anon;
grant execute on function public.manager_restore_gallery_media_version(uuid)
  to authenticated;

commit;
