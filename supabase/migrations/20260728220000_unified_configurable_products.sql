begin;

alter table public.commercial_products
  add column if not exists product_type text not null default 'fixed',
  add column if not exists customization_mode text not null default 'none',
  add column if not exists configuration_rules jsonb not null default '{}'::jsonb;

update public.commercial_products
set product_type = case
      when segment = 'cakes' then 'cake'
      when segment = 'sweets' then 'sweet'
      when segment = 'school' then 'school_kit'
      when lower(name) like '%biscoit%' or lower(slug) like '%biscoit%' then 'cookie'
      else 'fixed'
    end,
    customization_mode = case
      when segment = 'cakes' then 'cake_builder'
      when segment in ('sweets', 'school') then 'option_groups'
      else 'none'
    end
where product_type = 'fixed' and customization_mode = 'none';

alter table public.commercial_products
  drop constraint if exists commercial_products_product_type_check,
  add constraint commercial_products_product_type_check
    check (product_type in ('cake','sweet','cookie','school_kit','fixed')),
  drop constraint if exists commercial_products_customization_mode_check,
  add constraint commercial_products_customization_mode_check
    check (customization_mode in ('none','cake_builder','option_groups')),
  drop constraint if exists commercial_products_configuration_rules_object_check,
  add constraint commercial_products_configuration_rules_object_check
    check (jsonb_typeof(configuration_rules) = 'object');

alter table public.commercial_product_options
  add column if not exists option_code text,
  add column if not exists option_kind text not null default 'addon',
  add column if not exists unit_cost numeric(14,4) not null default 0,
  add column if not exists minimum_quantity integer not null default 1,
  add column if not exists maximum_quantity integer,
  add column if not exists published boolean not null default true;

update public.commercial_product_options
set option_code = coalesce(nullif(option_code, ''), 'legacy-' || left(id::text, 12)),
    option_kind = case
      when lower(group_key) like '%sabor%' then 'flavor'
      when lower(group_key) like '%formato%' then 'format'
      when lower(group_key) like '%tema%' then 'theme'
      when lower(group_key) like '%embalag%' then 'packaging'
      when lower(group_key) like '%vari%' then 'variant'
      else coalesce(nullif(option_kind, ''), 'addon')
    end;

alter table public.commercial_product_options
  alter column option_code set not null,
  drop constraint if exists commercial_product_options_option_code_check,
  add constraint commercial_product_options_option_code_check
    check (option_code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  drop constraint if exists commercial_product_options_option_kind_check,
  add constraint commercial_product_options_option_kind_check
    check (option_kind in ('flavor','variant','format','theme','packaging','addon')),
  drop constraint if exists commercial_product_options_unit_cost_check,
  add constraint commercial_product_options_unit_cost_check check (unit_cost >= 0),
  drop constraint if exists commercial_product_options_quantity_check,
  add constraint commercial_product_options_quantity_check check (
    minimum_quantity > 0 and (maximum_quantity is null or maximum_quantity >= minimum_quantity)
  );

create unique index if not exists commercial_product_options_product_code_uidx
  on public.commercial_product_options(product_id, option_code);

create table if not exists public.service_request_product_configurations (
  request_id uuid primary key references public.service_requests(id) on delete restrict,
  product_id uuid not null references public.commercial_products(id) on delete restrict,
  product_type text not null check (product_type in ('sweet','cookie','school_kit','fixed')),
  configuration_mode text not null check (configuration_mode in ('none','option_groups')),
  canonical_selection jsonb not null check (jsonb_typeof(canonical_selection) = 'object'),
  selection_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(selection_summary) = 'array'),
  estimated_price numeric(14,2) not null check (estimated_price >= 0),
  estimated_internal_cost numeric(14,4) not null check (estimated_internal_cost >= 0),
  created_at timestamptz not null default now()
);

alter table public.service_request_product_configurations enable row level security;
revoke all on public.service_request_product_configurations from public, anon, authenticated;
grant all on public.service_request_product_configurations to service_role;

create or replace function private.prevent_product_configuration_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'A configuração registrada da encomenda é imutável';
end;
$$;
revoke all on function private.prevent_product_configuration_snapshot_mutation() from public, anon, authenticated;

drop trigger if exists service_request_product_configuration_immutable
  on public.service_request_product_configurations;
