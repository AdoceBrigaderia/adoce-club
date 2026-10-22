begin;

-- A migration 20261020150000 atualizou commercial_products.base_price (Torta G
-- de R$ 195 para R$ 200), mas não tocou em flavors.whole_cake_price, que é o
-- valor realmente cobrado no checkout de torta inteira do Adoce Hoje
-- (ver src/AdoceHoje.tsx). Isso deixava o Adoce Hoje cobrando R$ 195 enquanto
-- o Catálogo 2026 já anunciava R$ 200 para a Torta G.
update public.flavors
set whole_cake_price = 200.00
where name <> 'Torta de Pudim'
  and whole_cake_price is not null
  and whole_cake_price is distinct from 200.00;

commit;
