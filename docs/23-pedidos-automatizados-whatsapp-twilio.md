---
title: Pedidos automatizados pelo WhatsApp com Twilio
description: Jornada conversacional, integraÃ§Ã£o com o estoque real, seguranÃ§a, idempotÃªncia, homologaÃ§Ã£o e operaÃ§Ã£o assistida.
status: Implementado localmente; migraÃ§Ã£o, homologaÃ§Ã£o externa e ativaÃ§Ã£o pendentes
---

# Pedidos automatizados pelo WhatsApp com Twilio

## Objetivo

Permitir que um cliente monte e registre um pedido de fatias pelo WhatsApp oficial da Adoce sem criar um segundo motor comercial. O canal conversacional usa o mesmo catÃ¡logo, estoque por fornada, caldas, formas de pagamento e RPC transacional do checkout pÃºblico.

O bot nÃ£o cobra, nÃ£o confirma disponibilidade fora da transaÃ§Ã£o e nÃ£o substitui a equipe. O cliente pode digitar `ATENDENTE`, `CANCELAR` ou `MENU` a qualquer momento.

## Jornada

1. A mensagem recebida abre a janela de atendimento do WhatsApp e inicia o menu.
2. O bot lista somente sabores com quantidade livre no dia.
3. O cliente informa itens no formato `1x2, 3x1`.
4. O bot coleta nome e sobrenome, calda, forma de pagamento, responsÃ¡vel pela retirada e horÃ¡rio.
5. Antes da confirmaÃ§Ã£o, o bot mostra itens, total estimado e retirada.
6. Ao receber `SIM`, o servidor consulta novamente a disponibilidade e chama `server_submit_whatsapp_order`, que delega para `submit_instant_order_v7`.
7. A transaÃ§Ã£o reserva estoque, aplica idempotÃªncia, grava o pedido e devolve o nÃºmero oficial.
8. A equipe continua com confirmaÃ§Ã£o e pagamento no fluxo operacional existente.

Na primeira versÃ£o, uma mesma opÃ§Ã£o de calda Ã© aplicada a todas as fatias. Escolhas diferentes por unidade continuam disponÃ­veis no checkout do site e podem ser evoluÃ­das no bot depois da homologaÃ§Ã£o da jornada simples.

## Endpoint e configuraÃ§Ã£o

Endpoint da Netlify Function:

```text
POST /api/twilio/whatsapp/order
```

VariÃ¡veis somente no servidor:

```env
WHATSAPP_ORDER_BOT_ENABLED=false
TWILIO_WHATSAPP_ORDER_WEBHOOK_URL=https://www.adocebrigaderia.com.br/api/twilio/whatsapp/order
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
AUTH_RATE_LIMIT_HMAC_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

No remetente WhatsApp da Twilio, o campo de mensagem recebida deve apontar por `HTTP POST` para a URL exata configurada em `TWILIO_WHATSAPP_ORDER_WEBHOOK_URL`. A flag permanece `false` atÃ© migraÃ§Ã£o e testes completos em homologaÃ§Ã£o.

## SeguranÃ§a e privacidade

- Toda chamada valida `X-Twilio-Signature` com a biblioteca oficial e o Auth Token.
- A URL usada na assinatura Ã© fixa e igual Ã URL cadastrada na Twilio, evitando divergÃªncia causada por rewrite.
- O destinatÃ¡rio `To` precisa corresponder ao remetente oficial configurado.
- `MessageSid` Ã© deduplicado antes de qualquer mudanÃ§a de estado.
- O telefone completo e o corpo recebido nÃ£o sÃ£o persistidos nem registrados em log.
- A conversa Ã© indexada por HMAC do telefone, guarda apenas os dados necessÃ¡rios ao carrinho e expira em 24 horas.
- Eventos de mensagem usados para deduplicaÃ§Ã£o expiram em sete dias.
- O limite inicial Ã© de 80 mensagens por telefone por hora.
- Tabelas de conversa ficam no schema `private`; somente funÃ§Ãµes `security definer` concedidas a `service_role` podem acessÃ¡-las.
- A resposta nÃ£o expÃµe estoque reservado por terceiros, notas internas, chaves ou erros brutos do banco.

## Janela de atendimento

Mensagens livres sÃ³ podem ser enviadas durante a janela de 24 horas iniciada ou renovada pela mensagem do cliente. Esta automaÃ§Ã£o responde ao webhook recebido, portanto opera dentro dessa janela. Mensagens iniciadas pela Adoce fora da janela exigem template aprovado e nÃ£o fazem parte desta entrega.

## HomologaÃ§Ã£o obrigatÃ³ria

1. Aplicar `20260830104000_whatsapp_order_bot_foundation.sql` no banco de homologaÃ§Ã£o.
2. Publicar a Function com `WHATSAPP_ORDER_BOT_ENABLED=false`.
3. Configurar a URL de mensagem recebida no remetente de homologaÃ§Ã£o ou em uma rota isolada.
4. Ativar a flag somente em homologaÃ§Ã£o.
5. Usar cliente e dados fictÃ­cios para testar menu, estoque insuficiente, nome, calda, pagamento, retirada, cancelamento, atendente e expiraÃ§Ã£o.
6. Reenviar o mesmo `MessageSid` e confirmar que nenhum passo ou pedido duplica.
7. Alterar o estoque entre resumo e `SIM`; o bot deve recusar sem reserva incorreta.
8. Testar assinatura ausente/invÃ¡lida, payload grande, excesso de mensagens e falha de banco.
9. Confirmar o pedido na Adoce OperaÃ§Ã£o e percorrer reserva, pagamento, preparo, pronto, retirada e cancelamento.
10. Executar `npm run release:check` e guardar evidÃªncia do WhatsApp real sem expor telefone completo ou conteÃºdo pessoal.

ProduÃ§Ã£o exige autorizaÃ§Ã£o explÃ­cita depois desse aceite. O rollback imediato Ã© definir `WHATSAPP_ORDER_BOT_ENABLED=false` e restaurar o webhook anterior; as tabelas privadas permanecem para auditoria atÃ© uma remoÃ§Ã£o autorizada.

## Estado desta entrega

- MÃ¡quina de conversa, assinatura Twilio, limite, deduplicaÃ§Ã£o e integraÃ§Ã£o transacional: implementados localmente.
- MigraÃ§Ã£o remota: nÃ£o aplicada.
- Webhook externo da Twilio: nÃ£o alterado.
- HomologaÃ§Ã£o com WhatsApp real: pendente.
- ProduÃ§Ã£o: nÃ£o publicada nem ativada por este capÃ­tulo.
