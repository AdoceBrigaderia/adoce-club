begin;

create table if not exists public.cake_builder_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commercial_products(id) on delete cascade,
  name text not null default 'Montagem personalizada',
  cake_layers smallint not null default 3 check (cake_layers between 1 and 8),
  filling_layers smallint not null default 2 check (filling_layers between 0 and 7),
  allow_mixed_cake_layers boolean not null default true,
  allow_mixed_fillings boolean not null default true,
  active boolean not null default true,
  published boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create table if not exists public.cake_builder_options (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cake_builder_templates(id) on delete cascade,
  placement text not null check (
    placement in (
      'cake_layer',
      'filling_layer',
      'topping',
      'filling_fruit',
      'topping_fruit',
      'filling_extra',
      'topping_extra'
    )
  ),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  label text not null check (length(btrim(label)) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  price_adjustment numeric(12,2) not null default 0 check (price_adjustment between 0 and 100000),
  unit_cost numeric(12,2) not null default 0 check (unit_cost between 0 and 100000),
  active boolean not null default true,
  published boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, placement, slug)
);

create table if not exists public.service_request_cake_builds (
  request_id uuid primary key references public.service_requests(id) on delete cascade,
  product_id uuid not null references public.commercial_products(id),
  template_id uuid references public.cake_builder_templates(id) on delete set null,
  canonical_selection jsonb not null,
  selection_summary jsonb not null default '{}'::jsonb,
  estimated_price numeric(12,2) not null check (estimated_price >= 0),
  estimated_internal_cost numeric(12,2) not null check (estimated_internal_cost >= 0),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(canonical_selection) = 'object'),
  check (jsonb_typeof(selection_summary) = 'object')
);

create index if not exists cake_builder_options_template_placement_idx
  on public.cake_builder_options (template_id, placement, sort_order)
  where active;

create index if not exists service_request_cake_builds_product_created_idx
  on public.service_request_cake_builds (product_id, created_at desc);

alter table public.cake_builder_templates enable row level security;
alter table public.cake_builder_options enable row level security;
alter table public.service_request_cake_builds enable row level security;

revoke all on public.cake_builder_templates from public, anon, authenticated;
revoke all on public.cake_builder_options from public, anon, authenticated;
revoke all on public.service_request_cake_builds from public, anon, authenticated;

grant all on public.cake_builder_templates to service_role;
grant all on public.cake_builder_options to service_role;
grant all on public.service_request_cake_builds to service_role;

create or replace function private.cake_builder_jsonb_uuid_array(
  source jsonb,
  field_label text,
  maximum_items integer default 20
)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  result uuid[] := '{}'::uuid[];
begin
  if source is null or source = 'null'::jsonb then
    return result;
  end if;
  if jsonb_typeof(source) <> 'array' then
    raise exception '% precisa ser uma lista', field_label;
  end if;
  if jsonb_array_length(source) > greatest(0, least(maximum_items, 100)) then
    raise exception '% excede o limite permitido', field_label;
  end if;
  begin
    select coalesce(array_agg(item.value::uuid order by item.ordinality), '{}'::uuid[])
    into result
    from jsonb_array_elements_text(source) with ordinality as item(value, ordinality);
  exception when invalid_text_representation then
    raise exception '% contém uma opção inválida', field_label;
  end;
  return result;
end;
$$;

create or replace function private.cake_builder_distinct_uuid_array(source uuid[])
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item order by item), '{}'::uuid[])
  from (select distinct unnest(coalesce(source, '{}'::uuid[])) as item) distinct_items;
$$;

