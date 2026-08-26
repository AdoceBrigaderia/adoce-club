# Gestão Cookie — fundação do projeto
**Arquitetura, stack e jornadas · 12/08/2026**
*Documento para debate. Nenhuma linha de código antes da sua aprovação.*

---

## 0. Três discordâncias, antes de tudo

Você me pediu para atuar como arquiteto. Arquiteto que só concorda não serve. Três pontos do seu enunciado que eu mudaria:

### 0.1 Não tire a Adoce do ar antes da Gestão Cookie vender

O portal atual perde cliente — concordo. Mas ele ainda tem o Clube com 61 membros, pedidos entrando e a impressora funcionando. Desligar antes do novo estar vendendo transforma um problema crônico em problema agudo.

**Proposta:** o novo nasce em `pedido.adocebrigaderia.com.br` (ou similar). Quando ele vender melhor, aponta o domínio principal e aposenta o velho. Sem apagão.

### 0.2 Múltiplas IAs na mesma pasta é onde este projeto morre

Duas IAs editando `D:\TOPOINT\gestao-cookie` ao mesmo tempo se sobrescrevem. Git não protege arquivo aberto por dois processos — ele resolve *depois*, e "depois" é o conflito que você não vai saber desfazer.

**Proposta:** `git worktree`. Cada IA trabalha numa **pasta física própria**, do mesmo repositório, em branch própria. Detalho no item 1.

### 0.3 O nome "Cookie" tem um problema

Em software, *cookie* é o arquivinho que o navegador guarda. Quem procurar "gestão cookie" no Google vai achar LGPD e banner de consentimento — não o seu produto. É a mesma armadilha do site invisível que a gente já descobriu.

Não é impedimento. Mas se ainda dá para trocar, troque agora — nome muda de graça hoje e custa caro depois.

---

## 1. Colaboração Multi-IA e estratégia de Git

### 1.1 A regra que evita 90% do estrago

> **Uma IA nunca edita um arquivo que outra IA está editando.**

Isso se garante por **fronteira de pasta**, não por boa vontade. Cada IA é dona de um território.

### 1.2 Worktrees — pasta física por IA

```
D:\TOPOINT\gestao-cookie\          ← repositório principal, branch main
D:\TOPOINT\wt-claude\              ← worktree, branch claude/*
D:\TOPOINT\wt-codex\               ← worktree, branch codex/*
```

```bash
git worktree add ../wt-claude -b claude/vitrine
git worktree add ../wt-codex  -b codex/checkout
```

Mesma história, mesmos commits, **arquivos separados no disco**. Uma IA salvando não pisa no arquivo aberto pela outra.

### 1.3 Territórios por camada, não por tela

Dividir por tela gera conflito no arquivo de rotas, no tema e nos tipos. Divida assim:

| Território | Dono | Pastas |
|---|---|---|
| **Base** | você aprova, IA executa sozinha | `db/`, `lib/tipos`, `design-system/` |
| **Loja** | IA A | `app/(loja)/`, `features/catalogo`, `features/pedido` |
| **Operação** | IA B | `app/(operacao)/`, `features/balcao`, `features/estoque` |
| **Plataforma** | IA C | `app/(admin)/`, `features/tenant`, `features/billing` |

**A camada Base é congelada.** Mudar tipo compartilhado ou token de design exige commit próprio, sozinho, e as outras IAs rebaseiam depois. É a regra que mais evita dor.

### 1.4 Convenção de commit

```
[loja] adiciona escolha de sabor por foto
[operacao] corrige contagem do estoque do dia
[base] cria tabela de tenants com RLS
```

Prefixo obrigatório. Assim dá para ler o histórico e saber quem mexeu em quê.

### 1.5 O contrato que impede quebra

Cada IA, ao terminar, entrega **prova de ligação, não de existência** — foi a lição do projeto anterior, onde arquivos com teste verde nunca foram chamados:

```bash
git grep -l "NomeDoComponente" -- app features
```

Se listar só o próprio arquivo e o teste, **não foi integrado**. Não conta como pronto.

### 1.6 Cuidados que não são negociáveis

- **`main` sempre publicável.** Nada entra em `main` sem build e teste verdes.
- **Uma IA por vez em `main`.** Merge é serial, nunca paralelo.
- **Nada de `--force`** em branch compartilhada.
- **Migração de banco só na camada Base**, uma por vez, numerada.
- Se duas IAs precisam do mesmo arquivo: **para tudo e decide primeiro.** Não deixe o git resolver.

