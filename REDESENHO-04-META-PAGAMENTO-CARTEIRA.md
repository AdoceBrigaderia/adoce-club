# Bloco 4 — Meta, pagamento e carteira
**Depende de credencial que o Rubens precisa providenciar.** Cole tudo abaixo da linha.

---

## Por que este bloco é separado

Tudo aqui depende de algo que não está no código: número dedicado da Meta, credencial de produção do Mercado Pago, certificado da Apple. Construa o que der, deixe desligado por variável de ambiente o que não der, e **diga o que falta** — não invente contorno.

---

## 1. Catálogo Meta — o canal onde o cliente vive

O Rubens ensinou a razão, e ela é decisiva:

> plano pré-pago dá WhatsApp e Instagram de graça e cobra o resto

**Para boa parte do público, o catálogo do WhatsApp não é acessório do site — é o site.**

**Tela:**
- o bloqueio em caramelo no topo: *"Falta o número dedicado — enquanto for conta pessoal, o catálogo não publica sozinho."*
- estado da conexão: WhatsApp Business, Instagram Shopping, e **o token com data de vencimento** (token expirado derruba o catálogo em silêncio)
- publicados vs com problema
- **"Travados · o que a Meta recusou" com o motivo em português**: "sem foto — a Meta exige uma", "sem preço definido". Não é código de erro, é tarefa.
- sincronização diária às 6h; sabor esgotado sai da vitrine na hora

Os mesmos 7 sabores sem foto aparecem aqui e nos Ajustes — resolver um destrava dois.

**Falta o Rubens providenciar:** número dedicado, app de desenvolvedor, token permanente, webhook e templates aprovados.

---

## 2. Pede Junto com pagamento individual

O gargalo, nas palavras dele:

> "o organizador fica com toda a responsabilidade dos pagamentos e isso faz com que eles desistam"

⚠️ **Metade disso já existe no banco desde 21/07** e ninguém usou: `pede_junto_participants` já tem `payment_url`, `payment_expires_at`, `paid_at` e os status `payment_pending` e `paid`. **Não crie tabela nova.**

A migração `20260811150000_pede_junto_pagamento.sql` acrescenta só o que falta: `mp_preference_id`, `mp_payment_id` e a tabela `pede_junto_messages` para os recados.

**As três regras, cada uma com teste travando:**

1. **Ninguém paga antes de a Adoce marcar que separou.** `podeCobrar()` exige `fechado && separado`. O link nasce em `awaiting_payment`, nunca antes.
2. **O organizador vê `nome`, `fatias`, `pagou`.** Nada de meio de pagamento. Há teste que trava a forma exata do objeto.
3. **Cinco fatias é o mínimo, não o teto.** Já houve grupo com onze moradores.

**Funções, no padrão de `customer-profile-update.ts`** (token no `Authorization`, chave secreta só no servidor, `export const config = { path: "/api/..." }`):

```
netlify/functions/pede-junto-recado.ts        grava recado, confere participant_token_hash
netlify/functions/pede-junto-gerar-links.ts   uma preferência por participante
netlify/functions/pede-junto-webhook-mp.ts    acha por mp_payment_id, marca pago
```

A leitura estende a RPC `pede_junto_room()`, que já existe.

**Em homologação use a credencial de teste — é para isso que ela existe.** Em produção, se ainda estiver em teste, **deixe a seção de pagamento desligada por variável de ambiente e avise**. Não troque credencial por conta própria.

---

## 3. Cartão na carteira do celular

`public/wallet/apple` e `public/wallet/google` existem e estão **vazias**. Alguém planejou e parou.

É a melhor versão do cartão: abre sem internet, atualiza sozinho, e no iPhone pode aparecer na tela bloqueada quando a pessoa chega perto da loja — lembrança de compra que não se paga para enviar.

- Apple Wallet exige certificado de Pass Type ID da conta de desenvolvedor
- Google Wallet exige conta de serviço

**Se a credencial não existir, construa a tela com os dois botões desabilitados e diga exatamente o que falta.** Não simule.

---

## 4. Dois apps, não um

`manifest-clube` e `manifest-operacao` já existem, com ícones próprios. São instalações separadas: o cliente instala **Clube Adoce**, a Beth instala **Adoce Operação**.

Na tela de instalar da operação, o que ela ganha: tela não apaga, impressora conecta ao abrir, pedido apita em segundo plano. E o conselho: **instalar no tablet da bancada e no celular da Beth** — assim ela vê pedido longe do balcão, que foi exatamente onde a Juliana se perdeu.

---

## 5. Avisos

Web Push e Telegram já estão configurados. Falta:
- o botão **"mandar um aviso de teste"** nos Ajustes
- a **Central de avisos** registrando o que falhou, com motivo e reenvio
- Rubens hoje recebe **só por celular**; se o Telegram cair, a Beth fica sem canal nenhum

---

## Me devolva

- o que foi construído, o que ficou desligado, e **exatamente qual credencial falta para cada um**
- confirmação de que nenhum link de pagamento nasce antes de `awaiting_payment`
- `git grep -l "pede-junto-gerar-links" -- netlify`

---

## O que NÃO fazer

- Não criar tabela nova de Pede Junto — use `pede_junto_*`
- Não gerar link de pagamento antes de a operação confirmar que separou
- Não mostrar ao organizador nada além de nome, fatias e "pagou"
- Não trocar credencial do Mercado Pago por conta própria
- Não simular carteira sem certificado — deixe desligado e avise
