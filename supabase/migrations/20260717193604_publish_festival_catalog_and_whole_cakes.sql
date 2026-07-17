insert into public.flavors(name, category, short_description, description, image_path, base_price, active, sort_order)
values
  ('Trufado de Ninho', 'traditional', 'Massa de chocolate com recheio cremoso de brigadeiro de Ninho.', 'Uma combinação cremosa de chocolate e brigadeiro de Ninho.', '/adoce-hoje/fatia-ilustrativa.webp', 16, true, 8),
  ('Trufado Black', 'traditional', 'Chocolate intenso com recheio trufado e acabamento marcante.', 'Uma fatia intensa para quem prefere chocolate de sabor profundo.', '/adoce-hoje/trufado-black-ilustrativa.webp', 16, true, 9),
  ('Maracujá com Chocolate', 'traditional', 'Massa chiffon, brigadeiro de maracujá e brigadeiro de chocolate.', 'O contraste do maracujá com a cremosidade do chocolate.', '/adoce-hoje/maracuja-chocolate.webp', 16, true, 10),
  ('Ouro Branco', 'traditional', 'Massa macia com recheio cremoso inspirado no bombom Ouro Branco.', 'Cremosa, delicada e inspirada no bombom Ouro Branco.', '/adoce-hoje/fatia-ilustrativa.webp', 16, true, 11),
  ('2 Amores', 'traditional', 'Camadas de chocolate e creme branco em uma mesma fatia.', 'Dois sabores que se encontram em uma fatia cremosa.', '/adoce-hoje/fatia-ilustrativa.webp', 16, true, 12),
  ('Morango com Suspiros', 'traditional', 'Creme leve com morangos e suspiros crocantes.', 'Morangos, creme e a crocância delicada dos suspiros.', '/adoce-hoje/fatia-ilustrativa.webp', 16, true, 13),
  ('Surpresa de Uva', 'traditional', 'Massa chiffon, brigadeiro branco, uvas Thompson e bombons de brigadeiro com uva.', 'Muito recheio, uvas Thompson e bombons de brigadeiro com uva.', '/adoce-hoje/surpresa-uva.webp', 16, true, 14)
on conflict (name) do update set
  category = excluded.category,
  short_description = excluded.short_description,
  description = excluded.description,
  image_path = excluded.image_path,
  base_price = excluded.base_price,
  active = excluded.active,
  sort_order = excluded.sort_order;

delete from public.flavor_availability where service_date = date '2026-07-17';

insert into public.flavor_availability(flavor_id, service_date, status, note)
select id, date '2026-07-17', 'available', 'Disponível agora e também no festival desta noite'
from public.flavors
where name in (
  'Chocolatudo',
  'Chocolatudo trufado com morangos',
  'Oreo',
  'Ferrero Rocher',
  'Abacaxi com coco',
  'Brigadeiro de chocolate com castanha de caju',
  'Chocolate trufado com brigadeiro de Ninho e pedaços de morango'
);

insert into public.flavor_availability(flavor_id, service_date, status, note)
select id, date '2026-07-17', 'preorder_only', 'Disponível no Festival de Fatias a partir das 19h30'
from public.flavors
where name in (
  'Trufado de Ninho',
  'Trufado Black',
  'Maracujá com Chocolate',
  'Ouro Branco',
  '2 Amores',
  'Morango com Suspiros',
  'Surpresa de Uva'
);
