# Fronteira RPC/BFF das encomendas

## Objetivo

Impedir que o navegador consulte ou altere diretamente dados pessoais, configurações de produtos, pagamentos e snapshots financeiros das encomendas. A superfície controlada inclui:

- `service_requests`;
- `service_request_cake_builds`;
- `service_request_product_configurations`;
- `service_request_pricing_snapshots`.

As quatro tabelas permanecem com RLS habilitado, sem grants nem policies para `anon` e `authenticated`. O acesso ocorre por Functions same-origin e RPCs com autorização no backend.

## Escopo por loja e papel

`service_requests` possui `store_id` com FK para `stores`. A solicitação pública aceita uma unidade explícita ou resolve automaticamente somente quando existe exatamente uma loja ativa. Ambiguidade entre lojas falha de forma fechada.

A consulta operacional aplica simultaneamente:

1. membro ativo;
2. capacidade `manage_orders` ou `manage_production` na loja;
3. filtro opcional de unidade validado no backend;
4. teto `view_finance` antes de retornar qualquer valor;
5. redação de nome, telefone, e-mail, observações do cliente e dados financeiros para perfis apenas de produção.

Owner e manager preservam a visão administrativa. Atendimento opera orçamento, sinal, pagamento, conclusão e cancelamento. Produção opera somente início e prontidão. O histórico do CRM exige `manage_customers` na própria loja.

## Migrations preparadas

### Lockdown da superfície

`supabase/migrations/20260729202000_lock_service_request_tables_to_rpc.sql`

- adiciona e indexa `service_requests.store_id`;
- revoga privilégios diretos do navegador;
- remove policies antigas das quatro tabelas;
- preserva acesso interno controlado;
- valida RLS, grants, policies e FKs antes do `COMMIT`.

### Escopo obrigatório no commit

`supabase/migrations/20260729203000_harden_service_request_store_scope.sql`

- reprova histórico sem loja quando não existe backfill inequívoco;
- cria o trigger diferido `service_requests_store_scope_required`;
- impede o `COMMIT` com `store_id` nulo;
- bloqueia implementações internas sem escopo até para `service_role`.

### Workspace diretamente filtrado

`supabase/migrations/20260729212000_scope_service_request_workspace_by_store.sql`

- remove a assinatura pública antiga;
- elimina a varredura global anterior ao filtro;
- aplica capacidade e filtro de loja antes de busca, ordenação e limite;
- condiciona custos e margens a `view_finance`.

### Ciclo financeiro e operacional

`supabase/migrations/20260729221000_manage_service_request_lifecycle.sql`

O RPC `staff_transition_service_request` executa, com `FOR UPDATE`, advisory lock e chave idempotente:

- envio de orçamento;
- cálculo do sinal no backend;
- confirmação do sinal;
- confirmação auditada sem sinal;
- confirmação do pagamento final;
- conclusão da retirada;
- cancelamento;
- confirmação de estorno.

O total vem exclusivamente de `service_request_pricing_snapshots`. O navegador nunca informa total, valor pago ou valor do estorno. A fração de sinal aceita fica entre 5% e 100%, e o valor é calculado dentro da transação.

### Ações exclusivas de produção

`supabase/migrations/20260729221200_protect_service_request_production_actions.sql`

- cria o RPC separado `staff_transition_service_request_production`;
- permite apenas `start_production` e `mark_ready`;
- exige `manage_production` na loja;
- mantém bloqueio de linha, idempotência e auditoria;
- adiciona trigger que impede um RPC de atendimento de contornar o teto de produção.

### Workspace final com redação

`supabase/migrations/20260729221600_redact_service_request_production_workspace.sql`

- autoriza atendimento e produção apenas nas lojas atribuídas;
- retorna permissões efetivas por cartão;
- oculta PII do cliente para visão apenas de produção;
- oculta preço, sinal, pagamento, estorno e rentabilidade sem `view_finance`;
- mantém composição, quantidade, prazo e instruções internas necessárias à produção.

As migrations estão somente versionadas. Não foram aplicadas em homologação ou produção.

## UX operacional

A tela oferece busca, seletor grande de unidade e cartões com botões de ação imediata. Cada transição usa `crypto.randomUUID()` como chave idempotente e passa somente pelo BFF com cookie HttpOnly e CSRF.

Os atalhos são condicionados pelas permissões retornadas pelo backend:

- atendimento: orçamento, sinal, pagamento, conclusão, cancelamento e estorno;
- produção: iniciar produção e marcar pronta;
- financeiro: valores e forma de pagamento apenas com `view_finance`.

Em celular e tablet, controles e ações ficam em uma coluna, com altura mínima ampliada e sem formulário de venda completo.

## Auditoria determinística

```bash
npm run test:service-request-table-surface
npm run audit:service-request-table-surface
```

O manifesto `security/service-request-table-surface.json` schema v3 controla lockdown, escopo, ciclo financeiro, ciclo de produção, workspace redigido, SQL vivo e workflow.

Os contratos reprovam:

- retorno de valores calculados no navegador;
- perda de `FOR UPDATE`, advisory lock ou idempotência;
- perda das capacidades `manage_orders`, `manage_production` ou `view_finance`;
- remoção da redação de PII;
- reexposição por `anon`;
- execução automática ou mutável do workflow.

## Ensaio vivo de homologação

Workflow manual:

`Auditar fronteira RPC das encomendas na homologação`

Confirmação exigida:

```text
AUDITAR ENCOMENDAS RPC SOMENTE HOMOLOGACAO <project-ref-homologacao>
```

O workflow exige SHA exato, bloqueia a referência de produção, executa somente `supabase/tests/service_request_rpc_boundary_live.sql` e encerra com `ROLLBACK`. Os hashes das migrations do ciclo são preservados como artefatos redigidos.

## Critérios de aprovação

- quatro tabelas existentes, RLS ativo e nenhuma policy ou grant de navegador;
- `service_requests.store_id` UUID com FK para `stores` e nenhuma linha sem loja;
- três tabelas filhas vinculadas por `request_id`;
- workspace sem varredura global e com filtro de loja anterior ao limite;
- PII e valores redigidos conforme capacidades;
- RPC financeiro com preço do backend, lock, idempotência e auditoria;
- RPC de produção separado e trigger de teto por capacidade;
- conclusão bloqueada enquanto pagamento não estiver `paid`;
- cancelamento pago marcado como `refund_pending` até confirmação do estorno;
- implementações internas sem escopo não executáveis por `service_role`;
- nenhuma migration, deploy ou comando produtivo no workflow de auditoria.