create or replace function private.canonicalize_cake_builder_selection(
  target_product_id uuid,
  requested_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_row public.cake_builder_templates%rowtype;
  requested_builder jsonb;
  cake_ids uuid[] := '{}'::uuid[];
  filling_ids uuid[] := '{}'::uuid[];
  topping_id uuid;
  filling_fruit_ids uuid[] := '{}'::uuid[];
  topping_fruit_ids uuid[] := '{}'::uuid[];
  filling_extra_ids uuid[] := '{}'::uuid[];
  topping_extra_ids uuid[] := '{}'::uuid[];
  all_ids uuid[] := '{}'::uuid[];
  base_price numeric(12,2) := 0;
  adjustments numeric(12,2) := 0;
  internal_cost numeric(12,2) := 0;
  cake_labels jsonb := '[]'::jsonb;
  filling_labels jsonb := '[]'::jsonb;
  topping_label text := '';
  filling_fruit_labels jsonb := '[]'::jsonb;
  topping_fruit_labels jsonb := '[]'::jsonb;
  filling_extra_labels jsonb := '[]'::jsonb;
  topping_extra_labels jsonb := '[]'::jsonb;
  selected_distinct_count integer;
  allowed_count integer;
begin
  select template.*
  into template_row
  from public.cake_builder_templates template
  join public.commercial_products product on product.id = template.product_id
  where template.product_id = target_product_id
    and template.active
    and template.published
    and product.active
    and product.published
    and product.segment::text = 'cakes'
  for share of template;

  if template_row.id is null then
    return null;
  end if;

  requested_builder := coalesce(requested_selections, '{}'::jsonb)->'cake_builder';
  if requested_builder is null or jsonb_typeof(requested_builder) <> 'object' then
    raise exception 'Monte as camadas, recheios e cobertura antes de enviar a encomenda';
  end if;

  cake_ids := private.cake_builder_jsonb_uuid_array(
    requested_builder->'cake_layers',
    'Camadas de bolo',
    template_row.cake_layers
  );
  filling_ids := private.cake_builder_jsonb_uuid_array(
    requested_builder->'filling_layers',
    'Camadas de recheio',
    template_row.filling_layers
  );
  begin
    topping_id := nullif(requested_builder->>'topping', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'A cobertura escolhida é inválida';
  end;
  filling_fruit_ids := private.cake_builder_distinct_uuid_array(
    private.cake_builder_jsonb_uuid_array(requested_builder->'filling_fruits', 'Frutas no recheio', 20)
  );
  topping_fruit_ids := private.cake_builder_distinct_uuid_array(
    private.cake_builder_jsonb_uuid_array(requested_builder->'topping_fruits', 'Frutas na cobertura', 20)
  );
  filling_extra_ids := private.cake_builder_distinct_uuid_array(
    private.cake_builder_jsonb_uuid_array(requested_builder->'filling_extras', 'Adicionais no recheio', 20)
  );
  topping_extra_ids := private.cake_builder_distinct_uuid_array(
    private.cake_builder_jsonb_uuid_array(requested_builder->'topping_extras', 'Adicionais na cobertura', 20)
  );

  if cardinality(cake_ids) <> template_row.cake_layers then
    raise exception 'Escolha exatamente % camadas de bolo', template_row.cake_layers;
  end if;
  if cardinality(filling_ids) <> template_row.filling_layers then
    raise exception 'Escolha exatamente % camadas de recheio', template_row.filling_layers;
  end if;
  if topping_id is null then
    raise exception 'Escolha a cobertura da torta';
  end if;
  if not template_row.allow_mixed_cake_layers and (
    select count(distinct item) from unnest(cake_ids) item
  ) > 1 then
    raise exception 'Esta torta usa o mesmo sabor em todas as camadas de bolo';
  end if;
  if not template_row.allow_mixed_fillings and (
    select count(distinct item) from unnest(filling_ids) item
  ) > 1 then
    raise exception 'Esta torta usa o mesmo sabor em todas as camadas de recheio';
  end if;

  selected_distinct_count := (select count(distinct item) from unnest(cake_ids) item);
  select count(*) into allowed_count
  from public.cake_builder_options option
  where option.template_id = template_row.id
    and option.placement = 'cake_layer'
    and option.active and option.published
    and option.id = any(cake_ids);
  if allowed_count <> selected_distinct_count then
    raise exception 'Há uma massa indisponível nesta montagem';
  end if;

  selected_distinct_count := (select count(distinct item) from unnest(filling_ids) item);
  select count(*) into allowed_count
  from public.cake_builder_options option
  where option.template_id = template_row.id
    and option.placement = 'filling_layer'
    and option.active and option.published
    and option.id = any(filling_ids);
  if allowed_count <> selected_distinct_count then
    raise exception 'Há um recheio indisponível nesta montagem';
  end if;

  if not exists (
    select 1 from public.cake_builder_options option
    where option.id = topping_id
      and option.template_id = template_row.id
      and option.placement = 'topping'
      and option.active and option.published
  ) then
    raise exception 'A cobertura escolhida está indisponível';
  end if;

  if exists (
    select 1
    from unnest(filling_fruit_ids) selected(id)
    where not exists (
      select 1 from public.cake_builder_options option
      where option.id = selected.id and option.template_id = template_row.id
        and option.placement = 'filling_fruit' and option.active and option.published
    )
  ) then raise exception 'Há uma fruta de recheio indisponível'; end if;

  if exists (
    select 1
    from unnest(topping_fruit_ids) selected(id)
    where not exists (
      select 1 from public.cake_builder_options option
      where option.id = selected.id and option.template_id = template_row.id
        and option.placement = 'topping_fruit' and option.active and option.published
    )
  ) then raise exception 'Há uma fruta de cobertura indisponível'; end if;

  if exists (
    select 1
    from unnest(filling_extra_ids) selected(id)
    where not exists (
      select 1 from public.cake_builder_options option
      where option.id = selected.id and option.template_id = template_row.id
        and option.placement = 'filling_extra' and option.active and option.published
    )
  ) then raise exception 'Há um adicional de recheio indisponível'; end if;

  if exists (
    select 1
    from unnest(topping_extra_ids) selected(id)
    where not exists (
      select 1 from public.cake_builder_options option
      where option.id = selected.id and option.template_id = template_row.id
        and option.placement = 'topping_extra' and option.active and option.published
    )
  ) then raise exception 'Há um adicional de cobertura indisponível'; end if;

  all_ids := cake_ids || filling_ids || array[topping_id] || filling_fruit_ids ||
    topping_fruit_ids || filling_extra_ids || topping_extra_ids;

  select coalesce(product.base_price, 0)::numeric(12,2)
  into base_price
  from public.commercial_products product
  where product.id = target_product_id;

  select
    coalesce(sum(option.price_adjustment), 0)::numeric(12,2),
    coalesce(sum(option.unit_cost), 0)::numeric(12,2)
  into adjustments, internal_cost
  from unnest(all_ids) selected(id)
  join public.cake_builder_options option on option.id = selected.id;

  select coalesce(jsonb_agg(option.label order by selected.ordinality), '[]'::jsonb)
  into cake_labels
  from unnest(cake_ids) with ordinality selected(id, ordinality)
  join public.cake_builder_options option on option.id = selected.id;

  select coalesce(jsonb_agg(option.label order by selected.ordinality), '[]'::jsonb)
  into filling_labels
  from unnest(filling_ids) with ordinality selected(id, ordinality)
  join public.cake_builder_options option on option.id = selected.id;

  select option.label into topping_label
  from public.cake_builder_options option where option.id = topping_id;

  select coalesce(jsonb_agg(option.label order by option.label), '[]'::jsonb)
  into filling_fruit_labels
  from public.cake_builder_options option where option.id = any(filling_fruit_ids);
  select coalesce(jsonb_agg(option.label order by option.label), '[]'::jsonb)
  into topping_fruit_labels
  from public.cake_builder_options option where option.id = any(topping_fruit_ids);
  select coalesce(jsonb_agg(option.label order by option.label), '[]'::jsonb)
  into filling_extra_labels
  from public.cake_builder_options option where option.id = any(filling_extra_ids);
  select coalesce(jsonb_agg(option.label order by option.label), '[]'::jsonb)
  into topping_extra_labels
  from public.cake_builder_options option where option.id = any(topping_extra_ids);

  return jsonb_build_object(
    'template_id', template_row.id,
    'selection', jsonb_build_object(
      'cake_layers', to_jsonb(cake_ids),
      'filling_layers', to_jsonb(filling_ids),
      'topping', topping_id,
      'filling_fruits', to_jsonb(filling_fruit_ids),
      'topping_fruits', to_jsonb(topping_fruit_ids),
      'filling_extras', to_jsonb(filling_extra_ids),
      'topping_extras', to_jsonb(topping_extra_ids)
    ),
    'summary', jsonb_build_object(
      'cake_layers', cake_labels,
      'filling_layers', filling_labels,
      'topping', topping_label,
      'filling_fruits', filling_fruit_labels,
      'topping_fruits', topping_fruit_labels,
      'filling_extras', filling_extra_labels,
      'topping_extras', topping_extra_labels
    ),
    'estimated_price', round(base_price + adjustments, 2),
    'estimated_internal_cost', round(internal_cost, 2)
  );
end;
$$;

create or replace function public.public_get_cake_builder_catalog(target_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', template.id,
    'product_id', template.product_id,
    'name', template.name,
    'cake_layers', template.cake_layers,
    'filling_layers', template.filling_layers,
    'allow_mixed_cake_layers', template.allow_mixed_cake_layers,
    'allow_mixed_fillings', template.allow_mixed_fillings,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'placement', option.placement,
        'slug', option.slug,
        'label', option.label,
        'description', option.description,
        'price_adjustment', option.price_adjustment,
        'sort_order', option.sort_order
      ) order by option.sort_order, option.label)
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.active
        and option.published
    ), '[]'::jsonb)
  )
  from public.cake_builder_templates template
  join public.commercial_products product on product.id = template.product_id
  where template.product_id = target_product_id
    and template.active and template.published
    and product.active and product.published
    and product.segment::text = 'cakes'
  limit 1;
