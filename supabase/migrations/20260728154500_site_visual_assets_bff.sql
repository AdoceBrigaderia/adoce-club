begin;

revoke insert, update, delete on public.site_visual_assets from authenticated;
revoke select on public.site_visual_asset_versions from authenticated;
grant all on public.site_visual_assets to service_role;
grant all on public.site_visual_asset_versions to service_role;

create or replace function public.manager_assert_site_visual_access()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem administrar as imagens da Adoce';
  end if;
  return true;
end;
$$;

create or replace function public.manager_get_site_visual_assets_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.manager_assert_site_visual_access();

  return jsonb_build_object(
    'assets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'asset_key', asset.asset_key,
          'label', asset.label,
          'section', asset.section,
          'default_url', asset.default_url,
          'image_url', asset.image_url,
          'original_image_url', asset.original_image_url,
          'alt_text', asset.alt_text,
          'active', asset.active,
          'updated_at', asset.updated_at
        ) order by asset.section, asset.label
      )
      from public.site_visual_assets asset
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

create or replace function public.manager_list_site_visual_asset_versions(
  requested_asset_key text,
  requested_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(50, greatest(1, coalesce(requested_limit, 20)));
begin
  perform public.manager_assert_site_visual_access();

  if requested_asset_key is null
     or requested_asset_key !~ '^/(site|adoce-hoje|wallet)/[a-zA-Z0-9._/-]+$' then
    raise exception 'Identificador de imagem inválido';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', version.id,
        'asset_key', version.asset_key,
        'label', version.label,
        'section', version.section,
        'default_url', version.default_url,
        'image_url', version.image_url,
        'original_image_url', version.original_image_url,
        'alt_text', version.alt_text,
        'active', version.active,
        'change_type', version.change_type,
        'changed_by', version.changed_by,
        'changed_by_name', version.changed_by_name,
        'changed_at', version.changed_at
      ) order by version.changed_at desc
    )
    from (
      select *
      from public.site_visual_asset_versions history
      where history.asset_key = requested_asset_key
      order by history.changed_at desc
      limit safe_limit
    ) version
  ), '[]'::jsonb);
end;
$$;

create or replace function public.manager_save_site_visual_asset(
  requested_asset_key text,
  requested_label text,
  requested_section text,
  requested_default_url text,
  requested_image_url text,
  requested_original_image_url text default null,
  requested_alt_text text default '',
  requested_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.manager_assert_site_visual_access();

  if requested_asset_key is null
     or requested_asset_key !~ '^/(site|adoce-hoje|wallet)/[a-zA-Z0-9._/-]+$' then
    raise exception 'Identificador de imagem inválido';
  end if;
  if length(btrim(coalesce(requested_label, ''))) not between 3 and 120 then
    raise exception 'Nome da imagem inválido';
  end if;
  if length(btrim(coalesce(requested_section, ''))) not between 2 and 80 then
    raise exception 'Seção da imagem inválida';
  end if;
  if requested_default_url is null or requested_default_url !~ '^/' then
    raise exception 'Imagem padrão inválida';
  end if;
  if requested_image_url is null or requested_image_url !~ '^https?://' then
    raise exception 'URL da imagem inválida';
  end if;
  if requested_original_image_url is not null
     and requested_original_image_url !~ '^https?://' then
    raise exception 'URL da imagem original inválida';
  end if;
  if length(coalesce(requested_alt_text, '')) > 300 then
    raise exception 'Texto alternativo muito longo';
  end if;

  insert into public.site_visual_assets (
    asset_key,
    label,
    section,
    default_url,
    image_url,
    original_image_url,
    alt_text,
    active,
    updated_by
  ) values (
    requested_asset_key,
    btrim(requested_label),
    btrim(requested_section),
    requested_default_url,
    requested_image_url,
    requested_original_image_url,
    btrim(coalesce(requested_alt_text, '')),
    coalesce(requested_active, true),
    (select auth.uid())
  )
  on conflict (asset_key) do update set
    label = excluded.label,
    section = excluded.section,
    default_url = excluded.default_url,
    image_url = excluded.image_url,
    original_image_url = excluded.original_image_url,
    alt_text = excluded.alt_text,
    active = excluded.active,
    updated_by = excluded.updated_by
  returning jsonb_build_object(
    'asset_key', site_visual_assets.asset_key,
    'label', site_visual_assets.label,
    'section', site_visual_assets.section,
    'default_url', site_visual_assets.default_url,
    'image_url', site_visual_assets.image_url,
    'original_image_url', site_visual_assets.original_image_url,
    'alt_text', site_visual_assets.alt_text,
    'active', site_visual_assets.active,
    'updated_at', site_visual_assets.updated_at
  ) into result;

  return result;
end;
$$;

create or replace function public.manager_reset_site_visual_asset(
  requested_asset_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed jsonb;
begin
  perform public.manager_assert_site_visual_access();

  if requested_asset_key is null
     or requested_asset_key !~ '^/(site|adoce-hoje|wallet)/[a-zA-Z0-9._/-]+$' then
    raise exception 'Identificador de imagem inválido';
  end if;

  delete from public.site_visual_assets asset
  where asset.asset_key = requested_asset_key
  returning jsonb_build_object(
    'asset_key', asset.asset_key,
    'reset', true,
    'default_url', asset.default_url
  ) into removed;

  return coalesce(
    removed,
    jsonb_build_object('asset_key', requested_asset_key, 'reset', false)
  );
end;
$$;

create or replace function public.manager_restore_site_visual_asset_version(
  requested_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version public.site_visual_asset_versions%rowtype;
  result jsonb;
begin
  perform public.manager_assert_site_visual_access();

  select * into version
  from public.site_visual_asset_versions history
  where history.id = requested_version_id;

  if version.id is null then
    raise exception 'Versão da imagem não encontrada';
  end if;

  select public.manager_save_site_visual_asset(
    version.asset_key,
    version.label,
    version.section,
    version.default_url,
    version.image_url,
    version.original_image_url,
    version.alt_text,
    version.active
  ) into result;

  return result;
end;
$$;

revoke all on function public.manager_assert_site_visual_access()
  from public, anon, authenticated;
revoke all on function public.manager_get_site_visual_assets_workspace()
  from public, anon, authenticated;
revoke all on function public.manager_list_site_visual_asset_versions(text, integer)
  from public, anon, authenticated;
revoke all on function public.manager_save_site_visual_asset(text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.manager_reset_site_visual_asset(text)
  from public, anon, authenticated;
revoke all on function public.manager_restore_site_visual_asset_version(uuid)
  from public, anon, authenticated;

grant execute on function public.manager_assert_site_visual_access() to authenticated;
grant execute on function public.manager_get_site_visual_assets_workspace() to authenticated;
grant execute on function public.manager_list_site_visual_asset_versions(text, integer) to authenticated;
grant execute on function public.manager_save_site_visual_asset(text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.manager_reset_site_visual_asset(text) to authenticated;
grant execute on function public.manager_restore_site_visual_asset_version(uuid) to authenticated;

commit;
