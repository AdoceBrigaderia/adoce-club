-- Mantem a rotina indisponivel para acesso anonimo e restaura apenas o uso
-- por uma sessao autenticada depois que a nova senha foi aceita.

revoke all on function public.complete_forced_password_change()
  from public, anon;

grant execute on function public.complete_forced_password_change()
  to authenticated;
