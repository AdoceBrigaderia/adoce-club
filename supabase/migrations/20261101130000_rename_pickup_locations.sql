begin;

-- Pedido do proprietário em 01/11/2026: os dois locais de retirada (só uso
-- interno da operação agora, não aparecem mais pro cliente escolher)
-- passam a se chamar os dois "Cantinho da Adoce", diferenciados só pelo
-- que são: a fábrica (endereço que antes era "Adoce Brigaderia") e o
-- atendimento (endereço que já era "Cantinho da Adoce"). Endereços não
-- mudam, só o nome.
update public.pickup_locations
set name = 'Cantinho da Adoce (Fábrica)',
    public_label = 'Retire no Cantinho da Adoce (Fábrica)',
    updated_at = now()
where slug = 'portao-adoce';

update public.pickup_locations
set name = 'Cantinho da Adoce (Atendimento)',
    public_label = 'Retire no Cantinho da Adoce (Atendimento)',
    updated_at = now()
where slug = 'cantinho-da-adoce';

commit;