$$;

create or replace function public.staff_get_cake_builder_configuration(
  target_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_product_id uuid;
  configuration jsonb;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem configurar montagens';
  end if;

  if target_product_id is null then
    select product.id into selected_product_id
    from public.commercial_products product
    where product.segment::text = 'cakes' and product.active
    order by product.sort_order, product.name
    limit 1;
  else
    select product.id into selected_product_id
    from public.commercial_products product
    where product.id = target_product_id and product.segment::text = 'cakes';
  end if;

  if target_product_id is not null and selected_product_id is null then
    raise exception 'Torta não encontrada';
  end if;

  select case when template.id is null then null else jsonb_build_object(
    'id', template.id,
    'product_id', template.product_id,
    'name', template.name,
    'cake_layers', template.cake_layers,
    'filling_layers', template.filling_layers,
    'allow_mixed_cake_layers', template.allow_mixed_cake_layers,
    'allow_mixed_fillings', template.allow_mixed_fillings,
    'active', template.active,
    'published', template.published,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'placement', option.placement,
        'slug', option.slug,
        'label', option.label,
        'description', option.description,
        'price_adjustment', option.price_adjustment,
        'unit_cost', option.unit_cost,
        'active', option.active,
        'published', option.published,
        'sort_order', option.sort_order
      ) order by option.sort_order, option.label)
      from public.cake_builder_options option
      where option.template_id = template.id
    ), '[]'::jsonb)
  ) end
  into configuration
  from (select 1) seed
  left join public.cake_builder_templates template
    on template.product_id = selected_product_id;

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'name', product.name,
        'base_price', product.base_price,
        'active', product.active,
        'published', product.published
      ) order by product.sort_order, product.name)
      from public.commercial_products product
      where product.segment::text = 'cakes'
    ), '[]'::jsonb),
    'selected_product_id', selected_product_id,
    'configuration', configuration
  );