---

## 2. Stack e multi-tenant

### 2.1 A recomendação

| Camada | Escolha |
|---|---|
| Framework | **Next.js (App Router)** com TypeScript |
| Banco + Auth + Storage | **Supabase** (o mesmo, migrado) |
| Estilo | **Tailwind CSS** com os tokens da marca |
| Hospedagem | **Vercel** (ou Cloudflare) |
| Pagamento | Mercado Pago |

### 2.2 Por que Next.js, e não continuar em Vite

Três razões que vêm direto das dores que você já teve:

**Foto é o seu produto.** O Next otimiza imagem nativamente — serve WebP no tamanho exato da tela, carrega o que está visível primeiro. Numa vitrine de 26 sabores, isso é a diferença entre carregar em 1 segundo e em 8. E o seu cliente está em 4G pré-pago.

**Endereço de verdade.** `/tortas/trufado-de-ninho` existe no servidor. Resolve de vez o problema que a gente descobriu: hoje o Google enxerga **uma** página no seu site inteiro.

**Menos JavaScript no celular.** Com Server Components, boa parte da tela vem pronta do servidor. Celular fraco monta menos coisa. É performance real, não teórica.

O custo: Next é mais complexo que Vite. Como o código é escrito por IA e não à mão, esse custo cai muito.

### 2.3 Por que continuar no Supabase

Seus dados já estão lá. Auth, Storage e RLS num serviço só, e **RLS é a peça central do multi-tenant** — o isolamento fica no banco, não na aplicação. Se a tela tiver bug, o banco ainda protege.

Migrar de banco agora seria trocar a fundação junto com a casa.

### 2.4 Multi-tenant: as três abordagens

| | Como é | Isolamento | Custo | Complexidade |
|---|---|---|---|---|
| **Banco por tenant** | um Postgres por confeitaria | máximo | altíssimo | alta |
| **Schema por tenant** | um schema por confeitaria | alto | médio | alta — migração × N |
| **Coluna `tenant_id` + RLS** | uma tabela, RLS filtrando | alto se bem feito | baixo | baixa |

**Recomendo `tenant_id` + RLS.** Justificativa honesta:

**A favor:** uma migração serve todo mundo. Custo cresce por uso, não por cliente — importante quando os primeiros clientes forem pequenos. É o modelo que o Supabase foi feito para suportar.

**Contra, e o risco é real:** o isolamento depende de **toda** política de RLS estar certa. Uma tabela sem RLS, ou uma política mal escrita, e um cliente vê o dado do outro. Isso é o pior que pode acontecer num SaaS.

**Como reduzir o risco a quase zero:**

1. `tenant_id` é `not null` em **toda** tabela de negócio
2. RLS **ligado por padrão**; tabela nova nasce bloqueada
3. **Um teste automático que varre o banco** e falha se achar tabela sem RLS
4. **Um teste de vazamento**: cria dois tenants, tenta ler o do outro, tem que dar zero linha
5. O cliente nunca fala com a tabela — sempre por função no servidor, que injeta o `tenant_id` da sessão

Os itens 3 e 4 rodam em toda publicação. É o que transforma "confio que está certo" em "está provado".

### 2.5 Sobre hospedagem, com a sua conta na mão

Você gastou US$ 61 na Netlify. Os dados mostraram que o mês caro coincide com 8,7 milhões de tokens de IA — não com tráfego.

**Antes de escolher, descubra o que consumiu aquilo.** Se for um recurso da plataforma, ele pode reaparecer em qualquer uma. Se for algo do seu código, some sozinho.

Entre as opções: **Vercel** integra melhor com Next. **Cloudflare** é mais barato em escala e tem banda ilimitada. Para começar, ambos servem de sobra.

---

## 3. Migração dos dados

### 3.1 Princípio

> **Ler do antigo, nunca escrever nele.** O banco atual continua vivo e intocado até o novo estar provado.

### 3.2 As quatro fases

**Fase 1 — Inventário.** Listar o que existe: clientes, produtos, carimbos do Clube, pedidos, fotos. Contar linha por tabela. **Esse número é o contrato**: no fim tem que bater.

**Fase 2 — Mapeamento.** Para cada tabela antiga, dizer para onde vai. Aqui aparecem as decisões:
- `profiles` → `clientes`, com `tenant_id` da Adoce
- `flavors` → `produtos`
- carimbos do Clube → **isso não pode errar.** Cliente que tem 13 de 14 e volta com 0 vai embora para sempre.
- fotos do Storage → copiar, não referenciar

