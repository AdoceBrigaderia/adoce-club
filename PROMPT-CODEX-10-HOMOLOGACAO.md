# Prompt 10 para o Codex — subir tudo que está pronto para homologação
**10/08/2026** · Cole tudo abaixo da linha. Substitui os prompts 7 e 9 no que se sobrepõe.

---

Base: `adoce-oficial/homologacao-adoce`, topo `b78dea2`. **Não parta de `d3fd830`** — ele é anterior à remoção das telas legadas da operação, e voltaria a trazê-las.

**Só homologação.** Produção não se toca neste prompt.

Verificado aqui: `npx tsc -b` limpo, `npx vitest run` com **496 testes passando**.

---

## 1. Arquivos novos — nunca foram ao branch

Conferi por `git cat-file`: os quatro blocos abaixo não existem em `b78dea2`.

**Bloco A — o balcão da Beth**
```
src/balcao-atendimento.ts        src/balcao-atendimento.test.ts   (23 testes)
src/BalcaoAtendimento.tsx        src/balcao-atendimento.css
```
Nasceu da fala dela: *"tem muita informação na tela, é difícil de achar a opção de encontrar os clientes, toda vez que entro em alguma tela da operação ela abre no meio… acabo deixando pro Rubens que tem mais paciência."*

Busca primeiro, últimos atendidos sem procurar, **um botão por linha**. Quem tem fatia-presente sobe ao topo sozinho e o botão vira "Entregar".

**Bloco B — cadastro em dez segundos**
```
src/cadastro-rapido.ts           src/cadastro-rapido.test.ts      (22 testes)
src/CadastroRapido.tsx           src/cadastro-rapido.css
```
Nome e WhatsApp no aparelho da Adoce. Detecta cliente repetido pelo telefone **antes** de criar. Respeita a migração `require_customer_first_and_last_name`.

**Bloco C — a identidade única do Clube** ← *conserta os itens 1 a 4 dos testes do Rubens*
```
src/identidade-do-clube.ts       src/identidade-do-clube.test.ts  (15 testes)
```

**Bloco D — catálogo e docinhos**
```
src/pacotes-de-docinhos.ts       src/pacotes-de-docinhos.test.ts  (20 testes)
src/catalogo-de-encomendas.ts    src/catalogo-de-encomendas.test.ts (20 testes)
src/CatalogoDeEncomendas.tsx     src/catalogo-de-encomendas.css
```

Verifique a codificação UTF-8 de cada arquivo antes de commitar. Já quebrou quatro vezes.

---

## 2. O loop do Clube — o mais importante deste prompt

O Rubens testou a homologação e encontrou isto:

1. a home reconhece o membro e mostra `6/14`
2. tocar no perfil manda para cadastro, como se ele não existisse
3. o cadastro duplicado é permitido
4. a tela pede código de seis dígitos, mas o Supabase envia **Magic Link**
5. o Magic Link volta com `access_token` na URL e a sessão não é aproveitada
6. o cliente volta ao começo

**A causa não é nenhuma dessas telas.** São três caminhos de identidade convivendo — WhatsApp, e-mail e passkey — e nenhum completa sozinho.

`identidade-do-clube.ts` tem uma função só, `decidirPorta()`, com a regra:

> **Se o site sabe quem é a pessoa, ele não pede cadastro.**

**Integre assim:**
- toda tela que hoje decide sozinha se mostra cartão ou cadastro passa a chamar `decidirPorta()`
- `tokenDoMagicLink(location.hash)` lê o token que hoje é ignorado; troque por sessão e só então renderize
- depois de trocar, mande para `rotaLimpaDepoisDoLogin` (`#clube`) — o token **não pode ficar no histórico**. Já houve 7 registros com token completo em `site_analytics_events`
- `#cartao/<token>` abre o cartão sem senha. É o caminho que serve para quem está sem dado móvel, porque o papel já está na mão

**Desligue o cadastro por e-mail.** A decisão registrada é: só WhatsApp. Ele hoje pede OTP e recebe Magic Link — dois fluxos incompatíveis.

---

## 3. Docinhos: 25, 50 e 100

`pacotes-de-docinhos.ts` substitui a lógica atual de `ConfigurableProductCatalogPage`.

- quantidade anda **de 25 em 25**; 15, 14 e 10 deixam de existir
- o limite de sabores **desabilita** os demais em vez de avisar depois
- composição automática: **125 = 100 + 25**, 175 = 100 + 50 + 25
- um sabor a cada 25 unidades: pacote de 100 aceita até 4

Verifique se `#biscoitos` e `#adoce-na-escola` usam o mesmo componente e herdam a correção.

---

## 4. Encomendas: uma tela, cinco linhas

`CatalogoDeEncomendas.tsx` substitui 5 rotas e 3 componentes que faziam a mesma coisa.

