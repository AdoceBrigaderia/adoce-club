# Fronteira RPC-only dos pedidos imediatos

## Objetivo

Impedir que o navegador leia ou altere diretamente `instant_orders` e `instant_order_items`. A criação, consulta operacional, mudança de situação, cálculo financeiro, reserva de estoque e vinculação ao caixa devem ocorrer exclusivamente pelas RPCs autorizadas e pelo BFF same-origin.

## Motivo do bloqueio

A migration histórica `20260722172238_instant_orders_and_pickup.sql` concedia DML a `authenticated` e criava policies amplas baseadas apenas em `private.is_staff()`. Depois da adoção de lojas, capacidades, BFF, idempotência e cálculo financeiro no backend, essa superfície permitiria contornar:

- isolamento e vínculo por loja;
- matriz owner/manager/attendant/cashier/production/viewer;
- validações transacionais de estoque e caixa;
- cálculo de preços e valores no backend;
- idempotência e auditoria das operações;
- proteção CSRF e cookies HttpOnly do BFF.

## Contrato versionado

O manifesto `security/order-table-surface.json` classifica:

- `instant_orders`: RPC-only, com `store_id` definido pela evolução da estrutura operacional;
- `instant_order_items`: RPC-only, herdando o escopo da loja pelo `order_id` que referencia `instant_orders`.

A migration `20260729194500_lock_instant_order_tables_to_rpc.sql`:

1. mantém RLS habilitado;
2. revoga todos os privilégios de `public`, `anon` e `authenticated`;
3. remove as policies históricas de acesso amplo da equipe;
4. mantém acesso do `service_role` para o BFF e funções controladas;
5. falha antes do commit se detectar privilégio, policy, perda de `store_id` ou perda da FK dos itens.

## Validação local

```bash
npm run test:order-table-surface
npm run audit:order-table-surface
```

Os comandos também integram `verify:fast` e `verify`.

## Ensaio vivo na homologação

Use apenas o workflow manual `Auditar fronteira RPC dos pedidos na homologação`.

Pré-requisitos do environment `homologation`:

- variable `ADOCE_HOMOLOGATION_SUPABASE_REF`;
- variable `ADOCE_PRODUCTION_SUPABASE_REF`;
- secret `SUPABASE_HOMOLOGATION_DB_URL`.

Entradas obrigatórias:

- SHA completo da branch `reestruturacao/ux-crm-operacao-imagens-v1`;
- confirmação `AUDITAR PEDIDOS RPC SOMENTE HOMOLOGACAO <project-ref-homologacao>`.

O workflow executa somente auditoria com `BEGIN` e `ROLLBACK`. Ele não aplica migrations, não executa `db push`, não publica Netlify e rejeita qualquer referência de produção.

## Aplicação da migration

A migration permanece apenas versionada até que o gate de migrations da homologação esteja aprovado. Quando autorizada:

1. confirmar backup lógico da homologação;
2. validar o SHA e o project ref de homologação;
3. aplicar somente pelo fluxo controlado de migrations pendentes;
4. executar o ensaio vivo deste runbook;
5. repetir os testes operacionais de venda rápida, pedido público, estoque, caixa e consulta da fila;
6. preservar evidências e plano de rollback.

## Critérios de bloqueio

Não liberar homologação navegável quando houver:

- qualquer privilégio direto de `anon` ou `authenticated` nas duas tabelas;
- qualquer policy destinada a `public`, `anon` ou `authenticated`;
- RLS desabilitado;
- ausência de `instant_orders.store_id`;
- ausência da FK `instant_order_items.order_id -> instant_orders.id`;
- RPC de pedido fora do allowlist versionado;
- cálculo financeiro realizado pelo navegador;
- workflow automático, mutável ou com referência de produção.

Produção permanece proibida sem aprovação expressa, backup, rollback e smoke tests.
