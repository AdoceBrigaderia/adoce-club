# Ligar o Mercado Pago à Adoce
**Guia passo a passo para o Rubens** · 07/08/2026

Regra que guia tudo: **o cliente só paga depois que a Adoce confirma que separou.** O sistema nunca cobra antes.

---

## 0. O que já existe e o que não existe

| Item | Situação |
|---|---|
| Tabela de formas de pagamento (Pix, crédito, débito, dinheiro) | ✅ existe — mas é só um rótulo que o cliente escolhe |
| Cobrança de verdade | ❌ não existe |
| Campo de link no Pede Junto | ⚠️ existe, mas você cola o link **à mão**, participante por participante |
| Frase "a cobrança só acontece depois da confirmação" no site | ✅ já está escrita |

Ou seja: a promessa já está no ar, falta o motor.

---

## 1. As taxas, aplicadas ao seu negócio

| Forma | Taxa | Quando cai | Numa fatia de R$ 16 | Numa encomenda de R$ 350 |
|---|---|---|---|---|
| **Pix** | 0,99% | na hora | R$ 0,16 | R$ 3,47 |
| Link — na hora (D0) | 4,98% | na hora | R$ 0,80 | R$ 17,43 |
| Link — 14 dias | 3,79% | D+14 | R$ 0,61 | R$ 13,27 |
| Link — 30 dias | 3,03% | D+30 | R$ 0,48 | R$ 10,61 |

**Recomendação: comece só com Pix.**

Para fatia de R$ 16, Pix é **5 vezes mais barato** que cartão e cai na hora. Seu cliente é local, compra valor baixo e já usa Pix. Cartão faz sentido depois, para encomendas — onde o ticket é alto e a pessoa pode querer parcelar. Aí vale escolher D14 ou D30 conforme o seu caixa.

---

## 2. O que só você pode fazer

### Passo 1 — Conta Mercado Pago da empresa

1. Acesse `mercadopago.com.br` e entre (ou crie conta).
2. A conta precisa estar no **CNPJ da Adoce**, não em CPF. Se hoje for CPF, dá para converter em Configurações → Dados da conta.
3. Complete a verificação de identidade da empresa. Sem isso, os limites de recebimento são baixos.
4. Cadastre a **chave Pix** e a conta bancária que recebe.

⚠️ Enquanto a conta não estiver verificada, o dinheiro fica retido. Faça isso primeiro.

### Passo 2 — Credenciais de integração

1. Vá em `mercadopago.com.br/developers` → **Suas integrações** → **Criar aplicação**
2. Nome: `Site Adoce Brigaderia` · Produto: **Checkout Transparente / Pagamentos online**
3. Na aplicação criada, abra **Credenciais de produção**. Você vai ver:
   - **Public Key** — pode aparecer no navegador, não é segredo
   - **Access Token** — **é senha da sua empresa**
4. Existe também um par de **credenciais de teste**. Vamos usar as de teste em homologação e as de produção só no fim.

⚠️ **O Access Token nunca deve ser colado em chat, e-mail ou documento.** Você cola direto no Netlify. Eu não preciso vê-lo em momento nenhum.

### Passo 3 — Colar no Netlify

Em `app.netlify.com` → projeto **adoce-homologacao** → Site configuration → Environment variables:

| Variável | Valor | Escopo |
|---|---|---|
| `MP_ACCESS_TOKEN` | Access Token de **teste** | Functions |
| `VITE_MP_PUBLIC_KEY` | Public Key de **teste** | Builds |
| `MP_WEBHOOK_SECRET` | uma senha longa que você inventa — anote | Functions |

Depois de tudo validado, repetimos no projeto **adocebrigaderia** com as credenciais de produção.

### Passo 4 — Decisões suas

- [ ] Só Pix, ou Pix + cartão? (recomendo começar só Pix)
- [ ] Se for cartão: D0, D14 ou D30?
- [ ] Quanto tempo o link fica válido antes de expirar? (sugiro 2h para fatia, 24h para encomenda)
- [ ] Se o cliente não pagar no prazo, a reserva volta ao estoque automaticamente?

---

## 3. O que eu faço

1. **Tabela de pagamentos** — cada cobrança com valor, status, referência do Mercado Pago e vínculo ao pedido ou ao participante do Pede Junto.
2. **Função que cria a cobrança** — chamada só quando a operação marca "separei". Nunca antes.
3. **Webhook** — o Mercado Pago avisa quando o cliente paga; o pedido vira "pago" sozinho, sem ninguém conferir.
4. **Mensagem automática** no seu tom, com o link, disparada na confirmação.
5. **Expiração** — link vence, reserva volta ao estoque.
6. **Pede Junto** — um link por participante, gerado sozinho. Fim do copia e cola.
7. **Conciliação** — tela na operação mostrando pago, pendente e expirado do dia.

Tudo em homologação primeiro, com credenciais de teste e cartões de teste do próprio Mercado Pago. Nenhum centavo real se move até você aprovar.

---

## 4. Ordem

1. Você: conta verificada + credenciais de teste no Netlify (Passos 1 a 3)
2. Eu: construo e testo em homologação
3. Você: testa e aprova
4. Nós: credenciais de produção — **mas isso só depois das 93 migrações**, que hoje estão pausadas por sua decisão

⚠️ **Importante:** o Mercado Pago vai funcionar em homologação, mas **não chega em produção** enquanto as migrações estiverem pausadas. É uma escolha válida — só não pode ser esquecida.