create trigger service_request_product_configuration_immutable
before update or delete on public.service_request_product_configurations
for each row execute function private.prevent_product_configuration_snapshot_mutation();

create or replace function private.canonicalize_configurable_product_selection(
  target_product_id uuid,
  target_quantity integer,
  requested_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.commercial_products%rowtype;
  configuration jsonb;
  item jsonb;
  option_row public.commercial_product_options%rowtype;
  option_id uuid;
  option_quantity integer;
  canonical_items jsonb := '[]'::jsonb;
  summary_items jsonb := '[]'::jsonb;
  selected_ids uuid[] := '{}'::uuid[];
  flavor_count integer := 0;
  flavor_quantity integer := 0;
  total_price_adjustment numeric(14,2) := 0;
  total_internal_cost numeric(14,4) := 0;
  maximum_flavors integer;
  minimum_per_flavor integer;
  minimum_total integer;
  maximum_total integer;
  require_exact_total boolean;
  allow_addons boolean;
  base_price numeric(14,2);
begin
  select product.* into product_row
  from public.commercial_products product
  where product.id = target_product_id and product.active and product.published;

  if product_row.id is null then raise exception 'Produto indisponível'; end if;
  if product_row.customization_mode <> 'option_groups' then return null; end if;
  if product_row.product_type not in ('sweet','cookie','school_kit') then
    raise exception 'Tipo de produto incompatível com o montador de opções';
  end if;
  if coalesce(target_quantity, 0) < product_row.minimum_quantity then
    raise exception 'Quantidade mínima inválida';
  end if;

  configuration := coalesce(requested_selections, '{}'::jsonb)->'product_configuration';
  if configuration is null or jsonb_typeof(configuration) <> 'object' then
    raise exception 'Escolha as opções do produto antes de enviar a encomenda';
  end if;
  if jsonb_typeof(configuration->'items') <> 'array' then
    raise exception 'A configuração do produto precisa conter uma lista de escolhas';
  end if;
  if jsonb_array_length(configuration->'items') > 100 then
    raise exception 'A configuração excede o limite de opções';
  end if;

  maximum_flavors := greatest(1, least(coalesce(nullif(product_row.configuration_rules->>'maximumFlavors','')::integer, 100), 100));
  minimum_per_flavor := greatest(1, coalesce(nullif(product_row.configuration_rules->>'minimumQuantityPerFlavor','')::integer, 1));
  minimum_total := greatest(1, coalesce(nullif(product_row.configuration_rules->>'minimumTotalQuantity','')::integer, product_row.minimum_quantity));
  maximum_total := greatest(minimum_total, coalesce(nullif(product_row.configuration_rules->>'maximumTotalQuantity','')::integer, 10000));
  require_exact_total := coalesce((product_row.configuration_rules->>'requireExactTotal')::boolean, false);
  allow_addons := coalesce((product_row.configuration_rules->>'allowAddons')::boolean, true);

  for item in select value from jsonb_array_elements(configuration->'items') loop
    begin option_id := nullif(item->>'option_id','')::uuid;
    exception when invalid_text_representation then raise exception 'Opção inválida'; end;
    option_quantity := coalesce(nullif(item->>'quantity','')::integer, 0);
    if option_id is null or option_quantity <= 0 then raise exception 'Opção ou quantidade inválida'; end if;
    if option_id = any(selected_ids) then raise exception 'Opção repetida na configuração'; end if;

    select option.* into option_row
    from public.commercial_product_options option
    where option.id = option_id
      and option.product_id = product_row.id
      and option.active and option.published;
    if option_row.id is null then raise exception 'Uma opção selecionada está indisponível'; end if;
    if option_quantity < option_row.minimum_quantity then
      raise exception '% exige pelo menos % unidade(s)', option_row.label, option_row.minimum_quantity;
    end if;
    if option_row.maximum_quantity is not null and option_quantity > option_row.maximum_quantity then
      raise exception '% permite no máximo % unidade(s)', option_row.label, option_row.maximum_quantity;
    end if;
    if option_row.option_kind = 'addon' and not allow_addons then
      raise exception 'Este produto não aceita adicionais';
    end if;

    selected_ids := selected_ids || option_id;
    if option_row.option_kind = 'flavor' then
      flavor_count := flavor_count + 1;
      flavor_quantity := flavor_quantity + option_quantity;
      if option_quantity < minimum_per_flavor then
        raise exception 'Cada sabor precisa ter pelo menos % unidade(s)', minimum_per_flavor;
      end if;
    end if;
    total_price_adjustment := total_price_adjustment + option_row.price_adjustment * option_quantity;
    total_internal_cost := total_internal_cost + option_row.unit_cost * option_quantity;
    canonical_items := canonical_items || jsonb_build_array(jsonb_build_object(
      'option_id', option_row.id,
      'option_code', option_row.option_code,
      'option_kind', option_row.option_kind,
      'group_key', option_row.group_key,
      'label', option_row.label,
      'quantity', option_quantity,
      'unit_price_adjustment', option_row.price_adjustment,
      'unit_cost', option_row.unit_cost,
      'price_adjustment', option_row.price_adjustment * option_quantity,
      'internal_cost', option_row.unit_cost * option_quantity
    ));
    summary_items := summary_items || jsonb_build_array(option_quantity::text || '× ' || option_row.label);
  end loop;

  if flavor_count > maximum_flavors then raise exception 'Escolha no máximo % sabor(es)', maximum_flavors; end if;
  if flavor_quantity > maximum_total then raise exception 'A configuração excede % unidade(s)', maximum_total; end if;
  if product_row.product_type = 'sweet' and flavor_quantity < minimum_total then
    raise exception 'Distribua pelo menos % unidade(s) entre os sabores', minimum_total;
  end if;
  if require_exact_total and flavor_quantity <> target_quantity then
    raise exception 'Distribua exatamente % unidade(s) entre os sabores', target_quantity;
  end if;

  base_price := greatest(coalesce(product_row.base_price, 0), 0);
  return jsonb_build_object(
    'product_id', product_row.id,
    'product_type', product_row.product_type,
    'configuration_mode', product_row.customization_mode,
    'selection', jsonb_build_object(
      'schema_version', 1,
      'product_type', product_row.product_type,
      'items', canonical_items
    ),
    'summary', summary_items,
    'selected_flavor_count', flavor_count,
    'configured_quantity', flavor_quantity,
    'price_adjustment', round(total_price_adjustment, 2),
    'estimated_internal_cost', round(total_internal_cost, 4),
    'estimated_price', round(base_price + total_price_adjustment, 2)
  );
end;
$$;
revoke all on function private.canonicalize_configurable_product_selection(uuid,integer,jsonb)
  from public, anon, authenticated;

create or replace function public.get_configurable_product_catalog(target_segment text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', product.id,
    'slug', product.slug,
    'segment', product.segment,
    'name', product.name,
    'short_description', product.short_description,
    'base_price', product.base_price,
    'minimum_quantity', product.minimum_quantity,
    'lead_business_days', product.lead_business_days,
    'product_type', product.product_type,
    'customization_mode', product.customization_mode,
    'configuration_rules', product.configuration_rules,
    'image_url', product.image_url,
    'published', product.published,
    'active', product.active,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'product_id', option.product_id,
        'group_key', option.group_key,
        'option_code', option.option_code,
        'option_kind', option.option_kind,
        'label', option.label,
        'price_adjustment', option.price_adjustment,
        'unit_cost', 0,
        'minimum_quantity', option.minimum_quantity,
        'maximum_quantity', option.maximum_quantity,
        'active', option.active,
        'published', option.published,
        'sort_order', option.sort_order
      ) order by option.sort_order, option.label)
      from public.commercial_product_options option
      where option.product_id = product.id and option.active and option.published
    ), '[]'::jsonb)
  ) order by product.sort_order, product.name), '[]'::jsonb)
  from public.commercial_products product
  where product.segment = target_segment and product.active and product.published;