end;
$$;

create or replace function public.manager_save_cake_builder_configuration(
  target_product_id uuid,
  next_name text,
  next_cake_layers integer,
  next_filling_layers integer,
  next_allow_mixed_cake_layers boolean,
  next_allow_mixed_fillings boolean,
  next_active boolean,
  next_published boolean,
  next_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_id uuid;
  option_item jsonb;
  option_index integer := 0;
  option_id uuid;
  option_placement text;
  option_slug text;
  option_label text;
  option_description text;
  option_price numeric(12,2);
  option_cost numeric(12,2);
  option_active boolean;
  option_published boolean;
  option_sort integer;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem configurar montagens';
  end if;
  if not exists (
    select 1 from public.commercial_products product
    where product.id = target_product_id and product.segment::text = 'cakes'
  ) then raise exception 'Torta não encontrada'; end if;
  if next_cake_layers not between 1 and 8 then raise exception 'Quantidade de camadas de bolo inválida'; end if;
  if next_filling_layers not between 0 and 7 then raise exception 'Quantidade de camadas de recheio inválida'; end if;
  if jsonb_typeof(next_options) <> 'array' or jsonb_array_length(next_options) > 200 then
    raise exception 'Lista de opções inválida';
  end if;

  insert into public.cake_builder_templates(
    product_id, name, cake_layers, filling_layers,
    allow_mixed_cake_layers, allow_mixed_fillings,
    active, published, created_by, updated_by
  ) values (
    target_product_id, left(coalesce(nullif(btrim(next_name), ''), 'Montagem personalizada'), 120),
    next_cake_layers, next_filling_layers,
    coalesce(next_allow_mixed_cake_layers, true), coalesce(next_allow_mixed_fillings, true),
    coalesce(next_active, true), coalesce(next_published, false),
    (select auth.uid()), (select auth.uid())
  )
  on conflict (product_id) do update set
    name = excluded.name,
    cake_layers = excluded.cake_layers,
    filling_layers = excluded.filling_layers,
    allow_mixed_cake_layers = excluded.allow_mixed_cake_layers,
    allow_mixed_fillings = excluded.allow_mixed_fillings,
    active = excluded.active,
    published = excluded.published,
    updated_by = (select auth.uid()),
    updated_at = now()
  returning id into template_id;

  delete from public.cake_builder_options option where option.template_id = template_id;

  for option_item in select value from jsonb_array_elements(next_options)
  loop
    option_index := option_index + 1;
    option_placement := option_item->>'placement';
    if option_placement not in (
      'cake_layer', 'filling_layer', 'topping', 'filling_fruit',
      'topping_fruit', 'filling_extra', 'topping_extra'
    ) then raise exception 'Tipo de opção inválido na posição %', option_index; end if;

    option_label := left(btrim(coalesce(option_item->>'label', '')), 120);
    if option_label = '' then raise exception 'Informe o nome da opção %', option_index; end if;
    option_slug := lower(regexp_replace(coalesce(option_item->>'slug', ''), '[^a-zA-Z0-9-]+', '-', 'g'));
    option_slug := trim(both '-' from option_slug);
    if option_slug = '' then option_slug := 'opcao-' || option_index::text; end if;
    if option_slug !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Identificador inválido na opção %', option_index; end if;

    option_description := left(btrim(coalesce(option_item->>'description', '')), 500);
    option_price := greatest(0, least(100000, coalesce((option_item->>'price_adjustment')::numeric, 0)));
    option_cost := greatest(0, least(100000, coalesce((option_item->>'unit_cost')::numeric, 0)));
    option_active := coalesce((option_item->>'active')::boolean, true);
    option_published := coalesce((option_item->>'published')::boolean, true);
    option_sort := greatest(0, least(100000, coalesce((option_item->>'sort_order')::integer, option_index * 10)));

    begin
      option_id := nullif(option_item->>'id', '')::uuid;
    exception when invalid_text_representation then
      option_id := gen_random_uuid();
    end;
    option_id := coalesce(option_id, gen_random_uuid());

    insert into public.cake_builder_options(
      id, template_id, placement, slug, label, description,
      price_adjustment, unit_cost, active, published, sort_order
    ) values (
      option_id, template_id, option_placement, option_slug, option_label,
      option_description, option_price, option_cost,
      option_active, option_published, option_sort
    );
  end loop;

  if not exists (
    select 1 from public.cake_builder_options option
    where option.template_id = template_id and option.placement = 'cake_layer' and option.active
  ) then raise exception 'Cadastre pelo menos um sabor de massa'; end if;
  if next_filling_layers > 0 and not exists (
    select 1 from public.cake_builder_options option
    where option.template_id = template_id and option.placement = 'filling_layer' and option.active
  ) then raise exception 'Cadastre pelo menos um sabor de recheio'; end if;
  if not exists (
    select 1 from public.cake_builder_options option
    where option.template_id = template_id and option.placement = 'topping' and option.active
  ) then raise exception 'Cadastre pelo menos uma cobertura'; end if;

  return public.staff_get_cake_builder_configuration(target_product_id);
end;
$$;

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
  canonical_selections jsonb := coalesce(requested_selections, '{}'::jsonb);
begin
  if requested_operation_key is null then
    raise exception 'Chave da solicitação é obrigatória';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-service-request:' || requested_operation_key::text, 0)
  );

  select request.* into existing_request
  from public.service_requests request
  where request.public_request_key = requested_operation_key
  limit 1;

  if existing_request.id is not null then
    return jsonb_build_object(
      'accepted', true,
      'request_id', existing_request.id,
      'request_number', existing_request.request_number,
      'expires_at', existing_request.expires_at,
      'conflict', null,
      'competing_prebooks', 0,
      'idempotent', true,
      'message', 'Esta pré-reserva já havia sido registrada.'
    );
  end if;

  cake_quote := private.canonicalize_cake_builder_selection(
    requested_product_id,
    canonical_selections
  );
  if cake_quote is not null then
    canonical_selections := (canonical_selections - 'cake_builder') || jsonb_build_object(
      'cake_builder', cake_quote->'selection',
      'cake_builder_summary', cake_quote->'summary',
      'estimated_price', cake_quote->'estimated_price'
    );
  end if;

  response := public.submit_service_request(
    requested_product_id,
    requested_customer_name,
    requested_customer_phone,
    requested_customer_email,
    requested_quantity,
    requested_start,
    requested_end,
    requested_location,
    canonical_selections,
    requested_notes
  );

  if not coalesce((response->>'accepted')::boolean, false) then
    return response || jsonb_build_object('idempotent', false);
  end if;

  target_request_id := (response->>'request_id')::uuid;
  if requested_profile_id is not null and exists (
    select 1 from public.profiles profile where profile.id = requested_profile_id
  ) then linked_profile_id := requested_profile_id; end if;

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
      target_request_id,
      requested_product_id,
      (cake_quote->>'template_id')::uuid,
      cake_quote->'selection',
      cake_quote->'summary',
      (cake_quote->>'estimated_price')::numeric,
      (cake_quote->>'estimated_internal_cost')::numeric
    );
    response := response || jsonb_build_object(
      'estimated_price', cake_quote->'estimated_price',
      'cake_builder_confirmed', true
    );
  end if;

  return response || jsonb_build_object(
    'idempotent', false,
    'profile_linked', linked_profile_id is not null
  );
end;
$$;

revoke all on function public.public_get_cake_builder_catalog(uuid) from public;
grant execute on function public.public_get_cake_builder_catalog(uuid) to anon, authenticated, service_role;

revoke all on function public.staff_get_cake_builder_configuration(uuid) from public, anon;
grant execute on function public.staff_get_cake_builder_configuration(uuid) to authenticated, service_role;

revoke all on function public.manager_save_cake_builder_configuration(
  uuid,text,integer,integer,boolean,boolean,boolean,boolean,jsonb
) from public, anon;
grant execute on function public.manager_save_cake_builder_configuration(
  uuid,text,integer,integer,boolean,boolean,boolean,boolean,jsonb
) to authenticated, service_role;

revoke all on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) to service_role;

commit;
