-- Uma capa editável por operação comercial evita repetir a mesma foto em
-- todos os pacotes de Eventos, Escola e Aluguel de Decoração.
create table if not exists public.commercial_segment_media (
  id uuid not null default gen_random_uuid() unique,
  segment text primary key check (segment in ('cakes', 'sweets', 'events', 'school', 'rentals')),
  image_url text not null check (char_length(image_url) between 1 and 1000),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.commercial_segment_media enable row level security;

drop policy if exists commercial_segment_media_public_read on public.commercial_segment_media;
create policy commercial_segment_media_public_read
  on public.commercial_segment_media for select to anon, authenticated
  using (true);

drop policy if exists commercial_segment_media_manager_all on public.commercial_segment_media;
create policy commercial_segment_media_manager_all
  on public.commercial_segment_media for all to authenticated
  using (private.is_manager())
  with check (private.is_manager());

grant select on public.commercial_segment_media to anon, authenticated;
grant insert, update, delete on public.commercial_segment_media to authenticated;

drop trigger if exists commercial_segment_media_touch on public.commercial_segment_media;
create trigger commercial_segment_media_touch
  before update on public.commercial_segment_media
  for each row execute function private.touch_updated_at();

drop trigger if exists audit_content_change on public.commercial_segment_media;
create trigger audit_content_change
  after insert or update or delete on public.commercial_segment_media
  for each row execute function private.audit_content_change();

insert into public.commercial_segment_media (segment, image_url, alt_text)
values
  ('cakes', '/site/hero-cake.webp', 'Fatia artesanal de chocolate da Adoce'),
  ('sweets', '/adoce-hoje/docinhos-tradicionais.webp', 'Docinhos artesanais tradicionais da Adoce'),
  ('events', '/adoce-hoje/tabuleiro-doces.webp', 'Atendimento real com o Tabuleiro de Doces da Adoce'),
  ('school', '/adoce-hoje/adoce-na-escola.webp', 'Comemoração real organizada pela Adoce em uma escola'),
  ('rentals', '/adoce-hoje/festas-eventos.webp', 'Decoração real montada com peças disponíveis para locação')
on conflict (segment) do nothing;

-- O Kit Festa na Mesa pertence ao Adoce na Escola, e não à página geral de
-- eventos. A alteração preserva preço, histórico e o identificador existente.
update public.commercial_products
set segment = 'school', sort_order = 90
where slug = 'festa-na-mesa';

update public.commercial_products
set image_url = case slug
  when 'docinhos-tradicionais' then '/adoce-hoje/docinhos-tradicionais.webp'
  when 'docinhos-especiais' then '/adoce-hoje/docinhos-premium.webp'
  else image_url
end
where slug in ('docinhos-tradicionais', 'docinhos-especiais')
  and image_url is null;
