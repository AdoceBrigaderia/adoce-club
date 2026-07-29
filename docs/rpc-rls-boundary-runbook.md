# Superfície RPC e fronteira RLS por loja — homologação

Este roteiro consolida a validação da superfície autenticada do Portal Adoce e do isolamento das tabelas operacionais por loja. Ele não autoriza deploy, merge ou qualquer ação em produção.

## Estado esperado

A interface web não escolhe livremente funções do banco. As operações genéricas passam pelas allowlists de `auth-bff-rpc` e `auth-bff-client-rpc`; integrações dedicadas, como cadastro, Wallet e uploads, permanecem em Functions específicas. Todas usam o JWT da sessão correspondente ou uma fronteira server-side explicitamente isolada.

As versões transacionais atuais são:

- `staff_create_manual_sale_in_cash_v2`;
- `staff_record_cash_movement_v2`;
- `submit_instant_order_v6`.

As versões substituídas sem sufixo ou `v5` devem permanecer sem `EXECUTE` para `public`, `anon` e `authenticated`. A migration `20260729120500_lock_superseded_rpc_versions.sql` faz esse corte e falha se as versões atuais não estiverem disponíveis como `SECURITY DEFINER` para `authenticated`.

## Manifesto versionado de RPCs

`security/rpc-surface.json` é o inventário controlado da superfície RPC. Ele separa:

- RPCs genéricas da operação;
- RPCs genéricas do cliente;
- integrações autenticadas dedicadas;
- funções públicas que também aceitam uma sessão autenticada;
- superfície anônima mínima;
- pares de versões transacionais substituídas e atuais.

O comando `npm run audit:rpc-surface` compara o manifesto com `bff-rpc-policy.ts`, com o ensaio SQL vivo e com a migration de bloqueio das versões antigas. O comando falha quando há duplicidade, RPC inesperada, função ausente, exposição anônima adicional, versão antiga ativa ou perda do contrato fail-closed. Os testes de mutação são executados por `npm run test:rpc-surface`, e ambos fazem parte de `verify:fast` e `verify`.

Alterações na superfície devem atualizar no mesmo marco o manifesto, o roteamento BFF, o ensaio SQL, a migration correspondente quando houver troca de versão e os testes. Não liberar uma RPC diretamente apenas para corrigir uma tela.

## Allowlist autenticada

O arquivo `supabase/tests/authenticated_rpc_allowlist_live.sql` trata a lista controlada como exata:

- qualquer `SECURITY DEFINER` executável por `authenticated` fora da lista bloqueia o ensaio;
- qualquer entrada esperada ausente bloqueia o ensaio;
- não há tolerância entre versões antigas e atuais;
- a superfície anônima aceita somente os catálogos públicos expressamente listados;
- o teste começa com `BEGIN` e termina com `ROLLBACK`.

A allowlist cobre as RPCs genéricas do BFF e as RPCs autenticadas chamadas por endpoints dedicados, incluindo cadastro, Google Wallet e gestão de imagens.

## Manifesto versionado da fronteira RLS

`security/store-rls-surface.json` é a fonte controlada das tabelas por loja, do modo de acesso permitido e dos predicados obrigatórios de leitura. O schema v2 separa:

- `authenticated_read`: leitura direta autenticada somente com RLS e predicados de loja/identidade;
- `rpc_only`: nenhum privilégio ou policy para o navegador; toda leitura e mutação passa por RPC/Function autorizada.

O manifesto está ligado a:

- `supabase/tests/store_rls_boundary_live.sql`;
- `supabase/migrations/20260729155500_lock_store_scoped_table_writes.sql`;
- `.github/workflows/store-rls-boundary-live-homologation.yml`;
- migrations de definição das tabelas marcadas como `rpc_only`.

`npm run audit:store-rls-surface` reprova drift entre os arquivos, perda de tabela, alteração indevida do modo de acesso, remoção de predicado, enfraquecimento do lockdown, criação de policy em tabela RPC-only, execução automática do ensaio vivo ou inclusão de comandos que alterem banco ou publiquem a aplicação. `npm run test:store-rls-surface` executa mutações controladas para confirmar que o auditor falha fechado. Ambos integram `verify:fast` e `verify`.

## Fronteira RLS por loja

### Leitura autenticada com isolamento

O ensaio vivo exige `SELECT` para `authenticated`, policy de leitura e predicados restritivos nas tabelas:

