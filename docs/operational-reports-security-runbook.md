# Relatórios operacionais por loja, filtros rápidos e permissão financeira

## Objetivo

Evitar que o painel de relatórios exponha valores, formas de pagamento ou diferenças de caixa para uma sessão que possui apenas `view_reports`. O relatório continua útil para acompanhamento operacional, mas a visualização financeira exige `view_finance` na mesma loja.

## Contrato de escopo

O RPC público é `staff_get_operational_reports(date,date,uuid,text,uuid,uuid)`. Os três últimos argumentos são opcionais e representam, nesta ordem:

- `target_channel`;
- `target_operator_user_id`;
- `target_register_id`.

A função monta primeiro a lista de lojas nas quais a sessão possui `view_reports`. Pedidos, sessões e movimentos de caixa, check-ins e encomendas são vinculados a essa lista antes de qualquer busca, soma, ordenação, limite ou opção de filtro.

Quando uma loja específica é solicitada, a autorização é validada no backend. Registros sem `store_id` não entram nos agregados por loja. A quantidade de pedidos históricos sem loja aparece apenas na visão global de owner/manager, sem valor financeiro.

## Filtros rápidos

Os filtros são aplicados no backend e afetam somente os quatro detalhamentos operacionais. O resumo geral, gráficos, produtos e demais consolidados permanecem no escopo completo do período e da loja selecionada.

O retorno declara explicitamente:

- `filter_scope = breakdowns_only`;
- `active_filters` com canal, operador e caixa efetivamente usados;
- `filter_options` calculadas somente sobre lojas autorizadas;
- os quatro conjuntos já filtrados.

Regras de segurança:

- canal aceita apenas `online` ou `presencial`;
- caixa e operador nunca ampliam o escopo de loja;
- opções de operador vêm somente de movimentos de venda autorizados no período;
- opções de caixa vêm somente de caixas ativos das lojas autorizadas;
- filtro presencial não cria acesso a vendas on-line;
- filtro on-line não retorna movimentos ou sessões de caixa;
- a implementação anterior permanece interna, sem grant para navegador ou `service_role`.

## Redação financeira

Os valores consolidados só são retornados quando `view_finance` cobre todas as lojas selecionadas. Isso impede que uma soma parcial pareça representar o total do período.

Sem cobertura financeira completa, permanecem disponíveis:

- quantidade de pedidos aprovados;
- quantidade de produtos;
- check-ins;
- sessões de caixa;
- quantidade e etapa das encomendas;
- desempenho quantitativo por loja;
- quantidade por canal, operador e caixa.

Ficam `null` e são apresentados como protegidos:

- bruto, taxas, líquido e ticket médio;
- formas de pagamento;
- diferenças de caixa;
- despesas, estornos, suprimentos e sangrias;
- valores pagos e estornos pendentes de encomendas;
- valores por canal, operador e caixa sem `view_finance` na unidade correspondente.

Na lista por loja, cada unidade mantém seu próprio indicador `finance_authorized`; portanto, uma loja autorizada pode exibir valores sem abrir dados de outra unidade.

## Detalhamentos operacionais

A cadeia de funções é:

1. `staff_get_operational_reports_base_internal(date,date,uuid)` — consolidados base;
2. `staff_get_operational_reports_breakdowns_internal(date,date,uuid)` — quatro detalhamentos sem filtro;
3. `staff_get_operational_reports(date,date,uuid,text,uuid,uuid)` — fronteira pública filtrada.

O wrapper público acrescenta ou substitui:

- `orders_by_channel`;
- `sales_by_cash_register`;
- `sales_by_operator`;
- `cash_sessions_by_register`;
- `filter_options`;
- `active_filters`;
- `filter_scope`.

## Interface mobile e tablet

Os quatro detalhamentos continuam dentro do mesmo painel. A leitura inicial não exige toque. A troca de recorte tem orçamento máximo de **um toque**:

