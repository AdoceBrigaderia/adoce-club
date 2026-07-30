# Gate de segurança — status da reestruturação

Este documento acompanha somente a branch `reestruturacao/ux-crm-operacao-imagens-v1`. Produção permanece fora do escopo até aprovação expressa.

## Concluído e protegido por testes

### Sessão e autenticação

- Cliente e equipe usam BFF com cookies `__Host-`, `HttpOnly`, `Secure` e `SameSite`.
- Access token limitado a 15 minutos, refresh rotacionado no servidor e sessão longa somente quando solicitada.
- Logout revoga a sessão no Supabase e remove access, refresh, superfície e CSRF.
- CSRF por double-submit token nas alterações autenticadas.
- Respostas de autenticação usam `no-store` e nunca devolvem access/refresh token ao JavaScript.
- Respostas JSON das Functions também aplicam `nosniff`, `DENY`, `no-referrer` e CSP restritiva diretamente no servidor, sem depender apenas do arquivo de configuração da hospedagem.
- Leituras sem cabeçalho `Origin` permanecem disponíveis para health checks e navegação legítima, mas são bloqueadas quando o navegador informa `Sec-Fetch-Site: cross-site` ou `same-site`.
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
- RPCs aposentados e rotas autenticadas não utilizadas foram retirados das funções acessíveis pelo navegador.
- A allowlist viva dos `SECURITY DEFINER` autenticados foi executada na homologação e falha caso uma função inesperada seja exposta.
- Pré-reservas e feedback possuem chave idempotente e trava transacional contra duplicidade.
- Endpoints públicos sensíveis possuem rate limit transacional por IP e contato com identificadores anonimizados antes do armazenamento.
- Tabelas exclusivamente internas têm RLS, privilégios diretos revogados e política explícita de negação.
- CSP, HSTS, anti-frame, nosniff, Referrer-Policy, Permissions-Policy e COOP/CORP são verificados no build.
- O contrato de origem do BFF varia também por `Sec-Fetch-Site`, evitando que caches compartilhem respostas entre contextos de navegação distintos.

### Integridade da operação

- Venda rápida exige caixa aberto e calcula valores, estoque, pagamento e movimento no backend.
- Contingência sem caixa é exclusiva de proprietário/gestor, auditada e entra em fila de reconciliação.
- Fidelidade manual usa `FOR UPDATE`, idempotência, ledger, auditoria e validação de recompensas.
- Favoritos da venda rápida são privados por operador; popularidade é calculada no servidor.
- Matriz por loja cobre venda, caixa, estoque, financeiro, clientes, pedidos, produção, relatórios e configurações.
- Mudanças de papel e capacidade geram auditoria; gerente não altera proprietário/gestor e o último proprietário ativo não pode ser removido.
- Valores públicos de pedidos e upgrade de recompensa são recalculados no banco.
- O ensaio vivo da matriz de permissões foi executado no Supabase de homologação com `ROLLBACK`, validando funções e isolamento entre lojas sem persistir dados temporários.
- O rate limit foi testado ao vivo em transação: duas solicitações permitidas, terceira bloqueada e tempo de nova tentativa retornado, com `ROLLBACK` ao final.

### Privacidade e direitos do cliente

