begin;

-- Fonte única dos valores exibidos nas páginas públicas e na operação.
update public.commercial_products
set base_price = case slug
      when 'docinhos-tradicionais' then 70.00
      when 'docinhos-especiais' then 90.00
    end,
    price_suffix = '50 un.',
    minimum_quantity = 50,
    updated_at = now()
where slug in ('docinhos-tradicionais', 'docinhos-especiais');

commit;