- `stores`;
- `cash_registers`;
- `staff_store_assignments`;
- `cash_sessions`;
- `cash_movements`.

### Acesso exclusivamente por RPC

O navegador não pode possuir `SELECT`, escrita ou qualquer policy nas tabelas:

- `customer_checkins`;
- `cash_reconciliation_queue`.

As migrations de definição dessas tabelas também são verificadas pelo auditor determinístico. Elas devem criar a coluna obrigatória `store_id`, habilitar RLS e revogar o acesso direto do navegador.

### Bloqueios do ensaio

O ensaio bloqueia quando:

- alguma tabela não existe ou está sem RLS;
- `anon` possui privilégio direto de leitura ou escrita;
- `authenticated` possui `INSERT`, `UPDATE`, `DELETE` ou `TRUNCATE` direto;
- uma tabela `authenticated_read` perdeu o grant de `SELECT`;
- existe policy para `anon` ou `public`;
- permanece policy de escrita ou `ALL` para `authenticated`;
- falta policy de leitura em uma tabela `authenticated_read`;
- a policy deixa de usar `private.can_access_store`, ou a atribuição de equipe deixa de restringir por gestor/usuário atual;
- uma policy de leitura fica vazia ou assume forma tautológica conhecida, como `true` ou `OR true`;
- uma tabela `rpc_only` expõe qualquer privilégio ou policy para `anon`, `authenticated` ou `public`.

A migration `20260729155500_lock_store_scoped_table_writes.sql` revoga escrita direta dos papéis do navegador, remove as policies legadas de administração e aplica revogação total nas tabelas RPC-only. A própria migration valida privilégios e policies antes do `COMMIT`. As alterações administrativas continuam nas RPCs `SECURITY DEFINER`, que aplicam autorização, capacidade, idempotência e auditoria no backend.

A migration foi apenas versionada neste marco. Ela ainda precisa passar pelo gate de migrations e ser aplicada exclusivamente na homologação antes do ensaio vivo.

## Execução isolada

### Auditoria local determinística

Executar antes do ensaio vivo:

```bash
npm run test:rpc-surface
npm run audit:rpc-surface
npm run test:store-rls-surface
npm run audit:store-rls-surface
```

Esses comandos não acessam banco, não leem segredos e não aplicam migrations. Eles validam somente os arquivos versionados.

### Allowlist e matriz integrada

O workflow **Testar segurança viva na homologação** executa `authenticated_rpc_allowlist_live.sql` junto aos demais ensaios de segurança. Ele exige:

- branch `reestruturacao/ux-crm-operacao-imagens-v1`;
- SHA completo autorizado;
- confirmação exata `TESTAR SOMENTE HOMOLOGACAO`;
- URL PostgreSQL pertencente ao projeto de homologação e diferente de produção.

### Fronteira RLS

O workflow **Auditar fronteira RLS por loja na homologação** exige:

- SHA completo do topo da branch;
- confirmação `AUDITAR RLS SOMENTE HOMOLOGACAO <project-ref-homologacao>`;
- `ADOCE_HOMOLOGATION_SUPABASE_REF` e `ADOCE_PRODUCTION_SUPABASE_REF` diferentes;
- secret `SUPABASE_HOMOLOGATION_DB_URL` contendo apenas a conexão de homologação.

O job executa somente o SQL de auditoria, confirma o `ROLLBACK` e preserva artefato redigido por 30 dias. Ele não aplica migration, não executa `db push` e não publica Netlify.

## Critérios de bloqueio

Tratar como bloqueador de homologação:

- drift entre manifesto, BFF e ensaio SQL;
- drift entre manifesto RLS, migrations, ensaio vivo e workflow;
- RPC inesperada exposta a `anon` ou `authenticated`;
- versão antiga ainda executável pelo navegador;
- versão atual ausente ou fora de `SECURITY DEFINER`;
- escrita direta em tabela operacional por `authenticated`;
- policy anônima ou policy autenticada de escrita nas tabelas por loja;
- ausência de isolamento por loja ou por identidade;
- policy de leitura vazia ou tautológica;
- privilégio ou policy do navegador em tabela `rpc_only`;
- ensaio sem `ROLLBACK` confirmado.

## Produção

Nenhuma migration deste marco foi aplicada por este roteiro. Produção permanece proibida sem aprovação expressa, backup confirmado, plano de rollback e smoke tests no commit exato.
