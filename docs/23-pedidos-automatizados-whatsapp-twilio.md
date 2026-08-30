---
title: Pedidos automatizados pelo WhatsApp com Twilio
description: Jornada numérica, integração com estoque real, segurança, idempotência e operação assistida.
status: Implementado na integração; configuração externa ativa e publicação pendente de validação
---

# Pedidos automatizados pelo WhatsApp com Twilio

## Objetivo

Permitir que o cliente monte e registre um pedido de fatias pelo WhatsApp oficial da Adoce usando números para todas as escolhas. O canal usa o mesmo catálogo, estoque por fornada, caldas, formas de pagamento e RPC transacional do checkout público.

## Jornada numérica

1. A primeira mensagem apresenta `1. Ver cardápio e fazer pedido` e `2. Falar com a equipe da Adoce`.
2. O cliente escolhe o sabor pelo número.
3. O bot pergunta a quantidade e apresenta quantidades numeradas.
4. O cliente pode adicionar outro sabor ou concluir a seleção também por número.
5. Nome e sobrenome são o único dado textual livre, pois identificam a pessoa e não representam uma escolha.
6. Calda, pagamento, responsável pela retirada e horário são apresentados como opções numeradas.
7. O resumo oferece `1. Registrar pedido`, `2. Escolher outro horário` e `3. Cancelar pedido`.
8. Antes de registrar, o servidor confere novamente o estoque e chama `server_submit_whatsapp_order`, que delega para `submit_instant_order_v7`.
9. Ao concluir, o bot oferece por número fazer outro pedido ou falar com a equipe.

Os comandos antigos `MENU`, `SIM`, `CANCELAR` e `ATENDENTE` permanecem aceitos somente por compatibilidade; nenhuma mensagem exige que o cliente digite essas palavras.

## Endpoint e configuração

O webhook recebe `POST /api/twilio/whatsapp/order`. As credenciais Twilio, a URL oficial, a flag do bot, o segredo HMAC e as chaves Supabase permanecem somente nas variáveis protegidas da Netlify. O Send SMS Hook de recuperação de senha continua separado do bot de pedidos e usa o mesmo remetente Twilio aprovado.

## Segurança

- validação de `X-Twilio-Signature` com a biblioteca oficial;
- destinatário restrito ao remetente configurado;
- deduplicação por `MessageSid`;
- telefone indexado por HMAC e nunca gravado em claro no estado da conversa;
- limite de 80 mensagens por telefone a cada hora;
- conversa expirada em 24 horas;
- tabelas privadas acessíveis somente pelas funções concedidas a `service_role`;
- nova conferência de estoque imediatamente antes da criação transacional do pedido.

## Rollback

O rollback imediato do canal é definir `WHATSAPP_ORDER_BOT_ENABLED=false`. O rollback da publicação do site usa o deploy Netlify anterior registrado no procedimento de lançamento. Nenhum rollback remove tabelas privadas ou histórico sem autorização específica.
