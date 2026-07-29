# Fronteira RPC/BFF das encomendas

## Objetivo

Impedir que o navegador consulte ou altere diretamente dados pessoais, configurações de produtos e snapshots financeiros das encomendas. A superfície controlada inclui:

- `service_requests`;
- `service_request_cake_builds`;
- `service_request_product_configurations`;
- `service_request_pricing_snapshots`.

As quatro tabelas permanecem com RLS habilitado, sem grants nem policies para `anon` e `authenticated`. O acesso ocorre por Functions same-origin e RPCs com autorização no backend.

## Escopo por loja

`service_requests` recebe `store_id` com FK para `stores`. A solicitação pública aceita uma unidade explícita ou resolve automaticamente somente quando existe exatamente uma loja ativa. Ambiguidade entre lojas falha de forma fechada.

A consulta operacional aplica simultaneamente:

1. membro ativo;
2. teto da função para `manage_orders`;
3. capacidade `can_manage_orders` na atribuição da loja;
4. filtro opcional de unidade validado no backend.

Owner e manager preservam a visão administrativa. O histórico do CRM exige `manage_customers` na própria loja da encomenda para perfis não gerenciais.

## Migrations preparadas

### Lockdown da superfície

`supabase/migrations/20260729202000_lock_service_request_tables_to_rpc.sql`

A migration:

- adiciona e indexa `service_requests.store_id`;
- faz backfill apenas quando existe uma única loja ativa e registra a quantidade ajustada;
- revoga todos os privilégios diretos do navegador;
- remove policies antigas das quatro tabelas;
- preserva acesso das tabelas pelo `service_role` para os wrappers controlados;
- substitui os RPCs de envio, workspace e histórico por assinaturas filtradas por loja;
- valida RLS, grants, policies, FK da loja e FKs das tabelas filhas antes do `COMMIT`.

### Escopo obrigatório no commit

`supabase/migrations/20260729203000_harden_service_request_store_scope.sql`

O hardening complementar:

- reprova a aplicação quando existem encomendas históricas sem loja e não há exatamente uma loja ativa para um backfill inequívoco;
- cria o constraint trigger diferido `service_requests_store_scope_required`;
- permite que o wrapper crie e vincule a encomenda na mesma transação, mas impede o `COMMIT` enquanto `store_id` permanecer nulo;
- remove do `service_role` a execução direta das implementações internas sem escopo;
- valida no pós-gate a ausência de registros sem loja, o caráter diferido do trigger e o bloqueio dos RPCs internos.

Quando houver mais de uma loja ativa e registros antigos sem `store_id`, o operador deve mapear explicitamente cada encomenda para a unidade correta antes de aplicar o hardening. Não existe escolha automática arbitrária.

As duas migrations estão apenas versionadas. Não devem ser aplicadas em produção. A aplicação em homologação depende do gate de migrations, backup confirmado e projeto de homologação validado.

## Auditoria determinística

```bash
npm run test:service-request-table-surface
npm run audit:service-request-table-surface
```

O manifesto `security/service-request-table-surface.json` impede drift entre migrations de definição, lockdown, hardening, SQL vivo e workflow. O teste `src/service-request-store-scope-hardening-migration.test.ts` protege o vínculo do hardening ao manifesto, o trigger diferido e os revokes das implementações internas.

## Ensaio vivo de homologação

Workflow manual:

`Auditar fronteira RPC das encomendas na homologação`

Confirmação exigida:

```text
AUDITAR ENCOMENDAS RPC SOMENTE HOMOLOGACAO <project-ref-homologacao>
```

O workflow exige SHA exato, bloqueia a referência de produção, executa somente o SQL `supabase/tests/service_request_rpc_boundary_live.sql` e encerra com `ROLLBACK`.

Antes de aplicar as migrations em homologação, executar uma consulta específica para contar encomendas sem `store_id`. Resultado diferente de zero exige confirmar se existe uma única loja ativa ou preparar o mapeamento explícito.

## Critérios de aprovação

- quatro tabelas existentes e com RLS ativo;
- nenhum privilégio efetivo de `anon` ou `authenticated`;
- nenhuma policy de navegador;
- `service_requests.store_id` UUID com FK para `stores`;
- nenhuma encomenda persistida sem loja;
- constraint trigger de escopo realmente `DEFERRABLE INITIALLY DEFERRED`;
- três tabelas filhas ligadas por `request_id` a `service_requests`;
- assinatura pública com `requested_store_id`;
- workspace operacional com `requested_store_id` e capacidade por loja;
- histórico CRM com `manage_customers` validado na loja;
- implementações internas sem escopo não executáveis pelo `service_role`;
- nenhuma migration, deploy ou comando produtivo no workflow de auditoria.
