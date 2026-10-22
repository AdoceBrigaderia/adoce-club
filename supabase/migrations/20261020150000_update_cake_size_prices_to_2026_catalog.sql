begin;

-- Alinha os preços de tortas (P/M/G) aos valores do Catálogo 2026
-- (R$ 120 / R$ 160 / R$ 200), que hoje estavam em R$ 115 / R$ 155 / R$ 195.
-- Esses três registros valem para todos os sabores de tortas, pois o
-- cadastro de preço de torta não é por sabor, é por tamanho.
update public.commercial_products
set base_price = case name
    when 'Torta P' then 120.00
    when 'Torta M' then 160.00
    when 'Torta G' then 200.00
  end,
  updated_at = now()
where segment = 'cakes'
  and name in ('Torta P', 'Torta M', 'Torta G');

commit;
