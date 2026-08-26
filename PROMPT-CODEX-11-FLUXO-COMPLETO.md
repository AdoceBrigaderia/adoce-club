# Prompt 11 para o Codex — o fluxo de venda completo
**10/08/2026** · Cole tudo abaixo da linha. **Substitui o prompt 10.**

---

Base: `adoce-oficial/homologacao-adoce`, topo **`b78dea2`**. Não parta de `d3fd830`.

**Só homologação.** Produção não se toca neste prompt.

Verificado aqui: `npx tsc -b` limpo, `npx vitest run` com **567 testes**, `npx vite build` limpo.

---

## 1. Arquivos novos — nenhum existe em `b78dea2`

**A · o balcão da Beth**
```
src/balcao-atendimento.ts        src/balcao-atendimento.test.ts    (23 testes)
src/BalcaoAtendimento.tsx        src/balcao-atendimento.css
```

**B · cadastro em dez segundos**
```
src/cadastro-rapido.ts           src/cadastro-rapido.test.ts       (22)
src/CadastroRapido.tsx           src/cadastro-rapido.css
```

**C · identidade única do Clube** ← *conserta os itens 1 a 4 dos testes do Rubens*
```
src/identidade-do-clube.ts       src/identidade-do-clube.test.ts   (15)
```

**D · docinhos e catálogo**
```
src/pacotes-de-docinhos.ts       src/pacotes-de-docinhos.test.ts   (20)
src/catalogo-de-encomendas.ts    src/catalogo-de-encomendas.test.ts (20)
src/CatalogoDeEncomendas.tsx     src/catalogo-de-encomendas.css
```

**E · Adoce Hoje redesenhado — a tela de venda**
```
src/escolha-de-fatias.ts         src/escolha-de-fatias.test.ts     (22)
src/AdoceHojeVenda.tsx           src/adoce-hoje-venda.css
```

**F · finalizar a reserva**
```
src/finalizar-reserva.ts         src/finalizar-reserva.test.ts     (21)
src/FinalizarReserva.tsx         src/finalizar-reserva.css
```

**G · acompanhar o pedido, pelo cliente**
```
src/acompanhar-pedido.ts         src/acompanhar-pedido.test.ts     (16)
src/AcompanharPedido.tsx         src/acompanhar-pedido.css
```

**H · Festas, Escola e Decoração**
```
src/experiencias-adoce.ts        src/experiencias-adoce.test.ts    (12)
src/ExperienciaAdoce.tsx         src/experiencia-adoce.css
```

Verifique a codificação UTF-8 de cada um antes de commitar. Já quebrou quatro vezes.

---

## 2. O fluxo de venda, ponta a ponta

É o que este pacote fecha, e é a razão dele:

```
Adoce Hoje  →  Finalizar reserva  →  Acompanhar pedido
(escolhe)      (nome + WhatsApp)     (vê o andamento)
```

**Ligue assim:**

- `AdoceHojeVenda` recebe `sabores` (de `flavor_availability` do dia, com `image_path`), `caldas`, e `presentesDisponiveis` do Clube quando houver sessão. O `onFinalizar` leva os itens para a tela seguinte
- `FinalizarReserva` recebe `horarios` de `pickupWindowsForDay` e `local` de `pickup_locations`. O `onConfirmar` chama a RPC de criar pedido — **use apenas `submit_instant_order_v5`**, as outras foram fechadas ao público em 08/08
- `AcompanharPedido` abre em `#pedido/<numero>/<token>`, lendo por `get_instant_order(order_code, order_token)`, que já existe e é pública

**Depois de reservar, mande o cliente direto para o acompanhamento.** É a tela que faltava quando a Juliana Vidal reservou às 10h52 de 08/08 e ficou sem saber se valia.

---

## 3. Três regras codificadas — não afrouxe nenhuma

**O cliente só paga depois que a Adoce confirma que separou.** `podeCobrar()` só é verdadeiro em `awaiting_payment` e `ready`. Quando o Mercado Pago entrar, o link de pagamento só pode nascer onde isso for verdadeiro.

**A fatia-presente é presente.** Não vira desconto, cupom nem valor negativo — simplesmente não é cobrada. Há teste garantindo que o total nunca fique negativo e que a palavra "desconto" não apareça.

**Nenhuma mensagem promete o que ainda não aconteceu.** "Reservado" não é "separado". Há teste procurando a frase que eu errei com a Juliana em 08/08 — se alguém escrever "já estão separadas" de novo, o teste quebra.

---

## 4. O loop do Clube — itens 1 a 4 dos testes do Rubens

O que ele encontrou: a home reconhece o membro e mostra `6/14`; tocar no perfil manda para cadastro; o cadastro duplicado passa; a tela pede seis dígitos mas o Supabase envia **Magic Link**; o Magic Link volta com `access_token` na URL e ninguém aproveita; o cliente volta ao começo.

**A causa são três caminhos de identidade convivendo** — WhatsApp, e-mail e passkey — e nenhum completa sozinho.

`identidade-do-clube.ts` tem uma função só, `decidirPorta()`, com a regra:

> **Se o site sabe quem é a pessoa, ele não pede cadastro.**