- Solicitações de privacidade são classificadas em consulta, correção, exclusão/anonimização, consentimento ou outro assunto, com validação no BFF e no banco.
- A fila usa alvo operacional interno de 15 dias, prioriza solicitações vencidas e registra resolução, fechamento, notas e auditoria sem apresentar o alvo como prazo legal automático.
- Pedidos de acesso, correção, exclusão e consentimento exigem identidade confirmada antes da execução. A conferência registra estado, responsável, horário e auditoria sem armazenar documento ou código completo.
- Novas solicitações de privacidade iniciam automaticamente com identidade pendente; mensagens de outras categorias têm os campos de identidade limpos.
- Solicitações de consulta de dados geram pacote JSON versionado somente após identidade confirmada e vínculo explícito ao cadastro.
- O pacote de consulta inclui cadastro, consentimentos, preferências, fidelidade, pedidos e check-ins; notas internas, etiquetas, controles antifraude, segredos técnicos e dados de terceiros ficam fora.
- A preparação do pacote grava somente versão, horário, responsável e contagens na auditoria. O conteúdo completo não é persistido em logs ou eventos.
- A entrega do pacote por e-mail ou WhatsApp é registrada separadamente e resolve o protocolo de forma auditada.
- Correções de nome passam pela normalização oficial do backend e registram valor anterior, novo valor e protocolo na auditoria.
- Alterações de consentimento gravam novo evento. Quando marketing é revogado, WhatsApp, e-mail e preferências promocionais são desligados no backend, mesmo que o navegador envie canais marcados.
- O status genérico não pode resolver consulta sem entrega, correção/consentimento sem ação aplicada ou exclusão sem o procedimento protegido específico.
- A exclusão/anonimização é exclusiva do proprietário e exige identidade confirmada, cadastro vinculado, plano de impacto sem bloqueios, aceite explícito e digitação da confirmação devolvida pelo backend.
- A revisão visual da anonimização expira após cinco minutos; depois disso, a interface exige novo cálculo de impacto. A execução final continua recalculando bloqueios no backend, portanto o estado do navegador não autoriza a ação.
- O painel mostra todos os impactos previstos: contas de fidelidade, recompensas, pedidos, atendimentos e check-ins, além de todos os bloqueadores operacionais.
- O plano bloqueia anonimização de perfil da equipe, pedidos ou atendimentos em aberto e contas de fidelidade compartilhadas.
- A anonimização revoga sessões, passkeys, QR e Wallet; desativa conta e fidelidade; reverte recompensas disponíveis; remove CRM, check-ins e preferências; e anonimiza contatos em pedidos e serviços preservando registros financeiros e de auditoria.
- O procedimento não registra nome, telefone ou e-mail originais no evento final de auditoria.
- Cadastros sem e-mail são bloqueados para revisão manual, evitando associação ampla por contato vazio.
- As migrations de privacidade foram aplicadas somente no Supabase de homologação.
- Ensaios vivos com `ROLLBACK` validaram pacote e entrega, correção de nome, revogação de marketing, guardas de resolução e anonimização integral.
- Os ensaios encontraram e corrigiram diferenças reais do esquema: coluna inexistente em vínculo, variável ambígua no teste, e-mail gerado em `auth.identities` e imutabilidade do código de membro.

### Homologação e automação

- Gate de ambiente rejeita domínio/contexto de produção, projeto Supabase divergente e chave secreta no Vite.
- O gate exige origem canônica única para `SITE_URL`, BFF e passkeys, RP ID igual ao hostname e URL sem caminho ou parâmetros.
- `SUPABASE_SECRET_KEY`, `WHATSAPP_OTP_PEPPER` e `PUBLIC_RATE_LIMIT_PEPPER` são obrigatórios no cofre da Netlify; os peppers precisam ser distintos.
- O endpoint de readiness compara a origem real da requisição com `SITE_URL`, exige os segredos do núcleo e nunca devolve seus valores.
- Migrations desta reestruturação são aplicadas somente ao Supabase de homologação.
- Playwright cobre rotas reais em celular, tablet e computador, incluindo identidade, cadastro, login BFF, toque mínimo, overflow e ausência de módulos de demonstração.
- O `Portal quality gate` é o único workflow automático da branch e roda uma vez por `push` relevante; alterações somente de documentação são ignoradas e execuções anteriores são canceladas.
- O gate completo e o Playwright pesado exigem acionamento manual e o SHA exato do marco, evitando execuções redundantes em cada pequeno commit.
- Testes contratuais impedem reintroduzir os gatilhos duplicados `push` + `pull_request` nos workflows pesados.
- Build e diagnósticos são preservados como artefatos para inspeção quando os runners chegam às etapas.
- O deploy de homologação é manual, exige branch e commit exatos, confirmação textual e site Netlify diferente da produção.
- O workflow extrai a URL do deploy, valida que pertence ao projeto isolado e executa readiness e Playwright no deploy exato.
- Antes do deploy, um pré-flight independente gera relatórios JSON e Markdown redigidos com o estado do núcleo, infraestrutura, Meta e Wallet, listando apenas nomes de variáveis ausentes e nunca seus valores.
- O pré-flight é protegido por testes de não exposição, integra o gate integral e fica preservado como evidência do deploy de homologação.
- O workflow de ensaios vivos inclui matriz de permissões, rate limit, allowlist de RPCs e todos os fluxos de privacidade com rollback integral.
- O deploy de produção não possui endpoint remoto de restauração e exige gate temporário com aprovação expressa, SHA exato, backup, rollback e plano de smoke tests.

