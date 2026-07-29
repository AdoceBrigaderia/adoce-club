# Auditoria de policies permissivas — homologação

## Objetivo

Classificar policies RLS permissivas duplicadas sem alterar dados, funções, grants, policies ou migrations. O resultado serve para separar duplicidades exatas de sobreposições que exigem revisão funcional antes de qualquer consolidação.

## Escopo e isolamento

- branch autorizada: `reestruturacao/ux-crm-operacao-imagens-v1`;
- projeto permitido: Supabase de homologação `vazozolhbehnriytzcdc`;
- projeto produtivo rejeitado: `uefwywizqhfvvijaopcn`;
- workflow exclusivamente manual;
- conexão obtida somente do secret `SUPABASE_HOMOLOGATION_DB_URL` no environment `homologation`;
- auditoria executada dentro de transação encerrada com `ROLLBACK`;
- nenhuma migration, policy, grant, função, dado ou deploy é alterado.

## Execução

Workflow: `Classificar policies permissivas somente na homologação`.

Entradas obrigatórias:

1. `expected_commit`: SHA completo do head autorizado da branch;
2. `confirmation`: `AUDITAR POLICIES SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc`.

O workflow valida branch, SHA, project ref, ausência da referência produtiva e caráter somente leitura do SQL antes de abrir a conexão.

## Saídas

O artefato `auditoria-policies-homologacao-<run>` preserva por 30 dias:

- `live-audit.csv`: resumo, grupos duplicados e detalhes das expressões;
- `live-audit.stderr.log`: diagnóstico do cliente PostgreSQL sem URL de conexão;
- `exit-code.txt`: resultado da execução;
- `commit.txt`: SHA auditado;
- `project-ref.txt`: referência da homologação;
- `audit-sql.sha256`: hash do SQL executado.

## Classificação

- `critical`: mais de uma policy permissiva de escrita para `anon` ou `public`;
- `high`: mais de uma policy permissiva de escrita para `authenticated`;
- `medium_exact_duplicate`: policies com mesma combinação de `USING` e `WITH CHECK`;
- `medium_overlap`: policies de leitura ou escrita com expressões diferentes no mesmo papel e comando.

A classificação não autoriza remoção automática. Policies permissivas são combinadas por `OR`; excluir uma policy sem comprovar equivalência pode reduzir ou ampliar acesso de forma incorreta.

## Próximo passo após a auditoria

1. revisar primeiro grupos `critical` e `high`;
2. associar cada policy às telas, BFFs, RPCs e perfis que dependem dela;
3. preparar migration idempotente por grupo funcional;
4. ensaiar a migration com `BEGIN` e `ROLLBACK` na homologação;
5. executar testes de owner, manager, attendant/cashier, production e viewer por loja;
6. aplicar somente na homologação após evidência de equivalência;
7. repetir a auditoria e confirmar redução das duplicidades sem ampliar acesso.

Produção permanece proibida sem aprovação expressa, backup, rollback e smoke tests.
