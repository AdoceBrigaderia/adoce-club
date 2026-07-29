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
- desempenho quantitativo por loja.

Ficam `null` e são apresentados como protegidos:

- bruto, taxas, líquido e ticket médio;
- formas de pagamento;
- diferenças de caixa;
- despesas, estornos, suprimentos e sangrias;
- valores pagos e estornos pendentes de encomendas.

Na lista por loja, cada unidade mantém seu próprio indicador `finance_authorized`; portanto, uma loja autorizada pode exibir valores sem abrir dados de outra unidade.

## Métricas globais

Clientes novos e movimentações de fidelidade não possuem `store_id` histórico confiável. Para evitar atribuição incorreta a uma unidade, essas métricas só aparecem para owner/manager na visão global, sem filtro de loja.

## Encomendas

O consolidado inclui quantidade por status, fila ativa, prontas, concluídas e canceladas. Valores recebidos e pendentes de estorno vêm de `service_requests.paid_amount` e `payment_status`, calculados e persistidos pelos RPCs transacionais do ciclo de encomendas.

## Aplicação e validação

Migration preparada:

`supabase/migrations/20260729223000_harden_operational_reports_by_store_and_finance.sql`

Antes de aplicar em homologação:

1. confirmar que as migrations do ciclo de encomendas já foram aplicadas na ordem;
2. confirmar o projeto Supabase de homologação;
3. executar backup lógico redigido;
4. aplicar somente na homologação;
5. testar owner, manager, viewer e uma atribuição sem `view_finance`;
6. verificar que valores protegidos chegam como `null`, nunca como zero falso;
7. executar o gate integral e smoke test mobile/tablet.

A migration não deve ser aplicada em produção sem aprovação expressa, backup, rollback preparado e smoke tests confirmados.
