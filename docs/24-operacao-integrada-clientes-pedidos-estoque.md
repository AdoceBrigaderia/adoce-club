# Operação integrada: clientes, pedidos, estoque e WhatsApp

## Decisão operacional de 16/10/2026

O caixa separa a conclusão operacional da quitação financeira. Uma venda pode
ser entregue com pagamento parcial; somente o valor efetivamente recebido entra
no caixa e o restante permanece a receber. Os carimbos elegíveis são concedidos
na conclusão operacional, conforme decisão do proprietário, e eventual
cancelamento ou estorno usa lançamento compensatório auditável.

## Clientes

- O diretório operacional é paginado e aceita filtros combinados por nome,
  telefone, período de cadastro, carimbos, último carimbo e benefício disponível.
- Perfis inativos, mesclados ou excluídos não aparecem nos seletores ativos.
- A busca do caixa aceita nome, sobrenome, telefone completo e últimos dígitos.
- A edição preserva o identificador interno, pedidos, conta e histórico de
  fidelidade. Conflito de telefone é informado sem criar um segundo cadastro.
- Ao tentar cadastrar uma pessoa já existente, a ficha correspondente é aberta.

## Caixa, pagamentos e fidelidade

- Rascunhos mantêm uma chave estável, são restaurados após navegação e continuam
  validados contra a reserva mantida no servidor.
- Reservas abandonadas expiram em 30 minutos e uma rotina por minuto recalcula o
  estoque, sem deixar fatias presas indefinidamente.
- Desconto em folha exige um funcionário ativo e fica vinculado ao pedido e ao
  movimento financeiro.
- Recebimentos posteriores aceitam parcelas e meios diferentes, com chave de
  idempotência. A quitação ocorre quando o total recebido alcança o valor devido.
- A fatia gratuita é desconto de fidelidade, não pagamento, não gera carimbo e
  seu resgate é protegido contra repetição.

## Pedidos online e WhatsApp

- A ausência de comprovante não expira o pedido. Ao vencer a janela, somente a
  reserva física é liberada; o pedido e sua pendência financeira permanecem.
- Conversas e mensagens são paginadas em blocos, ordenadas por última atividade.
  Anexos são preparados apenas para a página aberta.
- A seleção múltipla arquiva logicamente conversas após confirmação; clientes,
  pedidos e movimentos financeiros não são apagados.
- Antes de começar um novo funil, inclusive na primeira mensagem, o bot verifica
  pedidos do mesmo telefone no dia e oferece falar sobre o existente ou iniciar
  uma nova compra legítima.

## Produção, estoque e compras

- Os cards de venda mostram estoque físico, reservado, livre e a quantidade do
  pedido atual sem dupla subtração.
- Saldos de lotes continuam disponíveis às 08:00 do dia seguinte, preservando a
  referência do lote físico de origem e com proteção contra execução duplicada.
- Os cards Avisos de fatias e Cardápio e atendimento foram retirados de Produção
  de hoje sem excluir dados ou funções compartilhadas.
- O planejamento de compras aplica 20% uma única vez sobre o consumo previsto,
  desconta o estoque aproveitável e exibe cada parcela do cálculo.

## Migrações e reversão

As migrações desta entrega são aditivas e versionadas:

- `20261016142700_cash_draft_cleanup_and_lot_continuity.sql`;
- `20261016142737_cash_partial_payroll_loyalty_audit.sql`;
- `20261016142747_online_orders_whatsapp_operations.sql`;
- `20261016142815_customer_directory_and_profile_edit.sql`.

Em rollback, primeiro deve-se reverter o aplicativo web. As rotinas agendadas
novas podem ser desativadas pelo nome no `pg_cron`; funções novas podem permanecer
sem chamadas, preservando auditoria e compatibilidade. Não se deve apagar
lançamentos financeiros, carimbos, conversas ou relações de continuidade já
gravadas. Qualquer reversão de movimento real usa uma operação compensatória.