## Parcial — não considerar resolvido

- Passkeys precisam de ensaio em aparelhos reais e RP ID/origens definitivos da homologação.
- Meta WhatsApp Cloud API está implementada com adapter, webhook, OTP e painel, mas o envio real depende das credenciais e do template aprovados para homologação.
- Google Wallet está preparado no BFF e banco, porém a emissão real depende da conta de emissor e da chave de serviço.
- O preview público de homologação ainda deve receber variáveis e segredos exclusivos, ser publicado no alias fixo e passar pelo roteiro funcional completo.
- A proteção contra senhas vazadas deve ser habilitada no Supabase Auth de homologação quando a configuração estiver disponível.
- O novo gate automático ainda precisa de uma execução normal do runner; as tentativas anteriores encerraram antes de fornecer etapas ou logs utilizáveis.
- O painel de anonimização está integrado à operação e protegido por testes de contrato e da janela de revisão, mas ainda precisa de validação visual no preview publicado e teste touch real em tablet.

## Bloqueadores restantes para liberar a homologação ao usuário

1. Confirmar ou liberar a cota/orçamento do GitHub Actions para que o novo gate econômico consiga iniciar o runner.
2. Alinhar no Netlify e GitHub a origem canônica `https://homologacao-adoce--adoce-homologacao.netlify.app` para SITE_URL, BFF, passkeys, Wallet e variável do workflow.
3. Inserir diretamente no cofre da Netlify os segredos obrigatórios do núcleo, Meta e Wallet, sem enviá-los pelo chat ou GitHub.
4. Executar testes reais de passkey em Android, iPhone e Windows.
5. Publicar o preview isolado, confirmar que todas as Functions estão presentes e executar smoke tests externos.
6. Comparar novamente o preview com a produção atual sem migrar, publicar ou alterar produção.

## Evidências principais

- `netlify/functions/_shared/session-security.ts`
- `src/bff-origin-security.test.ts`
- `src/bff-session-security.test.ts`
- `scripts/audit-browser-security.mjs`
- `scripts/browser-security-audit-core.mjs`
- `scripts/homologation-environment-gate.mjs`
- `scripts/homologation-preflight-report.mjs`
- `scripts/homologation-preflight-report.test.mjs`
- `scripts/verify-security-build.mjs`
- `tests/e2e/public-mobile-smoke.e2e.mjs`
- `supabase/tests/permission_matrix_live.sql`
- `supabase/tests/public_endpoint_rate_limit_live.sql`
- `supabase/tests/authenticated_rpc_allowlist_live.sql`
- `supabase/tests/privacy_request_operation_live.sql`
- `supabase/tests/privacy_request_types_sla_live.sql`
- `supabase/tests/privacy_access_response_live.sql`
- `supabase/tests/privacy_correction_consent_live.sql`
- `supabase/tests/privacy_resolution_guard_live.sql`
- `supabase/tests/privacy_profile_anonymization_live.sql`
- `src/ci-workflow-efficiency.test.ts`
- `src/homologation-deploy-workflow.test.ts`
- `docs/ci-execution-strategy.md`
- Workflows `Portal quality gate`, `Verificar reestruturação`, `Playwright mobile e tablet`, `Diagnosticar disponibilidade do runner` e `Testar segurança viva na homologação`

## Produção

Nenhum merge, migration ou deploy de produção está autorizado. A publicação final exige aprovação expressa, commit exato, backup confirmado, plano de rollback e smoke tests.
