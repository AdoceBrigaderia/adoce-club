# Relatórios operacionais por loja e permissão financeira

## Objetivo

Evitar que o painel de relatórios exponha valores, formas de pagamento ou diferenças de caixa para uma sessão que possui apenas `view_reports`. O relatório continua útil para acompanhamento operacional, mas a visualização financeira exige `view_finance` na mesma loja.

## Contrato de escopo

O RPC `staff_get_operational_reports(date,date,uuid)` monta primeiro a lista de lojas nas quais a sessão possui `view_reports`. Pedidos, sessões e movimentos de caixa, check-ins e encomendas são vinculados a essa lista antes de qualquer busca, soma, ordenação ou limite.

Quando uma loja específica é solicitada, a autorização é validada no backend. Registros sem `store_id` não entram nos agregados por loja. A quantidade de pedidos históricos sem loja aparece apenas na visão global de owner/manager, sem valor financeiro.

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

A migration complementar preserva a função anterior como implementação interna sem grant para navegador ou `service_role` e publica um wrapper com a mesma assinatura. O wrapper acrescenta quatro conjuntos:

- `orders_by_channel`: separa pedidos on-line e presenciais;
- `sales_by_cash_register`: consolida pedidos por loja e caixa físico;
- `sales_by_operator`: atribui vendas presenciais ao usuário que registrou o movimento de caixa;
- `cash_sessions_by_register`: apresenta aberturas, fechamentos e divergências por caixa.

As quantidades continuam visíveis para sessões com `view_reports`. Valores permanecem condicionados a `view_finance`, sem soma parcial apresentada como total completo.

## Métricas globais

Clientes novos e movimentações de fidelidade não possuem `store_id` histórico confiável. Para evitar atribuição incorreta a uma unidade, essas métricas só aparecem para owner/manager na visão global, sem filtro de loja.

## Encomendas

O consolidado inclui quantidade por status, fila ativa, prontas, concluídas e canceladas. Valores recebidos e pendentes de estorno vêm de `service_requests.paid_amount` e `payment_status`, calculados e persistidos pelos RPCs transacionais do ciclo de encomendas.

## Manifesto e auditoria determinística

A fronteira é versionada em `security/operational-report-surface.json`. O manifesto controla:

- assinatura pública e implementação interna;
- migrations base e complementar;
- capacidades `view_reports` e `view_finance`;
- contratos de owner, manager e viewer;
- quatro detalhamentos obrigatórios;
- campos financeiros que devem permanecer redigidos.

Comandos locais:

```text
npm run test:operational-report-surface
npm run audit:operational-report-surface
```

Os dois comandos integram `verify:fast` e `verify` e bloqueiam drift no manifesto, perda de isolamento, grants da função interna, remoção da redação financeira ou automação indevida do ensaio vivo.

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
- presença dos quatro detalhamentos;
- ausência de execução direta da implementação interna;
- grants corretos da função pública.

## Aplicação e validação

Migrations preparadas:

- `supabase/migrations/20260729223000_harden_operational_reports_by_store_and_finance.sql`;
- `supabase/migrations/20260729224500_add_operational_report_breakdowns.sql`.

Antes de aplicar em homologação:

1. confirmar que as migrations do ciclo de encomendas já foram aplicadas na ordem;
2. confirmar o projeto Supabase de homologação;
3. executar backup lógico redigido;
4. aplicar somente na homologação;
5. executar o auditor determinístico;
6. testar owner, manager, viewer e uma atribuição sem `view_finance`;
7. verificar que valores protegidos chegam como `null`, nunca como zero falso;
8. executar o ensaio vivo com rollback;
9. executar o gate integral e smoke test mobile/tablet.

As migrations não devem ser aplicadas em produção sem aprovação expressa, backup, rollback preparado e smoke tests confirmados.
