# Ligar o login por WhatsApp — plano de hoje
**07/08/2026** · O que dá para fazer agora, sem esperar aprovação da Meta e sem chip novo.

---

## O que já existe

| Peça | Situação |
|---|---|
| Tabela `whatsapp_auth_challenges` com limite por telefone e por IP | ✅ |
| `server_create_whatsapp_auth_challenge` | ✅ |
| `server_mark_whatsapp_auth_sent` / `_failed` | ✅ |
| `server_update_whatsapp_auth_delivery` | ✅ |
| `server_verify_whatsapp_auth_challenge` | ✅ |
| Webhook que **recebe** status de entrega | ✅ `meta-whatsapp-webhook.ts` |
| **Função que ENVIA a mensagem** | ❌ **não existe — é o que falta** |
| Tela de login | ✅ `AdoceEntrar.tsx`, construída em 07/08 |

Faltam **uma função** e **as credenciais**.

---

## O atalho: número de teste da Meta

Ao adicionar o produto WhatsApp a um app, a Meta entrega de graça:

- um **número de teste** já ativo
- o **Phone Number ID**
- um **token temporário de 24 horas**

Limites: envia para no máximo **5 destinatários**, cada um verificado por código; o token vence em 24h. **Não serve para clientes reais** — serve para provar o fluxo hoje, em homologação.

Para produção, depois: número próprio (o chip novo) + token de usuário do sistema, sem expiração.

---

## Parte A — Rubens, ~10 minutos

**1.** Acesse `developers.facebook.com` → **Meus apps** → **Criar app**

**2.** Tipo: **Empresa**. Vincule ao portfólio **Adoce Brigaderia** (`1180557051818355`).

**3.** No painel do app → **Adicionar produto** → **WhatsApp** → **Configurar**.

**4.** Abre a tela **Introdução à API**. Anote de lá:
- **ID do número de telefone** (número de teste)
- **ID da conta do WhatsApp Business**
- **Token de acesso temporário** (botão Gerar)

**5.** Na mesma tela, seção **Para**, clique em **Gerenciar lista de números**. Adicione **o seu WhatsApp** e confirme com o código que chegar. Adicione também o da Beth.

**6.** No Netlify, projeto **adoce-homologacao** → Environment variables:

| Variável | Valor | Secreta |
|---|---|---|
| `META_WHATSAPP_PHONE_NUMBER_ID` | ID do número de teste | não |
| `META_WHATSAPP_TOKEN` | token temporário | **sim** |
| `META_WHATSAPP_GRAPH_VERSION` | `v23.0` | não |

⚠️ O token vence em 24h. Para testar amanhã, gere outro na mesma tela.

---

## Parte B — Codex

**Criar `netlify/functions/whatsapp-send-otp.ts`.** Fluxo:

1. Recebe `{ phone, purpose }` (purpose = `login`)
2. Normaliza para E.164 (`+55` + DDD + número)
3. Gera código de 6 dígitos e o hash (mesmo algoritmo usado em `server_verify_whatsapp_auth_challenge` — **confira a migração `20260726185348_whatsapp_cloud_otp.sql` antes de escolher o hash**)
4. Chama `server_create_whatsapp_auth_challenge` com `challenge_id` (uuid gerado), `raw_phone`, `requested_purpose`, `requested_code_hash`, `requested_idempotency_key`, `requested_ip_hash`, `requested_expires_at` (agora + 10 min)
5. Se a RPC recusar por limite, devolva a mensagem dela ao cliente, sem enviar nada
6. Envia pela Graph API:

```
POST https://graph.facebook.com/{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {META_WHATSAPP_TOKEN}
Content-Type: application/json

{ "messaging_product": "whatsapp",
  "to": "5585XXXXXXXXX",
  "type": "text",
  "text": { "body": "Seu código do Clube Adoce é 123456. Ele vale por 10 minutos 💗" } }
```

7. Sucesso → `server_mark_whatsapp_auth_sent(challenge_id, messages[0].id)`
8. Falha → `server_mark_whatsapp_auth_failed(challenge_id, code, title)` e devolva erro amigável

**Criar `netlify/functions/whatsapp-verify-otp.ts`:** recebe `{ challengeId, code }`, chama `server_verify_whatsapp_auth_challenge` e, se válido, cria a sessão do Supabase para aquele perfil.

**Ligar `src/AdoceEntrar.tsx`** nessas duas funções, no lugar de `requestPhoneCode` / `verifyPhoneCode` — **essas duas são código morto, nunca foram usadas em lugar nenhum do sistema.**

**Não invente hash nem formato.** A verificação já existe no banco; a função de envio precisa produzir exatamente o que ela espera.

**Não use template de mensagem.** Dentro da janela de 24h de conversa, mensagem de texto simples funciona. Template só é necessário para iniciar conversa fora da janela — e aí exige aprovação da Meta.

---

## Parte C — Teste

1. Abra `#entrar` em homologação
2. Nome e o seu WhatsApp (que você verificou no passo 5)
3. O código chega pelo WhatsApp do número de teste da Meta
4. Digite e entre
5. Confirme que caiu em `#clube` com os cartões

---

## Limites que continuam depois disso

🚫 **Só 5 números.** Cliente real não recebe até você ter número próprio.

🚫 **Token de 24h.** Para durar, precisa do token de usuário do sistema — Passo 5 do `GUIA-META-PASSO-A-PASSO.md`.

🚫 **Produção continua parada** enquanto as 93 migrações estiverem pausadas.

Mas ao fim disso o fluxo estará provado, e o que resta é trocar credencial — não construir.
