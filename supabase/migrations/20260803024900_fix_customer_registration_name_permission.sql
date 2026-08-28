-- Permite que o gatilho de normalizacao do cadastro seja executado pelo
-- proprio cliente autenticado durante a conclusao da entrada no Clube.
grant execute on function private.normalize_person_name(text) to authenticated;
