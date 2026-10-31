-- Caldas so de sabado (pedido do proprietario em 31/10/2026): Calda de Nutella
-- e Calda de Doce de leite ficam disponiveis apenas aos sabados.
-- available_weekdays usa o dia ISO (1 = segunda ... 6 = sabado, 7 = domingo);
-- nulo = todos os dias. Um job diario liga/desliga a coluna `active` conforme o
-- dia em Fortaleza, entao site, carrinho, caixa e as validacoes do banco (que
-- ja exigem `active`) passam a respeitar a regra sem outra mudanca.

alter table public.order_sauces
  add column if not exists available_weekdays smallint[];

create or replace function private.apply_sauce_weekdays()
returns void
language sql
security definer
set search_path to ''
as $$
  update public.order_sauces
  set active = extract(isodow from (now() at time zone 'America/Fortaleza'))::smallint = any(available_weekdays),
      updated_at = now()
  where available_weekdays is not null
    and active is distinct from (extract(isodow from (now() at time zone 'America/Fortaleza'))::smallint = any(available_weekdays));
$$;
revoke all on function private.apply_sauce_weekdays() from public;

insert into public.order_sauces (name, active, sort_order, available_weekdays)
select v.name, false, v.sort_order, array[6]::smallint[]
from (values ('Calda de Nutella', 40), ('Calda de Doce de leite', 50)) as v(name, sort_order)
where not exists (select 1 from public.order_sauces s where lower(s.name) = lower(v.name));

-- 00:01 em Fortaleza (UTC-3).
select cron.schedule('apply-sauce-weekdays', '1 3 * * *', 'select private.apply_sauce_weekdays()');

select private.apply_sauce_weekdays();
