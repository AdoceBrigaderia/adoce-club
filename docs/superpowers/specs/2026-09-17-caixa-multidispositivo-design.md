# Caixa Adoce multidispositivo — especificação de design

## Objetivo

Entregar um caixa completo que funcione do mesmo modo em iPhone, tablet e computador, com sincronização por servidor, operação presencial e três origens de pedido: presencial, WhatsApp oficial e WhatsApp particular.

## Escopo aprovado

1. Caixa presencial compacto, sem exigir cliente.
2. Sabores em botões uniformes, sem foto no caixa, para comportar até 12 opções.
3. Campo editável de nome curto no cadastro de sabores.
4. Calda opcional por item, em controle compacto.
5. Quantidade editável por teclado numérico.
6. Desconto por valor ou percentual e item dupla com baixa de duas unidades.
7. Pagamento em dinheiro, cartão crédito/débito e Pix; troco destacado.
8. Impressão por fila, com reimpressão e estado de impressão pendente.
9. Barra superior responsiva em toda a Operação.
10. Tela única com os modos Presencial, WhatsApp oficial e WhatsApp particular.
11. Balão amarelo no modo WhatsApp oficial com o número de clientes pendentes, incluindo pedidos e solicitações de atendimento.
12. Histórico integral das conversas do WhatsApp oficial dentro do pedido.
13. Reserva de estoque imediatamente ao toque no sabor, com reversão ao cancelar ou remover a quantidade.
14. Pagamento dividido em qualquer quantidade de meios, sem bloquear valor parcial; o sistema mostra o saldo restante.
15. Cancelamento do pedido em andamento antes da finalização.
16. Após finalizar, oferecer pontuação do Clube para cliente cadastrado ou iniciar novo pedido.
17. Cupom térmico termina com QR Code para `https://www.adocebrigaderia.com.br/clube/entrar` e a frase: “Com 14 carimbos, ganhe 1 fatia de presente grátis — exceto pudim.”

## Decisões de produto

- Todos os dispositivos têm a mesma capacidade; o tablet não é um cliente limitado.
- O modo selecionado é salvo por aparelho/usuário para não interromper outro operador.
- Estoque é reservado/baixado apenas por RPC transacional usando a posição atual.
- Cada toque no sabor chama uma reserva idempotente no servidor; a interface só confirma o acréscimo quando a unidade foi reservada.
- Cancelar o rascunho libera todas as reservas feitas naquele pedido.
- Pagamentos parciais ficam registrados por meio, com saldo calculado no servidor até zerar.
- Venda finalizada não depende de impressão bem-sucedida; falha de impressora gera fila pendente e ação de reimpressão.
- WhatsApp particular nunca dispara mensagem automática para o cliente.
- WhatsApp oficial só envia mensagens compatíveis com o estado do pedido e mantém a conversa visível à equipe.

## Componentes e contratos

- `CashRegisterScreen`: catálogo compacto, carrinho, descontos, pagamento e finalização.
- `OrderChannelSwitch`: alternância persistida entre os três canais.
- `OfficialWhatsAppInboxBadge`: contagem em tempo real de conversas pendentes.
- `ShortFlavorNameEditor`: sugestão inicial editável no cadastro do sabor.
- `PrintQueueStatus`: estado, erro e reimpressão por pedido.
- RPCs Supabase novas ou estendidas devem validar papel, loja, estoque, idempotência e auditoria no servidor.

## Estados e erros

- estoque alterado por outro dispositivo: recalcular, informar os itens afetados e não concluir parcialmente;
- pagamento inferior ao total: manter o pedido aberto, mostrar o saldo restante e permitir adicionar Pix, cartão crédito/débito ou dinheiro até completar;
- pagamento misto: imprimir todos os meios, valores e saldo final no mesmo cupom;
- falha ao reservar no toque: não acrescentar a unidade e informar o estoque atualizado;
- cancelamento do rascunho: liberar reservas e registrar motivo/usuário;
- desconto acima do subtotal: bloquear ou exigir permissão de gestor;
- impressora offline: concluir venda, marcar pendente e permitir reimpressão;
- conversa sem janela/template aprovado: registrar no histórico e não enviar mensagem indevida;
- sessão expirada ou falta de conexão: preservar rascunho local sem confirmar venda.

## Validação obrigatória

- testes unitários e de RPC para estoque, desconto, dupla, troco, idempotência, permissões e impressão;
- teste visual em 390/402 px, tablet 1024 px e desktop 1440 px;
- teste com dois dispositivos concorrentes na última unidade;
- teste de fila de impressão com tablet online/offline;
- teste do badge com pedido e solicitação de atendimento;
- `npm run release:check` antes de qualquer publicação;
- publicação somente após revisão do resultado e confirmação explícita.

## Fora deste escopo

- mudança do provedor oficial do WhatsApp;
- envio de mensagens para clientes sem autorização e sem janela/template aprovado;
- exclusão de pedidos ou histórico existente;
- dependência exclusiva do tablet para funcionamento do caixa.
