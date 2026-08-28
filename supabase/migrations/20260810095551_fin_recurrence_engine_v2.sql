alter table public.fin_series
  add column if not exists description text not null default '',
  add column if not exists freq text not null default 'monthly',
  add column if not exists interval_n int not null default 1,
  add column if not exists month_day int,
  add column if not exists nth int,
  add column if not exists adjust text not null default 'next_business',
  add column if not exists occurrences int,
  add column if not exists active boolean not null default true;

alter table public.fin_series drop constraint if exists fin_series_recurrence_check;
alter table public.fin_series drop constraint if exists fin_series_freq_check;
alter table public.fin_series add constraint fin_series_freq_check
  check (freq in ('weekly','biweekly','monthly','monthly_nth','n_months','yearly'));
alter table public.fin_series alter column recurrence drop not null;

alter table public.fin_entries
  add column if not exists occurrence_index int,
  add column if not exists occurrence_total int;

create or replace function public.fin_adjust_date(d date)
returns date language plpgsql immutable as $$
declare fim date := (date_trunc('month', d) + interval '1 month - 1 day')::date; r date := d;
begin
  if extract(isodow from r) = 6 then r := r + 2;
  elsif extract(isodow from r) = 7 then r := r + 1;
  end if;
  if r > fim then
    r := d;
    while extract(isodow from r) in (6,7) loop r := r - 1; end loop;
  end if;
  return r;
end $$;

create or replace function public.fin_monthly_date(inicio date, dia int, n int)
returns date language plpgsql immutable as $$
declare base date; ultimo int;
begin
  base := (date_trunc('month', inicio) + (n || ' month')::interval)::date;
  ultimo := extract(day from (date_trunc('month', base) + interval '1 month - 1 day'))::int;
  return public.fin_adjust_date(base + (least(dia, ultimo) - 1));
end $$;
;
