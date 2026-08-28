-- O estoque continua disponivel para montagem do pedido, mas a operacao pode
-- informar que determinadas unidades so estarao prontas para retirada a noite.
-- Registros existentes permanecem com retirada imediata para preservar o fluxo
-- atual. A coluna usa a mesma RLS e os mesmos grants da tabela existente.

alter table public.flavor_availability
  add column if not exists pickup_release text not null default 'now';

alter table public.flavor_availability
  drop constraint if exists flavor_availability_pickup_release_check,
  add constraint flavor_availability_pickup_release_check
    check (pickup_release in ('now', 'evening'));

comment on column public.flavor_availability.pickup_release is
  'Momento em que o estoque pode ser retirado: now ou evening (a partir de 20h).';
