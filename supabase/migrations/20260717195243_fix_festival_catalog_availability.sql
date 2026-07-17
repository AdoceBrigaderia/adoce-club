insert into public.flavor_availability(flavor_id, service_date, status, note)
select id, date '2026-07-17', 'available', 'Disponível agora e também no festival desta noite'
from public.flavors
where name like 'Chocolate trufado com brigadeiro de Ninho e peda%morango'
on conflict (flavor_id, service_date) do update set
  status = excluded.status,
  note = excluded.note,
  updated_at = now();