$$;
revoke all on function public.get_configurable_product_catalog(text) from public;
grant execute on function public.get_configurable_product_catalog(text) to anon, authenticated, service_role;

create or replace function public.manager_get_configurable_product_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem administrar produtos'; end if;
  return jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(product) order by product.sort_order, product.name) from public.commercial_products product), '[]'::jsonb),
    'options', coalesce((select jsonb_agg(to_jsonb(option) order by option.product_id, option.sort_order, option.label) from public.commercial_product_options option), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.manager_get_configurable_product_workspace() from public, anon, authenticated;
grant execute on function public.manager_get_configurable_product_workspace() to authenticated;

create or replace function public.manager_save_configurable_product(
  target_product jsonb,
  target_options jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  option_payload jsonb;
  option_id uuid;
  normalized_slug text;
  normalized_segment text;
  normalized_type text;
  normalized_mode text;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem administrar produtos'; end if;
  if jsonb_typeof(target_product) <> 'object' then raise exception 'Produto inválido'; end if;
  if jsonb_typeof(coalesce(target_options, '[]'::jsonb)) <> 'array' then raise exception 'Opções inválidas'; end if;

  normalized_slug := lower(btrim(target_product->>'slug'));
  normalized_segment := lower(btrim(target_product->>'segment'));
  normalized_type := lower(btrim(target_product->>'product_type'));
  normalized_mode := lower(btrim(target_product->>'customization_mode'));
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' then raise exception 'Slug inválido'; end if;
  if normalized_segment not in ('cakes','sweets','events','school','rentals','cookies') then raise exception 'Segmento inválido'; end if;
  if normalized_type not in ('cake','sweet','cookie','school_kit','fixed') then raise exception 'Tipo inválido'; end if;
  if normalized_mode not in ('none','cake_builder','option_groups') then raise exception 'Modo de personalização inválido'; end if;
  if normalized_type = 'cake' and normalized_mode <> 'cake_builder' then raise exception 'Tortas precisam usar o montador de tortas'; end if;

  begin target_id := nullif(target_product->>'id','')::uuid;
  exception when invalid_text_representation then raise exception 'Identificador do produto inválido'; end;

  if target_id is null then
    insert into public.commercial_products(
      slug, segment, subcategory, name, short_description, description, base_price,
      price_suffix, minimum_quantity, lead_business_days, requires_schedule,
      details, image_url, original_image_url, allergens, show_allergens,
      published, active, sort_order, product_type, customization_mode,
      configuration_rules, created_by, updated_by
    ) values (
      normalized_slug,
      normalized_segment,
      nullif(btrim(target_product->>'subcategory'),''),
      btrim(target_product->>'name'),
      coalesce(target_product->>'short_description',''),
      coalesce(target_product->>'description',''),
      nullif(target_product->>'base_price','')::numeric,
      coalesce(target_product->>'price_suffix',''),
      greatest(coalesce(nullif(target_product->>'minimum_quantity','')::integer,1),1),
      greatest(coalesce(nullif(target_product->>'lead_business_days','')::integer,0),0),
      coalesce((target_product->>'requires_schedule')::boolean,true),
      coalesce(target_product->'details','{}'::jsonb),
      nullif(target_product->>'image_url',''),
      nullif(target_product->>'original_image_url',''),
      coalesce(target_product->'allergens','[]'::jsonb),
      coalesce((target_product->>'show_allergens')::boolean,false),
      coalesce((target_product->>'published')::boolean,false),
      coalesce((target_product->>'active')::boolean,true),
      coalesce(nullif(target_product->>'sort_order','')::integer,0),
      normalized_type,
      normalized_mode,
      coalesce(target_product->'configuration_rules','{}'::jsonb),
      auth.uid(), auth.uid()
    ) returning id into target_id;
  else
    update public.commercial_products set
      slug = normalized_slug,
      segment = normalized_segment,
      subcategory = nullif(btrim(target_product->>'subcategory'),''),
      name = btrim(target_product->>'name'),
      short_description = coalesce(target_product->>'short_description',''),
      description = coalesce(target_product->>'description',''),
      base_price = nullif(target_product->>'base_price','')::numeric,
      price_suffix = coalesce(target_product->>'price_suffix',''),
      minimum_quantity = greatest(coalesce(nullif(target_product->>'minimum_quantity','')::integer,1),1),
      lead_business_days = greatest(coalesce(nullif(target_product->>'lead_business_days','')::integer,0),0),
      requires_schedule = coalesce((target_product->>'requires_schedule')::boolean,true),
      details = coalesce(target_product->'details','{}'::jsonb),
      image_url = nullif(target_product->>'image_url',''),
      original_image_url = nullif(target_product->>'original_image_url',''),
      allergens = coalesce(target_product->'allergens','[]'::jsonb),
      show_allergens = coalesce((target_product->>'show_allergens')::boolean,false),
      published = coalesce((target_product->>'published')::boolean,false),
      active = coalesce((target_product->>'active')::boolean,true),
      sort_order = coalesce(nullif(target_product->>'sort_order','')::integer,0),
      product_type = normalized_type,
      customization_mode = normalized_mode,
      configuration_rules = coalesce(target_product->'configuration_rules','{}'::jsonb),
      updated_by = auth.uid(), updated_at = now()
    where id = target_id;
    if not found then raise exception 'Produto não encontrado'; end if;
  end if;

  for option_payload in select value from jsonb_array_elements(coalesce(target_options,'[]'::jsonb)) loop
    begin option_id := nullif(option_payload->>'id','')::uuid;
    exception when invalid_text_representation then raise exception 'Identificador de opção inválido'; end;
    if option_id is null then
      insert into public.commercial_product_options(
        product_id, group_key, option_code, option_kind, label, price_adjustment,
        unit_cost, minimum_quantity, maximum_quantity, active, published,
        sort_order, created_by, updated_by
      ) values (
        target_id,
        lower(btrim(option_payload->>'group_key')),
        lower(btrim(option_payload->>'option_code')),
        lower(btrim(option_payload->>'option_kind')),
        btrim(option_payload->>'label'),
        greatest(coalesce(nullif(option_payload->>'price_adjustment','')::numeric,0),0),
        greatest(coalesce(nullif(option_payload->>'unit_cost','')::numeric,0),0),
        greatest(coalesce(nullif(option_payload->>'minimum_quantity','')::integer,1),1),
        nullif(option_payload->>'maximum_quantity','')::integer,
        coalesce((option_payload->>'active')::boolean,true),
        coalesce((option_payload->>'published')::boolean,true),
        coalesce(nullif(option_payload->>'sort_order','')::integer,0),
        auth.uid(), auth.uid()
      );
    else
      update public.commercial_product_options set
        group_key = lower(btrim(option_payload->>'group_key')),
        option_code = lower(btrim(option_payload->>'option_code')),
        option_kind = lower(btrim(option_payload->>'option_kind')),
        label = btrim(option_payload->>'label'),
        price_adjustment = greatest(coalesce(nullif(option_payload->>'price_adjustment','')::numeric,0),0),
        unit_cost = greatest(coalesce(nullif(option_payload->>'unit_cost','')::numeric,0),0),
        minimum_quantity = greatest(coalesce(nullif(option_payload->>'minimum_quantity','')::integer,1),1),
        maximum_quantity = nullif(option_payload->>'maximum_quantity','')::integer,
        active = coalesce((option_payload->>'active')::boolean,true),
        published = coalesce((option_payload->>'published')::boolean,true),
        sort_order = coalesce(nullif(option_payload->>'sort_order','')::integer,0),
        updated_by = auth.uid(), updated_at = now()
      where id = option_id and product_id = target_id;
      if not found then raise exception 'Opção não pertence ao produto'; end if;
    end if;
  end loop;

  return jsonb_build_object('product_id', target_id, 'saved', true);
end;
$$;
revoke all on function public.manager_save_configurable_product(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.manager_save_configurable_product(jsonb,jsonb) to authenticated;

create or replace function public.submit_service_request_bff(
  requested_operation_key uuid,
  requested_product_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_quantity integer,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_location text default '',
  requested_selections jsonb default '{}'::jsonb,
  requested_notes text default '',
  requested_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  existing_request public.service_requests%rowtype;
  target_request_id uuid;
  linked_profile_id uuid;
  cake_quote jsonb;
  product_quote jsonb;
  effective_quote jsonb;
  canonical_selections jsonb := coalesce(requested_selections, '{}'::jsonb);
  pricing_snapshot_captured boolean := false;
begin
  if requested_operation_key is null then raise exception 'Chave da solicitação é obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtextextended('public-service-request:' || requested_operation_key::text, 0));

  select request.* into existing_request
  from public.service_requests request
  where request.public_request_key = requested_operation_key limit 1;
  if existing_request.id is not null then
    return jsonb_build_object(
      'accepted', true,
      'request_id', existing_request.id,
      'request_number', existing_request.request_number,
      'expires_at', existing_request.expires_at,
      'conflict', null,
      'competing_prebooks', 0,
      'idempotent', true,
      'cake_builder_confirmed', exists(select 1 from public.service_request_cake_builds build where build.request_id = existing_request.id),
      'product_configuration_confirmed', exists(select 1 from public.service_request_product_configurations config where config.request_id = existing_request.id),
      'pricing_snapshot_captured', exists(select 1 from public.service_request_pricing_snapshots snapshot where snapshot.request_id = existing_request.id),
      'message', 'Esta pré-reserva já havia sido registrada.'
    );
  end if;

  cake_quote := private.canonicalize_cake_builder_selection(requested_product_id, canonical_selections);
  product_quote := private.canonicalize_configurable_product_selection(requested_product_id, requested_quantity, canonical_selections);
  if cake_quote is not null and product_quote is not null then raise exception 'Produto com montadores incompatíveis'; end if;

  if cake_quote is not null then
    canonical_selections := (canonical_selections - 'cake_builder') || jsonb_build_object(
      'cake_builder', cake_quote->'selection',
      'cake_builder_summary', cake_quote->'summary',
      'estimated_price', cake_quote->'estimated_price'
    );
  elsif product_quote is not null then
    canonical_selections := (canonical_selections - 'product_configuration') || jsonb_build_object(
      'product_configuration', product_quote->'selection',
      'product_configuration_summary', product_quote->'summary',
      'estimated_price', product_quote->'estimated_price'
    );
  end if;

  response := public.submit_service_request(
    requested_product_id, requested_customer_name, requested_customer_phone,
    requested_customer_email, requested_quantity, requested_start, requested_end,
    requested_location, canonical_selections, requested_notes
  );
  if not coalesce((response->>'accepted')::boolean, false) then
    return response || jsonb_build_object('idempotent', false, 'pricing_snapshot_captured', false);
  end if;

  target_request_id := (response->>'request_id')::uuid;
  if requested_profile_id is not null and exists(select 1 from public.profiles profile where profile.id = requested_profile_id) then
    linked_profile_id := requested_profile_id;
  end if;
  update public.service_requests
  set public_request_key = requested_operation_key,
      profile_id = coalesce(linked_profile_id, profile_id)
  where id = target_request_id;
  if not found then raise exception 'A pré-reserva foi criada sem vínculo interno'; end if;

  if cake_quote is not null then
    insert into public.service_request_cake_builds(
      request_id, product_id, template_id, canonical_selection,
      selection_summary, estimated_price, estimated_internal_cost
    ) values (
      target_request_id, requested_product_id, (cake_quote->>'template_id')::uuid,
      cake_quote->'selection', cake_quote->'summary',
      (cake_quote->>'estimated_price')::numeric,
      (cake_quote->>'estimated_internal_cost')::numeric
    );
    response := response || jsonb_build_object('estimated_price', cake_quote->'estimated_price', 'cake_builder_confirmed', true);
  elsif product_quote is not null then
    insert into public.service_request_product_configurations(
      request_id, product_id, product_type, configuration_mode,
      canonical_selection, selection_summary, estimated_price, estimated_internal_cost
    ) values (
      target_request_id, requested_product_id, product_quote->>'product_type',
      product_quote->>'configuration_mode', product_quote->'selection',
      product_quote->'summary', (product_quote->>'estimated_price')::numeric,
      (product_quote->>'estimated_internal_cost')::numeric
    );
    response := response || jsonb_build_object(
      'estimated_price', product_quote->'estimated_price',
      'product_configuration_confirmed', true
    );
  end if;

  effective_quote := coalesce(cake_quote, product_quote);
  pricing_snapshot_captured := private.capture_service_request_pricing_snapshot(
    target_request_id, requested_product_id, requested_quantity,
    canonical_selections, effective_quote
  );

  return response || jsonb_build_object(
    'idempotent', false,
    'profile_linked', linked_profile_id is not null,
    'pricing_snapshot_captured', pricing_snapshot_captured
  );
end;
$$;
revoke all on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) to service_role;

comment on column public.commercial_products.product_type is
  'Tipo funcional do produto: torta, docinho, biscoito, kit escolar ou produto fixo.';
comment on column public.commercial_products.customization_mode is
  'Define se o cliente compra diretamente, usa o montador de tortas ou grupos de opções.';
comment on table public.service_request_product_configurations is
  'Snapshot imutável das escolhas estruturadas de docinhos, biscoitos e kits.';

commit;