**Decisão do Rubens em 10/08:** *"enquanto a Beth não falar que vamos encerrar com as Festas, Escola e Decoração, isso precisa fazer parte."* Elas entram com **peso igual** a Tortas e Docinhos — não mais num link discreto.

As abas ficam grudadas no topo: trocar de Tortas para Docinhos **não volta à home**.

Produto sem foto continua aparecendo, com um lugar desenhado para isso — 12 dos 15 não têm imagem, e escondê-los faria o cliente deixar de saber que existem.

---

## 5. Fotos do catálogo

`D:\Clube Adoce\fotos-para-o-site` — 54 imagens, 108 arquivos, 23 MB. Detalhe em `FOTOS-PARA-O-SITE.md`.

⚠️ **Não suba pelo editor de imagens do site.** Ele guarda o arquivo bruto de cada uma: são 215 originais ocupando 436 MB de um bucket de 480 MB, com limite de 1 GB. Estes arquivos já estão otimizados. **Deixe `original_image_url` nulo.**

Ligue em `commercial_products`:

| Produto | Arquivo |
|---|---|
| Torta P · R$ 115 | `torta-trufado-de-ninho` |
| Torta M · R$ 155 | `torta-chocolatudo` |
| Torta G · R$ 195 | `torta-ferrero-rocher` |
| Tabuleiro 100 colheres | `tabuleiro-01` |
| Tabuleiro 200 colheres | `tabuleiro-02` |
| Tabuleiro 500 colheres | `tabuleiro-03` |
| Docinhos tradicionais | `docinhos-01` |
| Docinhos especiais | `docinhos-02` |

**Não toque nas fotos de sabor:** as 26 já têm `image_path`. **Não ligue** `torta-whatsapp-image-2026-08-09-at-14-32-58` a nada — sabor ainda não identificado.

### 5.1 As fotos de Escola e Decoração já existem — falta ligar

Conferido em produção: **não falta foto, falta ligação.**

| Segmento | Fotos ativas em `commercial_media_items` | Produtos com `image_url` |
|---|---|---|
| `school` | **8** | 0 de 4 |
| `rentals` | **4** | 0 de 2 |
| `events` | **8** | 1 de 4 |
| `cakes` | **8** | 0 de 3 |

Todas têm `alt_text` preenchido ("Foto real de Adoce na Escola", "Foto real de Aluguel de decoração") e **`product_id` nulo** — estão ligadas ao segmento, não ao produto. A tela procurava foto no produto e não encontrava.

**Duas ligações a fazer:**

1. **`ExperienciaAdoce.tsx` recebe `fotos`** — alimente com `commercial_media_items` do segmento, `active = true`, ordenado por `sort_order`. A primeira vira capa; as demais, a galeria empilhada. **Não use carrossel.**

2. **`commercial_products.image_url`** — use a primeira foto ativa da galeria do segmento como imagem do produto, quando ele não tiver a sua. É melhor que o quadrado vazio de hoje, e reversível quando o Rubens escolher a definitiva.

Os arquivos estão em `commercial/galleries/<segmento>/` no bucket `adoce-media`. **Não suba nada novo para esses dois segmentos** — já existe.

---

## 6. Ainda pendente dos prompts anteriores

**A tela abre no meio.** Reclamação da Beth. `App.tsx` só rola ao topo no `hashchange`, mas a navegação dentro da operação troca conteúdo **sem mudar o endereço** — então o navegador mantém a rolagem. Role ao topo quando a visão ativa da operação mudar.

**Passkey: "Auth session missing!"** em `auth-bff-passkeys.ts`. O cliente Supabase recebe o token só em `global.headers.Authorization`, mas `client.auth.passkey.*` exige sessão estabelecida. Leia também o `REFRESH_COOKIE` e chame `setSession` antes. Mesma checagem em `auth-bff-passkey-start.ts` e `-finish.ts`.

**Montador de torta desligado** — rota escondida em `#montador-antigo`, arquivos preservados. Motivo: não existe custo nem preço por camada, recheio ou adicional.

**`.gitattributes` fixando UTF-8** e verificação que quebre o build se um arquivo chegar torto.

---

## 7. Verificar

```
npx tsc -b
npx vitest run          # esperado 496 ou mais
npx vite build
```

Na homologação publicada:
- entrar no Clube não volta para cadastro em nenhum caminho
- docinhos só andam de 25 em 25, e sabores excedentes ficam desabilitados
- encomendas mostra as cinco linhas com o mesmo peso, e as 8 fotos aparecem
- trocar de tela na operação começa do topo
- acentuação correta em todas as telas

Me informe a URL e o commit.

---

## O que NÃO fazer

- **Não toque em produção**
- Não parta de `d3fd830`
- Não suba foto pelo editor de imagens, nem grave original
- Não sobrescreva foto de sabor existente
- Não reponha as campanhas e andaimes já removidos
- Não afrouxe RLS nem conceda grant novo ao `authenticated`
- Não crie conta, não aceite termos, não gere nem rotacione credencial
- Não apague nada do Storage
