begin;

-- Pedido do proprietário em 01/11/2026: os nomes dados na migração anterior
-- (20261101130000) não são os que o proprietário realmente usa -- os dois
-- locais passam a se chamar "Adoce Fábrica" e "Adoce Barraca".
update public.pickup_locations
set name = 'Adoce Fábrica',
    public_label = 'Retire na Adoce Fábrica',
    updated_at = now()
where slug = 'portao-adoce';

update public.pickup_locations
set name = 'Adoce Barraca',
    public_label = 'Retire na Adoce Barraca',
    updated_at = now()
where slug = 'cantinho-da-adoce';

-- Até agora não existia nenhum controle real: o backend sempre mandava
-- 'cantinho-da-adoce' pro cliente (hardcoded no frontend), independente do
-- que a operação escrevia na caixa de mensagem do painel "Pedidos online".
-- Isso cria esse controle de verdade: a operação escolhe qual
-- pickup_locations.slug vale para os pedidos online de hoje, e essa escolha
-- é a mesma fonte usada tanto pra mensagem mostrada à cliente quanto pro
-- local de fato gravado no pedido.
alter table public.store_channels
  add column if not exists pickup_location_slug text references public.pickup_locations(slug);

update public.store_channels
set pickup_location_slug = 'cantinho-da-adoce'
where slug = 'online_orders' and pickup_location_slug is null;

commit;
