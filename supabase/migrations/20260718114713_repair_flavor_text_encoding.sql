begin;

-- Corrige apenas textos antigos que foram salvos como UTF-8 interpretado em
-- Latin-1. Valores já corretos não entram nos filtros abaixo.
update public.flavors
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8')
where name like '%Ã%';

update public.flavors
set short_description = convert_from(convert_to(short_description, 'LATIN1'), 'UTF8')
where short_description like '%Ã%';

update public.flavors
set description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
where description like '%Ã%';

commit;
