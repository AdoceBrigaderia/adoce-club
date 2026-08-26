# Prompt 12 para o Codex — vitrine de sabores e Compartilhe Doçura
**10/08/2026** · Cole tudo abaixo da linha. **Complementa o prompt 11, não substitui.**

---

## ⚠️ Antes de tudo: o commit anterior foi para o branch errado

O commit `c4895b6` ("feat: incorpora fluxo de venda na homologação") está correto e completo, mas ficou em:

- `adoce-oficial/codex/homologacao-prompt10` — repositório certo, **branch errado**
- `origin/homologacao-adoce` — **repositório errado** (`RMBPS/clube-adoce`), criado por engano a partir de um comando de diagnóstico meu

O Netlify constrói a partir de **`adoce-oficial/homologacao-adoce`**, que continua em `b78dea2`. Por isso o site não mudou.

```
git push adoce-oficial codex/homologacao-prompt10:homologacao-adoce
git push origin --delete homologacao-adoce
```

**Só depois disso, siga com o que está abaixo.**

---

## 1. Arquivos novos deste prompt

**A · Nossos sabores — a vitrine permanente** ← *pedido urgente do Rubens*
```
src/catalogo-de-sabores.ts       src/catalogo-de-sabores.test.ts   (17 testes)
src/CatalogoDeSabores.tsx        src/catalogo-de-sabores.css
```

**B · Compartilhe Doçura**
```
src/compartilhe-docura.ts        src/compartilhe-docura.test.ts    (18 testes)
src/CompartilheDocura.tsx        src/compartilhe-docura.css
```

Verificado aqui: `tsc -b` limpo, **602 testes**, `vite build` limpo.

---

## 2. A vitrine não pode depender do estoque

Palavras do Rubens: *"do jeito que tá, o cliente só consegue ver as tortas se existir estoque, daí não tem como gerar a vontade nele."*

Ele tem razão, e o material já existe: **os 26 sabores ativos têm foto, descrição e ingredientes cadastrados** — conferido em produção. Nunca foram mostrados.

**Como montar `SaborNaVitrine`:**

| Campo | Origem |
|---|---|
| `nome`, `descricao`, `ingredientes`, `preco` | `flavors` (`description`, `ingredients`, `base_price`) |
| `fotoFatia` | `flavors.image_path` |
| `fotoTorta`, `tortaInteira`, `precoTorta` | `whole_cake_image_path`, `whole_cake_available`, `whole_cake_price` |
| `estado` | veja abaixo |

**Os três estados:**

- **`hoje`** — existe linha em `flavor_availability` para a data de hoje com `status = 'available'`. `disponiveis` = `quantity_available - quantity_reserved`
- **`previsto`** — há regra em `weekly_service_menu` para um dia futuro. Preencha `proximaData` e `proximoDia` (use `nomeDoDia`)
- **`ausente`** — o resto. **Continua na lista**, com botão para perguntar

**Traga os 26, sempre.** Nenhum filtro por estoque nesta tela.

---

## 3. O botão "Quando vai ter?"

Quando o sabor não está disponível, o cartão mostra esse botão, que abre o WhatsApp com a pergunta pronta.

**Ligue-o também a `slice_availability_alerts`** — a tabela existe desde 04/08 e nunca foi usada. Registrar o interesse ali permite avisar quando o sabor voltar.

Dois clientes já seriam avisados hoje se isso existisse: **a Juliana Sousa**, que pediu Surpresa de Uva em 07/08 e não tinha, e **a Annaliza**, que ficou sem Abacaxi com Coco duas vezes.

⚠️ Se o registro do alerta exigir identificar o cliente, **não bloqueie o botão por isso**. Abrir o WhatsApp já resolve o essencial; o alerta é ganho extra.

---

## 4. Onde a vitrine entra

- rota nova: **`#sabores`**
- entrada visível na home e no `#adoce-hoje` — algo como "Ver todos os sabores"
- do cartão de um sabor disponível, `onReservar` leva ao `AdoceHojeVenda` com aquele sabor já escolhido

**Não substitua o `#adoce-hoje`.** São telas diferentes com funções diferentes: a vitrine gera vontade, o Adoce Hoje fecha a venda de hoje.

---

## 5. Compartilhe Doçura

Rota **`#compartilhe`**, dentro do Clube. Doze posições — decisão do Rubens, não 14.

`CartaoDeIndicacao` vem de: `referral_codes.code` (já existem **85 códigos** no banco), `profiles.full_name` para o primeiro nome, e `referrals` para a lista, com `status = 'confirmed'` virando coração.

**O convite leva um link de WhatsApp, não do site.** Ideia do Rubens: link de WhatsApp abre o aplicativo, que é o que o plano dessas pessoas dá de graça — e o amigo cai direto na caixa de entrada da Adoce, com o código já escrito na mensagem, onde uma automação pode responder.

Há teste garantindo que a mensagem não contenha link para `adocebrigaderia.com.br`.

**A lista mostra só nome e estado.** Nada de telefone: quem indicou não precisa ver o dado do amigo, e o amigo não autorizou isso.

---

## 6. Verificar

```
npx tsc -b
npx vitest run          # esperado 602 ou mais
npx vite build
```

Na homologação publicada:

- `#sabores` lista **os 26**, inclusive os sem estoque
- sabor disponível mostra "8 fatias hoje" e o botão "Quero essa hoje"
- sabor sem estoque mostra "Quando vai ter?" e abre o WhatsApp com a pergunta pronta
- sabor com torta inteira mostra o botão com o preço
- o cartão abre no toque, com descrição e ingredientes
- `#compartilhe` mostra as 12 posições e o código do cliente

**Me informe o hash do topo de `adoce-oficial/homologacao-adoce` e o id do deploy do Netlify.** Sem esses dois dados não dá para confirmar que subiu — já aconteceu duas vezes de um relatório de sucesso não corresponder ao estado real.

---

## O que NÃO fazer

- Não substituir o `#adoce-hoje` pela vitrine
- Não filtrar sabor por estoque na vitrine
- Não bloquear o botão "Quando vai ter?" por causa do registro do alerta
- Não expor telefone do amigo no Compartilhe Doçura
- Não toque em produção
- Não afrouxe RLS nem conceda grant novo ao `authenticated`
- Não crie conta, não aceite termos, não gere nem rotacione credencial