- toda tela que hoje decide sozinha entre cartão e cadastro passa a chamá-la
- `tokenDoMagicLink(location.hash)` lê o token hoje ignorado; troque por sessão e só então renderize
- depois, mande para `rotaLimpaDepoisDoLogin` (`#clube`) — o token **não pode ficar no histórico**. Já houve 7 registros com token completo em `site_analytics_events`
- `#cartao/<token>` abre o cartão sem senha: é o caminho de quem está sem dado móvel, porque o papel já está na mão
- **desligue o cadastro por e-mail.** A decisão registrada é: só WhatsApp

---

## 5. Docinhos, encomendas e experiências

**Docinhos** — `pacotes-de-docinhos.ts` substitui a lógica de `ConfigurableProductCatalogPage`: quantidade de 25 em 25, limite de sabores **desabilitando** os demais em vez de avisar depois, composição automática (125 = 100 + 25), um sabor a cada 25 unidades. Verifique se `#biscoitos` e `#adoce-na-escola` herdam.

**Encomendas** — `CatalogoDeEncomendas` substitui 5 rotas e 3 componentes. As cinco linhas com **peso igual**; abas grudadas no topo; trocar de Tortas para Docinhos **não volta à home**.

**Festas, Escola e Decoração** — `ExperienciaAdoce` substitui as telas atuais. **O carrossel sai:** no celular esconde conteúdo atrás de um gesto que ninguém faz, e foi relatado com falhas graves. As fotos ficam empilhadas.

Decisão do Rubens em 10/08: *"enquanto a Beth não falar que vamos encerrar com as Festas, Escola e Decoração, isso precisa fazer parte."*

---

## 6. Fotos

**6.1 Escola e Decoração já têm foto — falta ligar.** Conferido em produção:

| Segmento | Fotos ativas em `commercial_media_items` | Produtos com `image_url` |
|---|---|---|
| `school` | **8** | 0 de 4 |
| `rentals` | **4** | 0 de 2 |
| `events` | **8** | 1 de 4 |
| `cakes` | **8** | 0 de 3 |

Todas com `alt_text` e **`product_id` nulo** — ligadas ao segmento, não ao produto. Era por isso que a tela mostrava vazio.

- `ExperienciaAdoce` recebe `fotos`: alimente com `commercial_media_items` do segmento, `active = true`, por `sort_order`. A primeira é capa, as demais a galeria
- `commercial_products.image_url`: use a primeira foto ativa da galeria do segmento quando o produto não tiver a sua

**6.2 As 54 fotos preparadas** estão em `D:\Clube Adoce\fotos-para-o-site` (23 MB, duas medidas cada). Detalhe em `FOTOS-PARA-O-SITE.md`.

⚠️ **Não suba pelo editor de imagens do site.** Ele guarda o arquivo bruto: são 215 originais ocupando 436 MB de um bucket de 480 MB, limite de 1 GB. **Deixe `original_image_url` nulo.**

**Não sobrescreva foto de sabor** — as 26 já têm `image_path`. **Não ligue** `torta-whatsapp-image-2026-08-09-at-14-32-58` a nada: sabor ainda não identificado.

---

## 7. Ainda pendente dos prompts anteriores

**A tela abre no meio** — reclamação da Beth. `App.tsx` só rola ao topo no `hashchange`, mas a navegação dentro da operação troca conteúdo **sem mudar o endereço**. Role ao topo quando a visão ativa mudar.

**Passkey: "Auth session missing!"** em `auth-bff-passkeys.ts` — o cliente Supabase recebe o token só em `global.headers.Authorization`, mas `client.auth.passkey.*` exige sessão. Leia o `REFRESH_COOKIE` e chame `setSession` antes. Mesma checagem em `-start.ts` e `-finish.ts`.

**Montador de torta desligado** — rota escondida em `#montador-antigo`, arquivos preservados. Não existe custo por camada.

**`.gitattributes` fixando UTF-8** e verificação que quebre o build se um arquivo chegar torto.

---

## 8. Verificar

```
npx tsc -b
npx vitest run          # esperado 567 ou mais
npx vite build
```

Na homologação publicada, o caminho inteiro:

1. abrir o Adoce Hoje e ver as fotos grandes
2. escolher uma fatia — a calda aparece e o botão diz "Escolha a calda"
3. escolher a calda — o botão vira "Reservar"
4. reservar com nome e WhatsApp
5. cair no acompanhamento e ver a etapa "Reserva recebida"
6. na operação, avançar o pedido e ver a etapa mudar do lado do cliente

E ainda: entrar no Clube não volta para cadastro em nenhum caminho; docinhos só andam de 25 em 25; encomendas mostra as cinco linhas com o mesmo peso; trocar de tela na operação começa do topo; acentuação correta.

Me informe a URL e o commit.

---

## O que NÃO fazer

- **Não toque em produção**
- Não parta de `d3fd830`
- Não use `submit_instant_order` v1, v2, v3 ou v4 — só a `v5`
- Não suba foto pelo editor, nem grave original
- Não sobrescreva foto de sabor existente
- Não reponha as campanhas e andaimes já removidos
- Não afrouxe RLS nem conceda grant novo ao `authenticated`
- Não crie conta, não aceite termos, não gere nem rotacione credencial
- Não apague nada do Storage