**Fase 3 — Ensaio.** Rodar a migração inteira num tenant de teste. Conferir os números. Repetir até bater 100%.

**Fase 4 — Virada.** Congelar escritas por minutos, migrar, conferir, liberar. Se algo falhar, o antigo continua lá.

### 3.3 Os carimbos merecem parágrafo próprio

O Clube é a coisa mais valiosa que você tem: 61 pessoas com histórico. Perder carimbo é perder confiança, e confiança não volta.

**Faça assim:** migre o **histórico de eventos**, não só o saldo. Cada carimbo com data e origem. Aí o saldo é calculado, e sempre dá para provar de onde veio. E antes de virar a chave, gere uma lista comparando saldo antigo × novo, cliente por cliente.

---

## 4. Jornada do cliente comprador

### 4.1 A regra

> **Ninguém cria conta para comprar.** A conta nasce da compra, não antes dela.

Foi isso que quebrou no site atual — "clientes reclamam da complexidade de cadastro". Cadastro antes da compra é pedágio.

### 4.2 O caminho, em quatro toques

**1. Chega** — pelo WhatsApp, Instagram ou Google. Cai direto na vitrine, sem home institucional, sem banner.

**2. Toca na foto** — a foto **é** o botão. Um toque adiciona. Não abre página, não pede confirmação. A quantidade aparece no canto da foto.

**3. Toca em "Pedir"** — vê o que escolheu e o valor.

**4. Nome e WhatsApp** — dois campos, e o botão. Fim.

Depois: número do pedido e botão para o WhatsApp da loja.

**Quatro toques do desejo ao pedido.** Nenhuma senha, nenhum e-mail, nenhum código.

### 4.3 A volta

O aparelho fica reconhecido. Da segunda vez o site já sabe quem é: *"Oi de novo, Juliana"* — e nunca mais oferece cadastro. O Clube aparece sozinho, com os carimbos.

Regra dura: **se o site sabe quem é a pessoa, ele não pede nada.**

### 4.4 A jornada do dono de confeitaria (o cliente da TOPOINT)

Esse é o outro comprador — quem assina a Gestão Cookie.

**1. Vê** um exemplo de loja pronta, no celular
**2. Toca em "Quero a minha"**
**3. Nome da confeitaria e WhatsApp** — e a loja **já existe**, com endereço próprio e três produtos de exemplo
**4. Troca uma foto e um preço** — e já pode mandar o link para um cliente

**Ele vende antes de pagar.** A cobrança entra depois, quando o valor já está provado. Nada de teste de 14 dias com cartão na frente.

---

## 5. Jornada operacional diária

### 5.1 O que a Beth disse, e que é a régua

> "Tem muita informação na tela, é difícil de achar os clientes, toda vez que entro em alguma tela da operação ela abre no meio… acabo deixando pro Rubens que tem mais paciência."

Sistema que a dona evita não é sistema. Três regras:

1. **Abre no topo**, e o topo é o que pede ação agora
2. **Busca de cliente sempre visível**
3. **O que não é de hoje fica em gaveta**, com o número do lado

### 5.2 A tela central: Hoje

Uma tela só, que responde três perguntas sem rolagem:

- **O que precisa de mim agora?** → pedidos esperando, em destaque, com o mais antigo primeiro
- **Como está o dia?** → quanto vendeu, quanto tem na bancada
- **Onde acho um cliente?** → busca no topo

### 5.3 As quatro ações do dia, e o custo de cada uma

| Ação | Toques |
|---|---|
| Confirmar um pedido | **1** |
| Vender no balcão | **4** — sabor, pagamento, confirmar, pronto |
| Carimbar o Clube | **0 extras** — entra junto com a venda |
| Baixar estoque | **0** — a venda já baixa |

O carimbo entrar sozinho na venda é o que mais economiza: hoje se perde carimbo no sábado cheio porque ninguém lembra de fazer depois.

### 5.4 O que fica de fora do dia a dia

Financeiro, relatórios, cadastro de produto, ajustes — **gaveta**. São coisas de fim de expediente, não de balcão com fila.

---

## 6. A marca dentro do produto

### 6.1 As cinco cores, literais do manual