- canal, operador e caixa aparecem como chips grandes;
- cada chip dispara uma única chamada BFF;
- não há acesso direto ao Supabase;
- não há modal, acordeão ou tela intermediária;
- o alvo mínimo é 48 px, 52 px em tablet/celular e 56 px em telas estreitas;
- os chips têm rolagem horizontal quando a quantidade excede a largura;
- o resumo geral não muda silenciosamente quando apenas o detalhamento é filtrado;
- valores `null` permanecem descritos como protegidos, nunca convertidos para `R$ 0,00`.

Arquivos envolvidos:

- `src/operational-report-breakdowns.ts` — normalização fail-closed de detalhamentos, período, filtros e opções;
- `src/OperationReportBreakdowns.tsx` — chips de um toque e consulta exclusiva pelo BFF;
- `src/operation-report-breakdown-filters.css` — alvos grandes e responsividade;
- `src/operation-report-breakdowns.test.ts` — contratos de BFF, loja, redação e orçamento de toques.

## Métricas globais

Clientes novos e movimentações de fidelidade não possuem `store_id` histórico confiável. Para evitar atribuição incorreta a uma unidade, essas métricas só aparecem para owner/manager na visão global, sem filtro de loja.

## Encomendas

O consolidado inclui quantidade por status, fila ativa, prontas, concluídas e canceladas. Valores recebidos e pendentes de estorno vêm de `service_requests.paid_amount` e `payment_status`, calculados e persistidos pelos RPCs transacionais do ciclo de encomendas.

## Manifesto e auditoria determinística

A fronteira é versionada em `security/operational-report-surface.json` com schema v2. O manifesto controla:

- assinatura pública e duas implementações internas;
- migrations base, detalhamentos e filtros;
- capacidades `view_reports` e `view_finance`;
- contratos de owner, manager e viewer;
- quatro detalhamentos obrigatórios;
- três filtros obrigatórios;
- escopo `breakdowns_only`;
- orçamento máximo de um toque;
- campos financeiros que devem permanecer redigidos.

Comandos locais:

```text
npm run test:operational-report-surface
npm run audit:operational-report-surface
```

Os dois comandos integram `verify:fast` e `verify` e bloqueiam drift no manifesto, perda de isolamento, grants das funções internas, remoção da redação financeira, perda de filtros backend ou automação indevida do ensaio vivo.

## Ensaio vivo de homologação

O workflow manual `Auditar relatórios operacionais na homologação` exige:

- branch autorizada e SHA exato;
- confirmação contendo o project ref de homologação;
- URL PostgreSQL pertencente exclusivamente ao projeto de homologação;
- dois proprietários ativos e uma loja ativa para o fixture transacional;
- execução de `supabase/tests/operational_reports_boundary_live.sql` com `BEGIN` e `ROLLBACK`.

O ensaio valida:

- viewer com quantidades operacionais e valores financeiros redigidos;
- bloqueio de acesso a loja sem atribuição;
- manager e owner com visão financeira na loja autorizada;
- presença dos quatro detalhamentos e das opções de filtro;
- aplicação de filtro por canal com `active_filters` coerente;
- ausência de execução direta das duas implementações internas;
- grants corretos da função pública filtrada;
- inexistência da assinatura pública antiga de três argumentos.

## Aplicação e validação

Migrations preparadas:

- `supabase/migrations/20260729223000_harden_operational_reports_by_store_and_finance.sql`;
- `supabase/migrations/20260729224500_add_operational_report_breakdowns.sql`;
- `supabase/migrations/20260729230000_filter_operational_report_breakdowns.sql`.

Antes de aplicar em homologação:

1. confirmar que as migrations anteriores do ciclo foram aplicadas na ordem;
2. confirmar o projeto Supabase de homologação;
3. executar backup lógico redigido;
4. aplicar somente na homologação;
5. executar o auditor determinístico;
6. testar owner, manager, viewer e uma atribuição sem `view_finance`;
7. verificar que valores protegidos chegam como `null`, nunca como zero falso;
8. validar canal, operador e caixa em lojas distintas;
9. executar o ensaio vivo com rollback;
10. executar o gate integral e smoke test mobile/tablet.

As migrations não devem ser aplicadas em produção sem aprovação expressa, backup, rollback preparado e smoke tests confirmados.
