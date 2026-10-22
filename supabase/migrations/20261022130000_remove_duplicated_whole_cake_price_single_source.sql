begin;

-- flavors.whole_cake_price era uma CÓPIA do preço oficial de
-- commercial_products (slug 'torta-g'), gravada em todas as linhas de
-- flavors a cada salvamento (ver OperationContentAdmin.tsx). Isso criou
-- duas fontes para o mesmo dado e já causou divergência real em produção
-- (R$ 195 em flavors vs R$ 200 em commercial_products). A partir desta
-- migration, o preço da torta inteira tem uma única fonte:
-- commercial_products.base_price (slug 'torta-g'). flavors só guarda se
-- aquele sabor TEM torta inteira disponível (whole_cake_available) e a
-- foto (whole_cake_image_path) — nunca mais o preço.

alter table public.flavors
  drop constraint if exists flavors_whole_cake_complete;

alter table public.flavors
  drop constraint if exists flavors_whole_cake_price_positive;

alter table public.flavors
  drop column if exists whole_cake_price;

alter table public.flavors
  add constraint flavors_whole_cake_complete
  check (
    not whole_cake_available
    or nullif(trim(whole_cake_image_path), '') is not null
  );

commit;
