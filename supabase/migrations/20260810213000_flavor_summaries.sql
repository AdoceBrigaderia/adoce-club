-- Resumo de vitrine de cada sabor.
--
-- Pedido do Rubens em 10/08: a descricao cadastrada e tecnica — "tres camadas
-- de massa leve, macia e aerada, intercaladas com..." — e se repete quase
-- igual em 20 dos 26 sabores. Serve para ficha tecnica, nao para dar vontade.
--
-- Aqui fica uma linha curta por sabor, sensorial, escrita para o cliente
-- decidir. A descricao completa continua em `flavors.description` para quem
-- quiser ler mais, e os ingredientes continuam onde estao.
--
-- Regra do texto: no maximo 90 caracteres, sem lista de ingredientes, sem
-- "delicioso" nem "irresistivel" — palavra que serve para qualquer bolo nao
-- diz nada sobre este.

create table if not exists public.flavor_summaries (
  flavor_id uuid primary key references public.flavors(id) on delete cascade,
  resumo text not null check (char_length(resumo) between 10 and 90),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

comment on table public.flavor_summaries is
  'Uma linha por sabor, escrita para a vitrine. Curta de proposito.';

alter table public.flavor_summaries enable row level security;

revoke all on public.flavor_summaries from public, anon, authenticated;
grant select on public.flavor_summaries to anon, authenticated;
grant all on public.flavor_summaries to service_role;

-- Leitura publica: e vitrine, existe para ser vista.
create policy flavor_summaries_public_read
  on public.flavor_summaries for select
  to anon, authenticated
  using (true);

-- Escrita so pela operacao.
create policy flavor_summaries_staff_write
  on public.flavor_summaries for all
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Os 26 resumos.
-- ---------------------------------------------------------------------------

insert into public.flavor_summaries (flavor_id, resumo)
select f.id, t.resumo
from public.flavors f
join (values
  ('Abacaxi com Coco',                         'Abacaxi em calda com beijinho. Doce e refrescante ao mesmo tempo.'),
  ('Black Velvet',                             'Cacau black, quase amargo. Para quem acha chocolate ao leite pouco.'),
  ('Black Velvet Trufado',                     'O Black Velvet com trufa por dentro. Escuro, denso, sem meio-termo.'),
  ('Chocolate com Castanha de Caju',           'Brigadeiro com castanha torrada. O crocante que faltava no chocolate.'),
  ('Chocolatudo',                              'Chocolate por todos os lados. O mais pedido da casa.'),
  ('Chocolatudo Supreme',                      'O Chocolatudo com pedaços de chocolate no recheio. Mais é mais.'),
  ('Chocolatudo Trufado',                      'Chocolate, brigadeiro cremoso e morango fresco. Clássico que não erra.'),
  ('Doce de Leite com Coco',                   'Doce de leite e beijinho, do jeito que a gente comia em casa.'),
  ('Doce de Leite com Nutella',                'Doce de leite e Nutella na mesma fatia. Sim, os dois juntos.'),
  ('Dois Amores',                              'Brigadeiro preto e branco, meio a meio. Não precisa escolher.'),
  ('Ferrero Rocher',                           'Brigadeiro, amendoim e crocância. O bombom virou fatia.'),
  ('Galak Trufado com Morangos',               'Galak cremoso com morango fresco. Doce e ácido na medida certa.'),
  ('Kinder Bueno',                             'Nutella branca, Nutella tradicional e wafer crocante. Premium, e vale.'),
  ('Limão Siciliano com Frutas Vermelhas',     'Mousse de limão com geleia de frutas vermelhas. Leve e cítrica.'),
  ('Maracujá com Chocolate',                   'Maracujá cremoso encontrando o chocolate. O azedinho na medida.'),
  ('Morango com Suspiros',                     'Ninho, geleia de morango e suspiro. Doce de festa de criança.'),
  ('Mousse de Limão',                          'Mousse de limão com Bis por cima. Refrescante do começo ao fim.'),
  ('Olho de Sogra',                            'Doce de leite com ameixa e beijinho. O clássico que nunca sai de moda.'),
  ('Oreo',                                     'Massa de chocolate com Oreo triturado. Simples e viciante.'),
  ('Ouro Branco',                              'O bombom Ouro Branco em forma de fatia. Cremoso e delicado.'),
  ('Ovomaltine',                               'Chocolate com Ovomaltine crocante. Nostalgia em cada garfada.'),
  ('Red Velvet com Geleia de Morango e Ninho', 'Massa vermelha, Ninho e geleia de morango. Bonita e cremosa.'),
  ('Red Velvet com Ninho e Nutella',           'Red velvet com Ninho e Nutella. Marcante do primeiro ao último pedaço.'),
  ('Surpresa de Uva',                          'Uvas frescas com brigadeiro branco. Ninguém espera, e todo mundo volta.'),
  ('Torta de Pudim',                           'Pudim e doce de leite na mesma fatia. A novidade que virou queridinha.'),
  ('Trufado de Ninho',                         'Chocolate com brigadeiro de Ninho e morango. O mais elogiado da casa.')
) as t(nome, resumo) on t.nome = f.name
on conflict (flavor_id) do update set resumo = excluded.resumo, updated_at = now();

create or replace function private.tocar_flavor_summaries()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flavor_summaries_touch on public.flavor_summaries;
create trigger flavor_summaries_touch
before update on public.flavor_summaries
for each row execute function private.tocar_flavor_summaries();
