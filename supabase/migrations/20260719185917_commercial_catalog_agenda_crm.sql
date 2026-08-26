-- Catálogo comercial, solicitações, agenda e CRM da Adoce Brigaderia.
-- A camada pública lê somente produtos publicados e cria pré-reservas por RPC.

create sequence if not exists private.service_request_number_seq;

create table if not exists public.commercial_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  segment text not null check (segment in ('cakes', 'sweets', 'events', 'school', 'rentals')),
  name text not null check (char_length(name) between 2 and 100),
  short_description text not null default '' check (char_length(short_description) <= 180),
  description text not null default '' check (char_length(description) <= 2000),
  base_price numeric(10,2) check (base_price is null or base_price >= 0),
  price_suffix text not null default '',
  minimum_quantity integer not null default 1 check (minimum_quantity > 0),
  lead_business_days integer not null default 0 check (lead_business_days between 0 and 90),
  requires_schedule boolean not null default true,
  resource_key text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  image_url text,
  allergens jsonb not null default '[]'::jsonb check (jsonb_typeof(allergens) = 'array'),
  show_allergens boolean not null default false,
  published boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  profile_id uuid references public.profiles(id) on delete set null,
  product_id uuid not null references public.commercial_products(id),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 12 and 16),
  customer_email text,
  quantity integer not null default 1 check (quantity > 0),
  desired_start timestamptz not null,
  desired_end timestamptz not null,
  service_location text not null default '',
  selections jsonb not null default '{}'::jsonb check (jsonb_typeof(selections) = 'object'),
  customer_notes text not null default '' check (char_length(customer_notes) <= 2000),
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  status text not null default 'prebooked' check (status in (
    'prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production',
    'ready', 'completed', 'cancelled', 'expired'
  )),
  source text not null default 'website' check (source in ('website', 'operation', 'whatsapp', 'instagram', 'phone', 'walk_in')),
  quoted_total numeric(10,2) check (quoted_total is null or quoted_total >= 0),
  deposit_amount numeric(10,2) check (deposit_amount is null or deposit_amount >= 0),
  deposit_paid_at timestamptz,
  expires_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (desired_end > desired_start)
);

