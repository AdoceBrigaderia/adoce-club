-- Mantém cadastros antigos para correção administrativa, mas impede que novos
-- nomes com apenas uma palavra sejam gravados no perfil do cliente.
alter table public.profiles
  add constraint profiles_require_first_and_last_name
  check (
    array_length(
      regexp_split_to_array(
        btrim(regexp_replace(full_name, '\s+', ' ', 'g')),
        '\s+'
      ),
      1
    ) >= 2
  ) not valid;
