# Gate de segurança — status da reestruturação

Este documento acompanha somente a branch `reestruturacao/ux-crm-operacao-imagens-v1`. Produção permanece fora do escopo até aprovação expressa.

## Concluído e protegido por testes

### Sessão e autenticação

- Cliente e equipe usam BFF com cookies `__Host-`, `HttpOnly`, `Secure` e `SameSite`.
- Access token limitado a 15 minutos, refresh rotacionado no servidor e sessão longa somente quando solicitada.
- Logout revoga a sessão no Supabase e remove access, refresh, superfície e CSRF.
- CSRF por double-submit token nas alterações autenticadas.
- Respostas de autenticação usam `no-store` e nunca devolvem access/refresh token ao JavaScript.
- Senhas temporárias são aleatórias, expiram em duas horas e exigem troca.
- Login e gerenciamento de passkeys estão disponíveis para clientes e equipe, com fallback por senha/código.
- Cadastro público, recuperação por WhatsApp OTP, cartão do cliente e check-in NFC/QR usam a fronteira BFF.

### Navegador e APIs públicas

- O cliente Supabase está com `persistSession`, `autoRefreshToken` e `detectSessionInUrl` desativados.
- Uma auditoria recursiva falha o pipeline se uma superfície real voltar a usar tokens, `auth.setSession/getSession`, Bearer manual, chave privada ou segredo `VITE_*`.
- As antigas superfícies `AccessApp`, `PilotApp`, `ProductionRollbackPanel`, cadastro direto e auxiliares de autenticação por token foram removidas da árvore ativa.
- Rotas de demonstração, festival legado e rollback deixaram de existir no roteador real e não podem ser reintroduzidas sem reprovar os testes e a auditoria.
- Os endpoints legados de atualização de segurança por Bearer e restauração remota de produção foram removidos das Netlify Functions.
- Adoce Hoje, pré-reservas comerciais, Pede Junto, analytics e feedback público passam por Functions same-origin.
- RPCs de escrita pública correspondentes foram retirados de `anon`/`authenticated` e limitados ao `service_role` do servidor.
- RPCs aposentados de consulta de pedido, verificação antiga do WhatsApp, claim antigo de cadastro e auditoria do rollback remoto foram bloqueados para `anon` e `authenticated` na homologação.
- O advisor de segurança deixou de apresentar função `SECURITY DEFINER` executável por usuário anônimo; os avisos restantes de `authenticated` estão em auditoria por allowlist e autorização interna.
- Pré-reservas e feedback possuem chave idempotente e trava transacional contra duplicidade.
- Endpoints públicos sensíveis possuem rate limit transacional por IP e contato com identificadores anonimizados antes do armazenamento.
- Tabelas exclusivamente internas têm RLS, privilégios diretos revogados e política explícita de negação.
- CSP, HSTS, anti-frame, nosniff, Referrer-Policy, Permissions-Policy e COOP/CORP são verificados no build.

### Integridade da operação

- Venda rápida exige caixa aberto e calcula valores, estoque, pagamento e movimento no backend.
- Contingência sem caixa é exclusiva de proprietário/gestor, auditada e entra em fila de reconciliação.
- Fidelidade manual usa `FOR UPDATE`, idempotência, ledger, auditoria e validação de recompensas.
- Favoritos da venda rápida são privados por operador; popularidade é calculada no servidor.
- Matriz por loja cobre venda, caixa, estoque, financeiro, clientes, pedidos, produção, relatórios e configurações.
- Mudanças de papel e capacidade geram auditoria; gerente não altera proprietário/gestor e o último proprietário ativo não pode ser removido.
- Valores públicos de pedidos e upgrade de recompensa são recalculados no banco.
- O ensaio vivo transacional da matriz de permissões foi executado no Supabase de homologação com `ROLLBACK`, validando cashier, production, isolamento entre lojas, auditoria de capacidade e bloqueios de owner/manager sem persistir os dados temporários.
- O rate limit foi testado ao vivo em transação: duas solicitações permitidas, terceira bloqueada e tempo de nova tentativa retornado, com `ROLLBACK` ao final.

### Homologação e automação

- Gate de ambiente rejeita domínio/contexto de produção, projeto Supabase divergente e chave secreta no Vite.
- Migrations desta reestruturação são aplicadas somente ao Supabase de homologação.
- Playwright executa as rotas reais em celular, tablet e computador, verificando identidade, cadastro, login BFF, toque mínimo, overflow e ausência de módulos de demonstração.
- Workflows executam TypeScript, Vitest, auditoria de imagens, auditoria do navegador, isolamento do ambiente, build e verificação dos headers.
- Build e diagnósticos são preservados como artefatos para inspeção.
- O deploy de homologação é manual, exige branch e commit exatos, confirmação textual e site Netlify diferente da produção.
- O deploy de produção não possui endpoint remoto de restauração e exige gate temporário com aprovação expressa, SHA exato, backup, rollback e plano de smoke tests.

## Parcial — não considerar resolvido

- Passkeys precisam de ensaio em aparelhos reais e RP ID/origens definitivos do domínio de homologação.
- Meta WhatsApp Cloud API está implementada com adapter, webhook, OTP e painel, mas o envio real depende das credenciais e do template aprovados para homologação.
- Google Wallet está preparado no BFF e banco, porém a emissão real depende da conta de emissor e da chave de serviço.
- O preview público de homologação ainda deve ser configurado com variáveis exclusivas, publicado e submetido ao roteiro funcional completo.
- A proteção contra senhas vazadas deve ser habilitada no Supabase Auth de homologação quando a configuração estiver disponível.
- As funções `SECURITY DEFINER` intencionalmente executáveis por `authenticated` continuam sendo comparadas com a allowlist do BFF e seus controles internos antes da liberação final.

## Bloqueadores restantes para liberar a homologação ao usuário

1. Executar testes reais de passkey em Android, iPhone e Windows.
2. Configurar Meta WhatsApp e Google Wallet no cofre do ambiente de homologação.
3. Publicar um preview isolado, confirmar que todas as Functions estão presentes e executar smoke tests externos.
4. Concluir o inventário das funções `SECURITY DEFINER` autenticadas e bloquear qualquer rotina fora das superfícies atuais.
5. Comparar novamente o preview com a produção atual sem migrar, publicar ou alterar produção.

## Evidências principais

- `scripts/audit-browser-security.mjs`
- `scripts/browser-security-audit-core.mjs`
- `scripts/homologation-environment-gate.mjs`
- `scripts/verify-security-build.mjs`
- `tests/e2e/public-mobile-smoke.e2e.mjs`
- `supabase/tests/permission_matrix_live.sql`
- `supabase/tests/public_endpoint_rate_limit_live.sql`
- `supabase/migrations/20260727124000_lock_retired_direct_rpcs.sql`
- `docs/permission-matrix-live-runbook.md`
- `src/legacy-surfaces-removed.test.ts`
- `src/retired-direct-rpc-lockdown.test.ts`
- `src/bff-session-security.test.ts`
- `src/public-service-request-bff-security.test.ts`
- `src/site-feedback-bff-hardening.test.ts`
- `src/staff-permission-owner-guard.test.ts`
- Workflows `Portal quality gate`, `Verificar reestruturação` e `Playwright mobile e tablet`

## Produção

Nenhum merge, migration ou deploy de produção está autorizado. A publicação final exige aprovação expressa, commit exato, backup confirmado, plano de rollback e smoke tests.
