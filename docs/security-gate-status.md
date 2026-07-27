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
- Adoce Hoje, pré-reservas comerciais, Pede Junto, analytics e feedback público passam por Functions same-origin.
- RPCs de escrita pública correspondentes foram retirados de `anon`/`authenticated` e limitados ao `service_role` do servidor.
- Pré-reservas e feedback possuem chave idempotente e trava transacional contra duplicidade.
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

### Homologação e automação

- Gate de ambiente rejeita domínio/contexto de produção, projeto Supabase divergente e chave secreta no Vite.
- Migrations desta reestruturação são aplicadas somente ao Supabase de homologação.
- Playwright executa as rotas reais em celular, tablet e computador, verificando identidade, cadastro, login BFF, toque mínimo, overflow e ausência de módulos de demonstração.
- Workflows executam TypeScript, Vitest, auditoria de imagens, auditoria do navegador, isolamento do ambiente, build e verificação dos headers.
- Build e diagnósticos são preservados como artefatos para inspeção.

## Parcial — não considerar resolvido

- Módulos antigos usados apenas por rotas `import.meta.env.DEV` ainda existem no repositório e aparecem como alertas inventariados. As rotas reais não os carregam, mas a remoção física continua pendente.
- Passkeys precisam de ensaio em aparelhos reais e RP ID/origens definitivos do domínio de homologação.
- Meta WhatsApp Cloud API está implementada com adapter, webhook, OTP e painel, mas o envio real depende das credenciais e do template aprovados para homologação.
- Google Wallet está preparado no BFF e banco, porém a emissão real depende da conta de emissor e da chave de serviço.
- O preview público de homologação ainda deve ser configurado com variáveis exclusivas, publicado e submetido ao roteiro funcional completo.
- A proteção contra senhas vazadas deve ser habilitada no Supabase Auth de homologação quando a configuração estiver disponível.

## Bloqueadores restantes para liberar a homologação ao usuário

1. Remover ou arquivar os módulos DEV legados ainda inventariados pela auditoria.
2. Criar usuários de teste para cada papel e executar testes vivos de escalada, acesso entre lojas e revogação.
3. Executar testes reais de passkey em Android, iPhone e Windows.
4. Configurar Meta WhatsApp e Google Wallet no cofre do ambiente de homologação.
5. Publicar um preview isolado, confirmar que todas as Functions estão presentes e executar smoke tests externos.
6. Comparar novamente o preview com a produção atual sem migrar, publicar ou alterar produção.

## Evidências principais

- `scripts/audit-browser-security.mjs`
- `scripts/homologation-environment-gate.mjs`
- `scripts/verify-security-build.mjs`
- `tests/e2e/public-mobile-smoke.e2e.mjs`
- `src/bff-session-security.test.ts`
- `src/public-service-request-bff-security.test.ts`
- `src/site-feedback-bff-hardening.test.ts`
- `src/staff-permission-owner-guard.test.ts`
- Workflows `Portal quality gate`, `Verificar reestruturação` e `Playwright mobile e tablet`

## Produção

Nenhum merge, migration ou deploy de produção está autorizado. A publicação final exige aprovação expressa, commit exato, backup confirmado, plano de rollback e smoke tests.