create table if not exists public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  block_kind text not null default 'internal' check (block_kind in ('internal', 'event', 'production', 'pickup', 'closed')),
  status text not null default 'confirmed' check (status in ('tentative', 'confirmed', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  resource_key text,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete cascade,
  note text not null check (char_length(note) between 2 and 4000),
  visibility text not null default 'team' check (visibility in ('team', 'managers')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (profile_id is not null or service_request_id is not null)
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or service_request_id is not null)
);

create index if not exists commercial_products_public_idx
  on public.commercial_products(segment, sort_order) where active and published;
create index if not exists service_requests_schedule_idx
  on public.service_requests(desired_start, desired_end, status);
create index if not exists service_requests_profile_idx
  on public.service_requests(profile_id, created_at desc) where profile_id is not null;
create index if not exists service_requests_phone_idx
  on public.service_requests(customer_phone, created_at desc);
create index if not exists calendar_blocks_schedule_idx
  on public.calendar_blocks(starts_at, ends_at, status);
create index if not exists crm_tasks_due_idx
  on public.crm_tasks(status, due_at) where status = 'open';
create index if not exists crm_notes_profile_idx
  on public.crm_notes(profile_id, created_at desc) where profile_id is not null;

create or replace function private.touch_commercial_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_products_touch on public.commercial_products;
create trigger commercial_products_touch before update on public.commercial_products
for each row execute function private.touch_commercial_updated_at();
drop trigger if exists service_requests_touch on public.service_requests;
create trigger service_requests_touch before update on public.service_requests
for each row execute function private.touch_commercial_updated_at();
drop trigger if exists calendar_blocks_touch on public.calendar_blocks;
create trigger calendar_blocks_touch before update on public.calendar_blocks
for each row execute function private.touch_commercial_updated_at();
drop trigger if exists crm_tasks_touch on public.crm_tasks;
create trigger crm_tasks_touch before update on public.crm_tasks
for each row execute function private.touch_commercial_updated_at();

create or replace function private.assign_service_request_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number := 'ADO-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('private.service_request_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists service_request_number on public.service_requests;
create trigger service_request_number before insert on public.service_requests
for each row execute function private.assign_service_request_number();

create or replace function private.business_date_after(start_date date, business_days integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  result_date date := start_date;
  remaining integer := greatest(business_days, 0);
begin
  while remaining > 0 loop
    result_date := result_date + 1;
    if extract(isodow from result_date) between 1 and 5 then
      remaining := remaining - 1;
    end if;
  end loop;
  return result_date;
end;
$$;

create or replace function public.submit_service_request(
  requested_product_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_quantity integer,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_location text default '',
  requested_selections jsonb default '{}'::jsonb,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.commercial_products%rowtype;
  normalized_phone text;
  request_row public.service_requests%rowtype;
  confirmed_conflicts integer;
  competing_prebooks integer;
  overlap_resource text;
  lock_key bigint;
begin
  select * into product_row
  from public.commercial_products
  where id = requested_product_id and active and published;

  if not found then
    raise exception 'Produto indisponível para solicitação';
  end if;
  if requested_start is null or requested_end is null or requested_end <= requested_start then
    raise exception 'Data ou horário inválido';
  end if;
  if requested_start::date < private.business_date_after(current_date, product_row.lead_business_days) then
    raise exception 'A antecedência mínima deste produto é de % dia(s) útil(eis)', product_row.lead_business_days;
  end if;
  if char_length(btrim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe o nome do cliente';
  end if;
  normalized_phone := regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g');
  if length(normalized_phone) in (10, 11) then normalized_phone := '55' || normalized_phone; end if;
  if length(normalized_phone) not in (12, 13) then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;
  if coalesce(requested_quantity, 0) < product_row.minimum_quantity then
    raise exception 'A quantidade mínima deste produto é %', product_row.minimum_quantity;
  end if;

  overlap_resource := coalesce(product_row.resource_key,
    case when product_row.segment in ('events', 'school') then 'external-event' else null end);
  lock_key := hashtextextended(
    requested_start::date::text || ':' || coalesce(overlap_resource, product_row.segment), 0
  );
  perform pg_advisory_xact_lock(lock_key);

  select count(*) into confirmed_conflicts
  from public.service_requests existing
  join public.commercial_products existing_product on existing_product.id = existing.product_id
  where existing.status in ('confirmed', 'in_production', 'ready')
    and tstzrange(existing.desired_start, existing.desired_end, '[)') && tstzrange(requested_start, requested_end, '[)')
    and (
      overlap_resource is not null and coalesce(existing_product.resource_key,
        case when existing_product.segment in ('events', 'school') then 'external-event' else null end) = overlap_resource
    );

  select count(*) into competing_prebooks
  from public.service_requests existing
  join public.commercial_products existing_product on existing_product.id = existing.product_id
  where existing.status in ('prebooked', 'quoted', 'awaiting_deposit')
    and existing.expires_at > now()
    and tstzrange(existing.desired_start, existing.desired_end, '[)') && tstzrange(requested_start, requested_end, '[)')
    and coalesce(existing_product.resource_key, existing_product.segment) = coalesce(product_row.resource_key, product_row.segment);

  if confirmed_conflicts > 0 then
    return jsonb_build_object(
      'accepted', false,
      'conflict', 'confirmed',
      'message', 'Já existe um compromisso confirmado para essa data e horário. Fale conosco para verificarmos outra possibilidade.'
    );
  end if;
  if competing_prebooks >= 3 then
    return jsonb_build_object(
      'accepted', false,
      'conflict', 'prebook_limit',
      'message', 'Essa data já possui três solicitações em análise. Fale conosco para verificarmos a disponibilidade.'
    );
  end if;

  insert into public.service_requests (
    request_number, profile_id, product_id, customer_name, customer_phone,
    customer_email, quantity, desired_start, desired_end, service_location,
    selections, customer_notes, status, source, expires_at, created_by
  ) values (
    '', (select auth.uid()), product_row.id, btrim(requested_customer_name), '+' || normalized_phone,
    nullif(lower(btrim(coalesce(requested_customer_email, ''))), ''), requested_quantity,
    requested_start, requested_end, left(btrim(coalesce(requested_location, '')), 300),
    coalesce(requested_selections, '{}'::jsonb), left(btrim(coalesce(requested_notes, '')), 2000),
    'prebooked', 'website', now() + interval '48 hours', (select auth.uid())
  ) returning * into request_row;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values (
    'service_request.created', 'service_request', request_row.id,
    jsonb_build_object(
      'request_number', request_row.request_number,
      'product_name', product_row.name,
      'desired_start', request_row.desired_start,
      'competing_prebooks', competing_prebooks
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'request_id', request_row.id,
    'request_number', request_row.request_number,
    'expires_at', request_row.expires_at,
    'conflict', case when competing_prebooks > 0 then 'prebook_competition' else null end,
    'competing_prebooks', competing_prebooks,
    'message', case
      when competing_prebooks > 0 then 'Pré-reserva registrada. Há outra solicitação para esse período e a preferência será de quem confirmar primeiro com o sinal.'
      else 'Pré-reserva registrada por 48 horas. A equipe entrará em contato para confirmar os detalhes e o sinal.'
    end
  );
end;
$$;

revoke all on function public.submit_service_request(uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text) from public;
grant execute on function public.submit_service_request(uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text) to anon, authenticated;

create or replace function public.manager_update_service_request(
  target_request_id uuid,
  next_status text,
  next_total numeric default null,
  next_deposit numeric default null,
  next_internal_notes text default null
)
returns public.service_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_request public.service_requests%rowtype;
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Acesso não autorizado';
  end if;
  if next_status not in ('prebooked','quoted','awaiting_deposit','confirmed','in_production','ready','completed','cancelled','expired') then
    raise exception 'Status inválido';
  end if;
  update public.service_requests
  set status = next_status,
      quoted_total = coalesce(next_total, quoted_total),
      deposit_amount = coalesce(next_deposit, deposit_amount),
      deposit_paid_at = case when next_status = 'confirmed' then coalesce(deposit_paid_at, now()) else deposit_paid_at end,
      expires_at = case when next_status in ('confirmed','cancelled','completed','expired') then null else expires_at end,
      internal_notes = coalesce(next_internal_notes, internal_notes),
      updated_by = (select auth.uid())
  where id = target_request_id
  returning * into updated_request;
  if not found then raise exception 'Solicitação não encontrada'; end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'service_request_status_changed', 'service_request', updated_request.id,
    jsonb_build_object('status', next_status, 'request_number', updated_request.request_number));
  return updated_request;
end;
$$;

revoke all on function public.manager_update_service_request(uuid,text,numeric,numeric,text) from public;
grant execute on function public.manager_update_service_request(uuid,text,numeric,numeric,text) to authenticated;

alter table public.commercial_products enable row level security;
alter table public.service_requests enable row level security;
alter table public.calendar_blocks enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_tasks enable row level security;

drop policy if exists commercial_products_public_read on public.commercial_products;
create policy commercial_products_public_read on public.commercial_products for select to anon, authenticated
  using (active and published);
drop policy if exists commercial_products_manager_all on public.commercial_products;
create policy commercial_products_manager_all on public.commercial_products for all to authenticated
  using (private.is_manager()) with check (private.is_manager());

drop policy if exists service_requests_read on public.service_requests;
create policy service_requests_read on public.service_requests for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff());
drop policy if exists service_requests_staff_insert on public.service_requests;
create policy service_requests_staff_insert on public.service_requests for insert to authenticated
  with check (private.is_staff());
drop policy if exists service_requests_manager_update on public.service_requests;
create policy service_requests_manager_update on public.service_requests for update to authenticated
  using (private.is_manager()) with check (private.is_manager());

drop policy if exists calendar_blocks_staff_read on public.calendar_blocks;
create policy calendar_blocks_staff_read on public.calendar_blocks for select to authenticated
  using (private.is_staff());
drop policy if exists calendar_blocks_manager_all on public.calendar_blocks;
create policy calendar_blocks_manager_all on public.calendar_blocks for all to authenticated
  using (private.is_manager()) with check (private.is_manager());

drop policy if exists crm_notes_staff_read on public.crm_notes;
create policy crm_notes_staff_read on public.crm_notes for select to authenticated
  using (private.is_staff() and (visibility = 'team' or private.is_manager()));
drop policy if exists crm_notes_staff_insert on public.crm_notes;
create policy crm_notes_staff_insert on public.crm_notes for insert to authenticated
  with check (private.is_staff() and created_by = (select auth.uid()));
drop policy if exists crm_notes_manager_delete on public.crm_notes;
create policy crm_notes_manager_delete on public.crm_notes for delete to authenticated
  using (private.is_manager());

drop policy if exists crm_tasks_staff_read on public.crm_tasks;
create policy crm_tasks_staff_read on public.crm_tasks for select to authenticated
  using (private.is_staff());
drop policy if exists crm_tasks_staff_insert on public.crm_tasks;
create policy crm_tasks_staff_insert on public.crm_tasks for insert to authenticated
  with check (private.is_staff() and created_by = (select auth.uid()));
drop policy if exists crm_tasks_staff_update on public.crm_tasks;
create policy crm_tasks_staff_update on public.crm_tasks for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
drop policy if exists crm_tasks_manager_delete on public.crm_tasks;
create policy crm_tasks_manager_delete on public.crm_tasks for delete to authenticated
  using (private.is_manager());

grant select on public.commercial_products to anon, authenticated;
grant insert, update, delete on public.commercial_products to authenticated;
grant select, insert, update on public.service_requests to authenticated;
grant select, insert, update, delete on public.calendar_blocks to authenticated;
grant select, insert, delete on public.crm_notes to authenticated;
grant select, insert, update, delete on public.crm_tasks to authenticated;

insert into public.commercial_products (
  slug, segment, name, short_description, description, base_price, price_suffix,
  minimum_quantity, lead_business_days, resource_key, details, published, active, sort_order
) values
('torta-p', 'cakes', 'Torta P', 'De 10 a 15 fatias.', 'Escolha uma massa e dois recheios, que podem ser iguais.', 115, '', 1, 3, 'cake-production',
 '{"includes":["10 a 15 fatias","1 massa","2 recheios"],"choices":{"massas":["Amanteigada","Chocolate","Red Velvet","Dark","Duo"],"recheios":["Brigadeiro","Brigadeiro branco","Beijinho","Ouro Branco","Ninho","Crocante","Brigadeiro de doce de leite","Geleia de morango","Surpresa de uva","Churros","Ferrero Rocher","Geleia de abacaxi","Galak","Brigadeiro de maracujá","Kinder Bueno","Brigadeiro de Nutella","Mousse de limão","Limão com frutas vermelhas","Galak Trufado","Brigadeiro trufado","Dark Trufado","Ninho Trufado"]},"rules":["Somente retirada","De segunda a quarta, todos os tamanhos","Antecedência mínima de 3 dias úteis"]}'::jsonb, true, true, 10),
('torta-m', 'cakes', 'Torta M', 'De 20 a 25 fatias.', 'Escolha uma massa e dois recheios, que podem ser iguais.', 155, '', 1, 3, 'cake-production',
 '{"includes":["20 a 25 fatias","1 massa","2 recheios"],"choices":{"massas":["Amanteigada","Chocolate","Red Velvet","Dark","Duo"],"recheios":["Brigadeiro","Brigadeiro branco","Beijinho","Ouro Branco","Ninho","Crocante","Brigadeiro de doce de leite","Geleia de morango","Surpresa de uva","Churros","Ferrero Rocher","Geleia de abacaxi","Galak","Brigadeiro de maracujá","Kinder Bueno","Brigadeiro de Nutella","Mousse de limão","Limão com frutas vermelhas","Galak Trufado","Brigadeiro trufado","Dark Trufado","Ninho Trufado"]},"rules":["Somente retirada","De segunda a quarta, todos os tamanhos","Antecedência mínima de 3 dias úteis"]}'::jsonb, true, true, 20),
('torta-g', 'cakes', 'Torta G', 'De 30 a 35 fatias.', 'Escolha uma massa e dois recheios, que podem ser iguais.', 220, '', 1, 3, 'cake-production',
 '{"includes":["30 a 35 fatias","1 massa","2 recheios"],"choices":{"massas":["Amanteigada","Chocolate","Red Velvet","Dark","Duo"],"recheios":["Brigadeiro","Brigadeiro branco","Beijinho","Ouro Branco","Ninho","Crocante","Brigadeiro de doce de leite","Geleia de morango","Surpresa de uva","Churros","Ferrero Rocher","Geleia de abacaxi","Galak","Brigadeiro de maracujá","Kinder Bueno","Brigadeiro de Nutella","Mousse de limão","Limão com frutas vermelhas","Galak Trufado","Brigadeiro trufado","Dark Trufado","Ninho Trufado"]},"rules":["Somente retirada","Disponível de segunda a sábado","Antecedência mínima de 3 dias úteis"]}'::jsonb, true, true, 30),
('docinhos-tradicionais', 'sweets', 'Docinhos tradicionais', 'Pacotes de 25, 50 ou 100 unidades.', 'Brigadeiro, beijinho, casadinho, Chocoball, Ninho, Nesquik e amendoim.', 35, 'a partir de', 25, 1, 'sweets-production',
 '{"packages":[{"quantity":25,"price":35,"flavors":1},{"quantity":50,"price":70,"flavors":2},{"quantity":100,"price":140,"flavors":4}],"choices":{"sabores":["Brigadeiro","Beijinho","Casadinho","Chocoball","Ninho","Nesquik","Amendoim"]},"rules":["Antecedência mínima de 1 dia","Somente retirada"]}'::jsonb, true, true, 40),
('docinhos-especiais', 'sweets', 'Docinhos especiais', 'Pacotes de 25, 50 ou 100 unidades.', 'Churros, crocante, Ninho com Nutella, surpresa de uva, confeito M&M’s e Ferrero Rocher.', 45, 'a partir de', 25, 1, 'sweets-production',
 '{"packages":[{"quantity":25,"price":45,"flavors":1},{"quantity":50,"price":90,"flavors":2},{"quantity":100,"price":180,"flavors":4}],"choices":{"sabores":["Churros","Crocante","Ninho com Nutella","Surpresa de uva","Confeito M&M’s","Ferrero Rocher"]},"rules":["Mistura com tradicionais calculada em 50% de cada tabela","Antecedência mínima de 1 dia","Somente retirada"]}'::jsonb, true, true, 50),
('tabuleiro-100', 'events', 'Tabuleiro de doces - 100 colheres', 'A experiência circula pela festa: cada convidado se serve quantas vezes desejar.', 'Inclui dois brigadeiros, quatro confeitos, duas horas de atendimento e deslocamento gratuito em Fortaleza.', 320, '', 1, 3, 'external-event',
 '{"includes":["100 colheres","2 opções de brigadeiro","4 opções de confeitos","2 horas de atendimento","Deslocamento em Fortaleza"],"choices":{"brigadeiros":["Chocolate","Branco","Ninho","Beijinho","Nesquik"],"confeitos":["Granulado de chocolate","Granulado branco","Granulado colorido","Chocoball","M&M’s","Amendoim","Coco ralado","Crocante"]},"rules":["Um profissional da Adoce circula pela festa com o tabuleiro","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 60),
('tabuleiro-200', 'events', 'Tabuleiro de doces - 200 colheres', 'A experiência circula pela festa: cada convidado se serve quantas vezes desejar.', 'Inclui dois brigadeiros, quatro confeitos, duas horas de atendimento e deslocamento gratuito em Fortaleza.', 420, '', 1, 3, 'external-event',
 '{"includes":["200 colheres","2 opções de brigadeiro","4 opções de confeitos","2 horas de atendimento","Deslocamento em Fortaleza"],"rules":["Um profissional da Adoce circula pela festa com o tabuleiro","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 70),
('tabuleiro-500', 'events', 'Tabuleiro de doces - 500 colheres', 'A experiência circula pela festa: cada convidado se serve quantas vezes desejar.', 'Inclui dois brigadeiros, quatro confeitos, duas horas de atendimento e deslocamento gratuito em Fortaleza.', 550, '', 1, 3, 'external-event',
 '{"includes":["500 colheres","2 opções de brigadeiro","4 opções de confeitos","2 horas de atendimento","Deslocamento em Fortaleza"],"rules":["Um profissional da Adoce circula pela festa com o tabuleiro","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 80),
('festa-na-mesa', 'events', 'Kit Festa na Mesa', 'Uma festa compacta, personalizada e pronta para retirar.', 'Painel personalizado, balões em duas cores, mini bolo, 25 docinhos e cinco pipocas gourmet ou kits de biscoitos.', 220, '', 1, 3, 'party-kit-production',
 '{"includes":["Painel personalizado","Balões em duas cores","Mini bolo de 5 a 8 fatias","25 docinhos em dois sabores","5 pipocas gourmet ou 5 kits de biscoitos"],"rules":["Qualquer tema com 3 dias de antecedência","Somente retirada"]}'::jsonb, true, true, 90),
('kit-comemore', 'rentals', 'Kit Comemore', 'Acervo compacto para montar uma festa charmosa na sua mesa.', 'Painel de 50 x 50 cm, arco de balões em duas cores e duas boleiras.', 50, '', 1, 3, 'rental-comemore',
 '{"includes":["Painel 50 x 50 cm","Arco de balões em duas cores","2 boleiras"],"rules":["Retirada e devolução pelo cliente","Até 48 horas de locação","Devolução até 18h","50% de adiantamento da locação","Avarias cobradas pelo custo de reparo ou reposição"]}'::jsonb, true, true, 100),
('kit-pegue-e-monte', 'rentals', 'Kit Pegue e Monte', 'Uma decoração completa para você montar do seu jeito.', 'Três cilindros, cômoda fake ou mesinha, painel redondo de um metro e três boleiras.', 100, '', 1, 3, 'rental-pegue-monte',
 '{"includes":["3 cilindros decorativos","Cômoda fake ou mesinha","Painel redondo de 1 metro","3 boleiras"],"rules":["Retirada e devolução pelo cliente","Até 48 horas de locação","Devolução até 18h","50% de adiantamento da locação","Avarias cobradas pelo custo de reparo ou reposição"]}'::jsonb, true, true, 110),
('escola-alegria', 'school', 'Kit Alegria na Mochila', 'Lanche individual personalizado para comemorar na escola.', 'Pacote para 15 crianças, com fatia de bolo, docinhos, frutas, salgados, sanduíche e suco.', 390, '15 crianças', 15, 5, 'external-event',
 '{"additional_price":26,"includes":["Fatia de bolo","2 docinhos","Saladinha de fruta","Pão de queijo","Pipoca sem óleo","Salgadinhos sujeitos à escola","Sanduíche natural","Suco natural"],"choices":{"sucos":["Goiaba","Caju","Acerola","Manga"]},"rules":["Escolha de 2 sabores de suco para todo o pedido","Antecedência mínima de 5 dias úteis","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 120),
('escola-recreio-doce', 'school', 'Pacote Recreio Doce', 'Mesa posta com lanches e sucos personalizados.', 'Pacote para 15 crianças com jogo americano, kits de lanche, sucos e balões no suporte.', 500, '15 crianças', 15, 5, 'external-event',
 '{"additional_price":30,"includes":["Mesa posta","Jogo americano","Kit com lanche e suco personalizado","Balões no suporte"],"choices":{"sucos":["Goiaba","Caju","Acerola","Manga"]},"rules":["Escolha de 2 sabores de suco para todo o pedido","Antecedência mínima de 5 dias úteis","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 130),
('escola-intervalo-animado', 'school', 'Pacote Intervalo Animado', 'Mesa posta, mini decoração e mini bolo para os parabéns.', 'Pacote para 15 crianças com lanche completo, suco, balões, mini bolo e mini decoração.', 650, '15 crianças', 15, 5, 'external-event',
 '{"additional_price":35,"includes":["Mesa posta","Kits personalizados","Balões","Mini bolo","Mini decoração"],"choices":{"sucos":["Goiaba","Caju","Acerola","Manga"]},"rules":["Escolha de 2 sabores de suco para todo o pedido","Antecedência mínima de 5 dias úteis","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 140),
('escola-recreio-completo', 'school', 'Pacote Recreio Completo', 'A experiência mais completa da Adoce na Escola.', 'Pacote para 15 crianças com lanche, decoração completa, bolo e lembrancinhas.', 950, '15 crianças', 15, 5, 'external-event',
 '{"additional_price":45,"includes":["Mesa posta","Kits personalizados","Decoração completa com montagem","Bolo","Lembrancinhas"],"choices":{"sucos":["Goiaba","Caju","Acerola","Manga","Tangerina","Maracujá"]},"rules":["Escolha de 2 sabores de suco para todo o pedido","Antecedência mínima de 5 dias úteis","Saldo até 24 horas antes do evento"]}'::jsonb, true, true, 150)
on conflict (slug) do update set
  segment = excluded.segment,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  base_price = excluded.base_price,
  price_suffix = excluded.price_suffix,
  minimum_quantity = excluded.minimum_quantity,
  lead_business_days = excluded.lead_business_days,
  resource_key = excluded.resource_key,
  details = excluded.details,
  published = excluded.published,
  active = excluded.active,
  sort_order = excluded.sort_order;
