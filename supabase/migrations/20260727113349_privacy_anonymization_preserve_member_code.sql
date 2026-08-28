begin;

do $$
declare
  function_definition text;
  corrected_definition text;
  member_loop text := $block$
  loop
    attempt := attempt + 1;
    anonymous_member_code := format(
      'ADOC %s %s %s',
      lpad(floor(random() * 10000)::integer::text, 4, '0'),
      lpad(floor(random() * 10000)::integer::text, 4, '0'),
      lpad(floor(random() * 10000)::integer::text, 4, '0')
    );
    exit when not exists (
      select 1 from public.profiles existing
      where existing.member_code = anonymous_member_code
        and existing.id <> profile_row.id
    );
    if attempt >= 20 then
      raise exception 'Não foi possível gerar identificador anonimizado único';
    end if;
  end loop;
$block$;
begin
  select pg_get_functiondef(
    'private.staff_anonymize_privacy_profile_core(uuid,text)'::regprocedure
  ) into function_definition;

  if position(member_loop in function_definition) = 0
     or position('member_code = anonymous_member_code,' in function_definition) = 0 then
    raise exception 'Estrutura inesperada da função de anonimização para o código do membro';
  end if;

  corrected_definition := replace(function_definition, '  anonymous_member_code text;' || chr(10), '');
  corrected_definition := replace(corrected_definition, '  attempt integer := 0;' || chr(10), '');
  corrected_definition := replace(corrected_definition, member_loop, '');
  corrected_definition := replace(
    corrected_definition,
    '      member_code = anonymous_member_code,' || chr(10),
    ''
  );

  execute corrected_definition;
end;
$$;

commit;
