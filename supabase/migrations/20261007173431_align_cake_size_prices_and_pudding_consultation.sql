-- Preços comuns vigentes das tortas inteiras. Custos das fatias ainda serão
-- apurados antes de qualquer novo preço de venda.
update public.commercial_products
set base_price = case slug
  when 'torta-p' then 115.00
  when 'torta-m' then 155.00
  when 'torta-g' then 195.00
end
where slug in ('torta-p', 'torta-m', 'torta-g')
  and base_price is distinct from case slug
    when 'torta-p' then 115.00
    when 'torta-m' then 155.00
    when 'torta-g' then 195.00
  end;

update public.flavors
set whole_cake_price = 195.00
where name <> 'Torta de Pudim'
  and whole_cake_price is distinct from 195.00;

-- Sem preço numérico, o pudim não pode entrar no checkout automático de
-- fatias nem ser apresentado com o valor G comum aos demais sabores.
update public.flavors
set base_price = null,
    whole_cake_price = null,
    whole_cake_available = false
where name = 'Torta de Pudim'
  and (base_price is not null or whole_cake_price is not null or whole_cake_available);