| Nome | Hex | Papel na interface |
|---|---|---|
| Rosa creme | `#FBE3DD` | campo, fundo de aviso |
| Rosa cupcake | `#E89A91` | a cor da marca, moldura, destaque |
| Marrom chocolate | `#3B1F12` | texto, superfície escura, **ação** |
| Caramelo | `#E8AD67` | urgência, presente, o que aponta |
| Branco quente | `#FFF9F6` | papel |

**Chocolate age, rosa acolhe, caramelo aponta.**

O rosa cupcake **nunca** é fundo de botão — com texto branco em cima, reprova em contraste. Foi decisão tomada e vale aqui também.

### 6.2 Tipografia

**Playfair Display Bold** na voz da marca: títulos, nome de produto, números grandes.
**Inter** no resto — e **sempre** em número de dado, porque o zero da Playfair parece a letra O.

### 6.3 Tom de voz — os cinco valores como régua

Afeto · Capricho · Sabor · Cuidado · Celebração.

Toda frase da interface cabe em um deles. Na prática:

| Nunca | Sempre |
|---|---|
| "Esgotado" | "Acabou hoje — avisamos quando voltar" |
| "Erro ao processar" | "Não foi dessa vez. Tenta de novo?" |
| "Você tem 6 pontos" | "Faltam 8 fatias para a sua de presente" |

**A assinatura fecha toda página do cliente:** *"Doce feito com afeto, para celebrar cada momento."* em Playfair itálico.

### 6.4 As proibições do manual são regra de código

- nunca a logo sobre fundo poluído → capa é cor lisa, **nunca foto atrás**
- nunca alterar as cores → tokens não editáveis pelo tenant
- preservar a área de respiro

### 6.5 E quando o tenant não for a Adoce

A Gestão Cookie é multi-tenant. Cada confeitaria tem a própria marca.

**Proposta:** o tenant escolhe **logo, cor principal e cor de destaque**. O resto — espaçamento, tamanho de toque, hierarquia, ritmo — é fixo do produto. Assim cada loja parece dela, e nenhuma consegue quebrar a usabilidade.

A Adoce entra como tenant nº 1, com o manual dela já configurado.

---

## 7. Estrutura de pastas

```
D:\TOPOINT\gestao-cookie\
├─ app/
│  ├─ (loja)/[loja]/            ← vitrine pública do tenant
│  │   ├─ page.tsx
│  │   ├─ produto/[slug]/
│  │   └─ pedido/
│  ├─ (operacao)/               ← o dia a dia
│  │   ├─ hoje/
│  │   ├─ balcao/
│  │   ├─ estoque/
│  │   └─ clientes/
│  ├─ (admin)/                  ← plataforma TOPOINT
│  └─ api/
├─ features/                    ← regra de negócio, sem React
│  ├─ catalogo/
│  ├─ pedido/
│  ├─ clube/
│  └─ tenant/
├─ design-system/               ← TERRITÓRIO BASE, congelado
│  ├─ tokens.css
│  └─ componentes/
├─ lib/
│  ├─ supabase/
│  └─ tipos/                    ← TERRITÓRIO BASE
├─ db/
│  ├─ migrations/
│  └─ testes/                   ← varredura de RLS e teste de vazamento
├─ migracao/                    ← scripts de importação do site antigo
└─ docs/
   ├─ ARQUITETURA.md
   ├─ MARCA.md
   └─ TERRITORIOS.md            ← quem pode mexer em quê
```

**A separação que mais importa:** `features/` tem a regra de negócio **sem React**. Testável sem navegador, e reaproveitável quando surgir aplicativo nativo. Foi o que funcionou no projeto anterior — as regras testadas eram sólidas; o que faltou foi ligá-las.

---

## O que eu preciso decidir com você antes de escrever código

1. **O nome.** "Cookie" colide com cookie de navegador na busca. Mantém ou troca?
2. **A virada.** Concorda com domínio novo em paralelo, sem apagão?
3. **O escopo do primeiro corte.** Minha proposta: **vitrine + pedido + operação do dia**. Clube, Pede Junto, encomendas e financeiro na segunda rodada. Aceita cortar tanto?
4. **Quantas IAs de verdade?** Duas em worktrees separadas funcionam bem. Três já pede um coordenador — que provavelmente seria você.
5. **Multi-tenant desde o dia 1 na estrutura**, mas com um tenant só (Adoce) por enquanto? Ou você já quer a tela de "criar minha loja" no primeiro corte?

Responda esses cinco e eu escrevo o desenho detalhado do banco e o primeiro fluxo, tela por tela.
