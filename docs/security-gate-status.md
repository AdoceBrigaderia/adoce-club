# Gate de segurança — status da reestruturação

Este documento acompanha somente a branch `reestruturacao/ux-crm-operacao-imagens-v1`. Produção permanece fora do escopo até aprovação expressa.

## Concluído nesta etapa

- Fundação BFF para autenticação por celular e senha.
- Access e refresh tokens emitidos em cookies `__Host-`, `HttpOnly`, `Secure` e `SameSite`.
- Access token limitado a no máximo 15 minutos.
- Rotação do refresh token executada no servidor.
- Logout global com revogação no Supabase e limpeza dos quatro cookies.
- Proteção CSRF por double-submit token no logout.
- Respostas de autenticação com `no-store` e sem tokens no corpo.
- Senhas temporárias aleatórias com validade de duas horas.
- Bloqueio e revogação quando uma senha temporária expira.
- Limpeza da janela temporária depois da troca obrigatória.
- RPCs operacionais sensíveis deixaram de ser executáveis pelo papel `anon`.
- RPCs do protótipo aposentado deixaram de ser executáveis por `anon` e `authenticated`.

## Parcial — não considerar resolvido

A fundação BFF ainda precisa substituir integralmente a sessão Supabase usada pelo frontend. Enquanto existirem fluxos que chamem `auth.setSession` e mantenham consultas autenticadas diretamente no navegador, os tokens continuam acessíveis ao JavaScript nesses fluxos. A homologação final permanece bloqueada até o corte completo.

## Próximos bloqueadores

1. Migrar login, restauração, logout e todas as chamadas autenticadas para o BFF.
2. Eliminar a persistência de sessão do cliente Supabase e remover `auth.setSession` do bundle final.
3. Finalizar a matriz de autorização por função, ação e loja em todos os RPCs antigos.
4. Corrigir os demais caminhos financeiros e o preço de upgrade premium calculado no cliente.
5. Executar testes concorrentes de fidelidade.
6. Habilitar a proteção contra senhas vazadas no Supabase Auth de homologação.
7. Executar testes de XSS, CSRF, revogação, escalada de privilégio e acesso entre lojas.

## Evidências automatizadas

- `src/bff-session-security.test.ts`
- `src/temporary-password-expiry-migration.test.ts`
- `src/sensitive-function-execute-migration.test.ts`
- Workflows `Portal quality gate` e `Verificar reestruturação`
