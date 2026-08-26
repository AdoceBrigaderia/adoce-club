# Gestão Cookie — documento único
**TOPOINT · 12/08/2026**

Tudo o que foi produzido para a fundação do projeto, num arquivo só.

| Parte | O que é | Para quem |
|---|---|---|
| **1** | Briefing de arquitetura | enviar às três IAs |
| **2** | Proposta do Claude | entra na comparação |
| **3** | Método de avaliação e prompt da 4ª IA | uso do Rubens |

**Como usar:** envie a Parte 1 para cada IA, separadamente. Quando as três responderem, use a Parte 3 para comparar — e coloque a Parte 2 na comparação junto com elas.

---
---

# PARTE 1 — Briefing para as três IAs

*Este é o texto a ser enviado. Copie da linha abaixo até o fim da Parte 1.*

---

**Para: as três IAs convidadas · 12/08/2026**

---

## Como este trabalho será avaliado

**Três IAs receberam este mesmo briefing, separadamente.** Cada uma entrega uma proposta completa e independente.

As três serão lidas lado a lado. **Não vamos escolher uma e descartar as outras** — vamos tirar o melhor de cada e montar uma quarta, que é a que vai para o código.

O que isso significa para você:

- **Discorde do briefing onde achar que ele está errado.** Uma proposta que só concorda não acrescenta nada à comparação. Se você acha que alguma premissa abaixo é ruim, diga, com o motivo.
- **Justifique cada escolha.** Uma decisão sem justificativa não pode ser comparada com a alternativa — e vai ser descartada na fusão.
- **Diga o que você não sabe.** Onde faltar informação para decidir, aponte a pergunta em vez de inventar resposta.
- **Não escreva código.** Esta fase é de arquitetura. Código só depois da fusão aprovada.

Siga o **formato de entrega** do fim deste documento. Propostas que respondem coisas diferentes não podem ser comparadas.

---

# 1. O que é o projeto

**Gestão Cookie** é um SaaS comercial para confeitarias: vitrine de venda para o cliente final e operação diária para a dona do negócio.

Nasce em `D:\TOPOINT\gestao-cookie`, repositório novo, sem herdar nada do código atual.

Substituirá o portal `adocebrigaderia.com.br`, hoje em Netlify + Supabase — **mas só quando estiver 100% aprovado em homologação.** Sem apagão.

## Quem é quem

| Camada | O que é |
|---|---|
| **TOPOINT** | a fábrica de software. Dona do produto. |
| **Gestão Cookie** | o produto vendido por assinatura. |
| **Adoce Brigaderia** | tenant nº 1. Confeitaria real, em operação, em Fortaleza. |
| **Cliente final** | quem compra torta da Adoce. |

**Essa separação é a decisão mais fácil de errar.** Ver o item 6.

---

# 2. As três regras de ouro

### 2.1 Multi-tenant desde o dia 1
O banco nasce multi-tenant, feito certo. Retrofitar isso depois é inviável.

### 2.2 Mobile first extremo
O celular é a experiência principal. O desktop é secundário. O público real está em **Android de entrada, 4G pré-pago**, e o dado é caro para ele.

### 2.3 Mínimo de cliques
Cadastro, login, compra e operação diária resolvidos no menor número de passos possível.

---

# 3. O contexto real — leia antes de propor

Estas não são hipóteses. É o que acontece hoje na Adoce.

**Por que o portal atual está sendo abandonado:**

- clientes desistem no meio do pedido e mandam no WhatsApp
- clientes reclamam da complexidade do cadastro
- pedidos falham
- a dona evita o painel: *"tem muita informação na tela, é difícil de achar os clientes, toda vez que entro em alguma tela da operação ela abre no meio… acabo deixando pro Rubens que tem mais paciência"*
- cada correção quebra outras coisas

**O que isso ensina, e que a sua proposta precisa levar em conta:**

1. **Cadastro antes da compra é pedágio.** Foi o que mais afastou cliente.
2. **O WhatsApp é o canal real.** No plano pré-pago brasileiro, WhatsApp e Instagram não gastam dado — o site gasta. Para boa parte do público, o site **compete com o WhatsApp em desvantagem**.
3. **Foto é o produto.** Confeitaria vende por imagem. Foto pequena ou lenta é venda perdida.
4. **Se a dona não usa, o sistema não existe.**

**Restrição de negócio, e ela é dura:** a Adoce precisa sair de 28 para 35 tortas por semana em 60 dias, ou fecha. O dono está endividado. Proposta que só começa a gerar valor em seis meses é proposta que chega tarde.

---

# 4. O que responder

## 4.1 Colaboração multi-IA e Git

Três IAs vão trabalhar no mesmo repositório. **Duas IAs editando a mesma pasta ao mesmo tempo se sobrescrevem** — o Git resolve depois, e "depois" é o conflito que ninguém sabe desfazer.

Proponha o fluxo. Responda pelo menos:

- como isolar fisicamente o trabalho de cada IA (worktree? clone? outra coisa?)
- como dividir território: por camada, por feature, por rota?
- o que fazer quando duas precisarem do mesmo arquivo
- convenção de commit e de branch
- como impedir que entre em `main` algo quebrado
- **como provar que uma entrega foi realmente integrada, e não só criada**

Sobre o último ponto — no projeto anterior, arquivos com teste verde nunca foram chamados por tela nenhuma. Pareciam prontos e não estavam. Proponha uma verificação que pegue isso.

## 4.2 Stack

Escolha e justifique: framework, banco, estilo, hospedagem, pagamento.

Considere: os dados estão hoje no Supabase; o público é celular fraco em 4G caro; o produto é foto; e o site precisa ser achável no Google — hoje o portal atual é **uma única página** para o buscador, porque toda navegação é por `#`.

## 4.3 Multi-tenant no banco

Compare as abordagens (banco por tenant, schema por tenant, coluna + RLS) e recomende uma, com prós e contras honestos.

**Trate o isolamento como responsabilidade legal, não só técnica.** Vazamento entre tenants expõe a base de clientes de outras empresas — é incidente de LGPD com o negócio dos outros. Proponha como *provar* o isolamento, não só como implementá-lo.

## 4.4 Migração dos dados

Plano para preservar 100% de clientes e produtos do Supabase atual.

**Atenção especial ao Clube de fidelidade:** 61 pessoas com carimbos acumulados, a cada 14 fatias a 15ª é presente. Cliente que tem 13 carimbos e volta com 0 vai embora para sempre. Proponha como migrar isso de forma auditável.

## 4.5 Jornada do cliente final

Da descoberta ao pedido, com o mínimo de atrito. Diga **quantos toques** cada etapa custa.

## 4.6 Jornada do dono de confeitaria assinando o SaaS

Do primeiro contato até a loja no ar. Também em toques.

## 4.7 Jornada operacional diária

O dia a dia no celular. Qual a tela central e como as tarefas principais são feitas com o mínimo de telas e toques.

## 4.8 SEO local — e como o produto pode automatizá-lo

Confeitaria é negócio de bairro. Quem procura "confeitaria perto de mim" ou "bolo em Fortaleza" está a um dia de comprar — **88% de quem faz busca local no celular visita ou liga em 24 horas.** E 46% de todas as buscas do Google têm intenção local.

O portal atual não aparece em nenhuma delas: toda navegação é por `#`, então o Google enxerga **uma página só** no site inteiro.

**Responda três coisas:**

**a) O que o site precisa ter** para aparecer em busca local: endereços por produto, dados estruturados, sitemap, conteúdo renderizado no servidor. Seja específico.

**b) O Perfil da Empresa no Google.** Em 2026 ele é o fator nº 1 do bloco de mapas, e as AI Overviews do Google respondem "qual a melhor confeitaria aberta agora" usando os dados dele. Ele não depende do site — mas **o produto pode alimentá-lo**.

O algoritmo hoje premia **frescor**: uma loja com 150 avaliações que postou foto hoje ganha de uma com 500 avaliações parada há seis meses.

**A pergunta que interessa:** a Gestão Cookie pode publicar automaticamente no Perfil do Google toda vez que a confeitaria atualizar os sabores do dia? Se puder, isso é diferencial de produto — cada tenant ganha frescor sem trabalho manual. Avalie viabilidade e risco.

**c) SEO local multiplicado por tenant.** Cada confeitaria assinante é um negócio local diferente, em cidade diferente. Como a arquitetura entrega SEO local para **todos os tenants** sem trabalho manual por cliente? Endereço próprio, dados estruturados por loja, sitemap por tenant?

**Contexto honesto:** SEO leva meses. Não vai salvar os 60 dias da Adoce. Diga o que dá resultado em semanas e o que só rende no médio prazo — e não misture os dois.

## 4.9 Estrutura de pastas

Como organizar `D:\TOPOINT\gestao-cookie` para a stack escolhida e para trabalho multi-IA.

---

# 5. Sequência — e onde eu quero sua opinião

A minha proposta é:

1. arquitetura multi-tenant desde o dia 1
2. **um tenant só (Adoce) até ela estar vendendo bem**
3. a tela de "criar minha loja" construída, mas guardada até lá
4. primeiro corte: **vitrine + pedido + operação do dia**
5. Clube, Pede Junto, encomendas e financeiro na segunda rodada

**Discorde se achar errado.** Especialmente sobre o item 4 — o portal anterior morreu porque construiu 63 telas e entregou zero. Qual é o menor corte que já vende?

---

# 6. As três marcas — não misture

Este é o ponto que mais se erra.

## 6.1 TOPOINT — a fábrica

Aparece na institucional e na assinatura do produto ("por TOPOINT").

| Cor | Hex |
|---|---|
| Azul marinho | `#0B1D3A` |
| Azul cobalto | `#1565FF` |
| Cinza ardósia | `#64748B` |
| Branco off | `#F7F8FA` |
| Branco | `#FFFFFF` |

**Sora Bold** nos títulos · **Inter Regular** no texto
Valores: Precisão · Entrega · Crescimento · Confiança · Escalabilidade
*"Tecnologia que entrega. Resultados que escalam."*

## 6.2 Gestão Cookie — o painel da operação

É onde a dona da confeitaria trabalha. **Precisa ser neutro.** A Confeitaria da Márcia não vai operar num sistema com a cara da concorrente.

**Recomendação a debater:** o painel herda a linguagem da TOPOINT — azuis, Sora, Inter. Sóbrio, legível, sem personalidade de marca de doce.

Se você discordar e achar que Gestão Cookie precisa de identidade própria, diga por quê.

## 6.3 Adoce Brigaderia — o tenant

Aparece **só na vitrine que o cliente final vê**. Nunca no painel.

| Cor | Hex |
|---|---|
| Rosa creme | `#FBE3DD` |
| Rosa cupcake | `#E89A91` |
| Marrom chocolate | `#3B1F12` |
| Caramelo | `#E8AD67` |
| Branco quente | `#FFF9F6` |

**Playfair Display Bold** na voz · **Inter** no resto
Valores: Afeto · Capricho · Sabor · Cuidado · Celebração
*"Doce feito com afeto, para celebrar cada momento."*

Regras do manual que viram regra de código: nunca a logo sobre fundo poluído; nunca alterar as cores; preservar a área de respiro.

## 6.4 O sistema de temas

Cada tenant terá a própria marca. Proponha **o que o tenant pode mudar e o que é fixo do produto**.

Ponto de partida a debater: o tenant escolhe logo e duas cores; espaçamento, tamanho de alvo de toque, hierarquia e ritmo são fixos. Assim cada loja parece dela e nenhuma consegue quebrar a usabilidade.

---

# 7. Formato da entrega

Para que as três propostas sejam comparáveis, entregue **nesta ordem**, com estes títulos:

```
0.  Onde eu discordo do briefing        ← comece por aqui
1.  Colaboração multi-IA e Git
2.  Stack, com justificativa por item
3.  Multi-tenant: abordagem e prova de isolamento
4.  Migração dos dados
5.  Jornada do cliente final (em toques)
6.  Jornada de quem assina o SaaS (em toques)
7.  Jornada operacional diária (em toques)
8.  Sistema de temas por tenant
9.  SEO local, e como o produto o automatiza por tenant
10. Estrutura de pastas
11. Menor corte que já vende, e por quê
12. Riscos: o que pode dar errado nesta proposta
13. O que eu precisaria saber e não sei
```

**O item 0 é obrigatório.** Proposta sem discordância será tratada como proposta sem opinião.

**O item 12 também.** Toda arquitetura tem um ponto fraco; quem não aponta o seu está escondendo ou não enxergou.

**Não escreva código.** Nem exemplo, nem esqueleto, nem migração. Só arquitetura e decisão.


---
---

# PARTE 2 — Proposta do Claude

*Entra na comparação como quarta proposta. Segue o mesmo formato exigido das outras.*

---

**Autor: Claude · 12/08/2026**
*Responde ao briefing multi-IA, no formato exigido.*

---

## 0. Onde eu discordo do briefing

### 0.1 Três IAs é demais

O briefing pede três IAs desenvolvendo junto. Cada IA a mais multiplica coordenação, e coordenação não é feita por IA nenhuma — é feita pelo Rubens, que já está sobrecarregado.

**Duas em worktrees separadas funcionam bem. Três exige um coordenador em tempo integral.**

Minha proposta: **três IAs para a arquitetura** (esta fase, onde diversidade ajuda) e **uma ou duas para o código** (onde diversidade vira conflito).

### 0.2 O nome colide com termo técnico

"Gestão Cookie" no Google devolve LGPD e banner de consentimento. Como o produto será vendido para donas de confeitaria que vão procurar por ele, isso tem custo comercial. Trocar hoje é grátis.

### 0.3 A ambição de SaaS e a sobrevivência da Adoce competem

60 dias para 35 tortas, com dívida. Um SaaS comercial não retorna nesse prazo.

**Não estou dizendo para desistir do SaaS.** Estou dizendo que a ordem tem que ser brutal: construir a fundação multi-tenant agora (barato hoje, inviável depois), mas **não gastar uma hora em cadastro de novo tenant, cobrança ou painel de admin antes da Adoce estar vendendo.**

### 0.4 O maior erro do briefing é o item 4.5

O briefing pede "jornada do cliente final, da descoberta ao pedido". Isso pressupõe que o pedido termina no site.

**Eu acho que não deveria.** Ver item 11.

---

## 1. Colaboração multi-IA e Git

### 1.1 Isolamento físico: `git worktree`

```
D:\TOPOINT\gestao-cookie\     ← principal, branch main
D:\TOPOINT\wt-a\              ← IA A, branch ia-a/*
D:\TOPOINT\wt-b\              ← IA B, branch ia-b/*
```

```bash
git worktree add ../wt-a -b ia-a/vitrine
```

Mesmo repositório, mesmo histórico, **arquivos separados no disco**. Uma IA salvando não pisa no arquivo aberto pela outra. Clone separado também funciona, mas worktree compartilha o histórico e evita divergência de submódulo.

### 1.2 Território por camada, não por tela

Dividir por tela gera conflito em três arquivos que todo mundo toca: rotas, tema e tipos.

| Território | Pastas |
|---|---|
| **Base** — congelado | `db/`, `lib/tipos/`, `design-system/` |
| **Loja** | `app/(loja)/`, `features/catalogo`, `features/pedido` |
| **Operação** | `app/(operacao)/`, `features/balcao`, `features/estoque` |
| **Plataforma** | `app/(admin)/`, `features/tenant` |

**A camada Base é congelada:** mudança nela é commit próprio, sozinho, aprovado pelo Rubens, e as outras rebaseiam depois. É a regra que mais evita dor.

### 1.3 Quando duas precisarem do mesmo arquivo

**Para tudo e decide primeiro.** Não deixe o Git resolver — merge automático em arquivo de rota ou de tipo gera código que compila e faz a coisa errada.

Se acontecer duas vezes no mesmo arquivo, é sinal de fronteira mal desenhada. Redesenhe a fronteira, não o merge.

### 1.4 Convenções

```
[base] cria tabela de tenants com RLS
[loja] escolha de sabor por foto
[operacao] corrige contagem do estoque
```

Branch: `ia-a/vitrine`, `ia-b/balcao`. Nunca `--force` em branch compartilhada. Merge para `main` é **serial**, uma IA por vez.

### 1.5 A verificação que pega o erro do projeto anterior

No portal atual, arquivos com teste verde nunca foram chamados por tela nenhuma. Pareciam prontos e não estavam.

**Prova de ligação, não de existência:**

```bash
git grep -l "NomeDoComponente" -- app features
```

Se listar só o próprio arquivo e o teste, **não foi integrado**. Não conta como entregue.

E no CI: um teste que abre cada rota e falha se ela renderizar vazio.

---

## 2. Stack, com justificativa por item

| Camada | Escolha |
|---|---|
| Framework | **Next.js (App Router)** + TypeScript |
| Banco, Auth, Storage | **Supabase** |
| Estilo | **Tailwind** sobre tokens |
| Hospedagem | **Cloudflare Pages** ou **Vercel** — ver 2.4 |
| Pagamento | Mercado Pago |

### 2.1 Next.js — três razões concretas

**Foto é o produto.** Otimização de imagem nativa: WebP no tamanho exato da tela. Numa vitrine de 26 sabores em 4G fraco, é diferença entre 1 e 8 segundos.

**Endereço de verdade.** `/tortas/trufado-de-ninho` existe no servidor. Resolve o que hoje é fatal: o portal atual é **uma página só** para o Google, porque tudo é `#`.

**Menos JavaScript no celular.** Server Components entregam tela pronta. Celular de entrada monta menos coisa.

**Contra:** Next é mais complexo que Vite. Como o código é escrito por IA, esse custo cai — mas não some. Se a equipe fosse humana e iniciante, eu recomendaria Vite.

### 2.2 Supabase — fica

Os dados já estão lá. Auth, Storage e **RLS num serviço só** — e RLS é a peça central do multi-tenant. Trocar de banco agora seria mexer na fundação junto com a casa.

### 2.3 Tailwind

Estilo junto do componente elimina a doença do projeto anterior: **68 folhas de estilo e 109 variáveis para 15 cores**. Com tokens no `tailwind.config`, a marca fica num lugar só.

### 2.4 Hospedagem — decisão adiada de propósito

O Rubens gastou US$ 61 na Netlify em um mês. Os dados mostram que o mês caro coincide com **8,7 milhões de tokens de IA** — não com tráfego.

**Enquanto não se souber o que consumiu aquilo, escolher plataforma é chute.** Pode ser recurso da plataforma (reaparece em qualquer uma) ou algo no código (some sozinho).

Descoberto isso: Cloudflare é mais barato em escala e tem banda ilimitada; Vercel integra melhor com Next.

---

## 3. Multi-tenant: abordagem e prova de isolamento

### 3.1 Comparação

| | Isolamento | Custo | Migração | Veredito |
|---|---|---|---|---|
| Banco por tenant | máximo | altíssimo | × N | inviável para clientes pequenos |
| Schema por tenant | alto | médio | × N | manutenção dolorosa |
| **`tenant_id` + RLS** | alto se bem feito | baixo | uma só | **recomendado** |

### 3.2 A recomendação e o risco honesto

**`tenant_id` + RLS.** Uma migração serve todo mundo, custo cresce por uso e não por cliente.

**O risco é real e grave:** uma tabela sem RLS, ou uma política mal escrita, e um tenant vê o dado do outro. Num SaaS comercial isso não é bug — é incidente de LGPD com o negócio dos outros.

### 3.3 Como provar o isolamento, não só implementá-lo

Cinco camadas, e as duas últimas são o que transforma "confio" em "está provado":

1. `tenant_id` `not null` em toda tabela de negócio
2. RLS ligado por padrão; tabela nova nasce bloqueada
3. cliente nunca fala com a tabela — sempre por função no servidor que injeta o `tenant_id` da sessão
4. **teste que varre o catálogo** e falha se achar tabela sem RLS
5. **teste de vazamento:** cria dois tenants com dado, autentica como um, tenta ler o do outro por todos os caminhos, **tem que dar zero linha**

Os itens 4 e 5 rodam em **toda** publicação. Falhou, não publica.

---

## 4. Migração dos dados

**Princípio: ler do antigo, nunca escrever nele.**

**Fase 1 — Inventário.** Contar linha por tabela. Esse número é o contrato.

**Fase 2 — Mapeamento.** `profiles` → `clientes` com `tenant_id`; `flavors` → `produtos`; fotos do Storage copiadas, não referenciadas.

**Fase 3 — Ensaio.** Migração inteira num tenant de teste, até bater 100%.

**Fase 4 — Virada.** Congela escrita por minutos, migra, confere, libera.

### 4.1 O Clube merece tratamento próprio

61 pessoas com carimbos. A cada 14 fatias, a 15ª é presente. **Cliente que tem 13 e volta com 0 vai embora para sempre.**

**Migre o histórico de eventos, não o saldo.** Cada carimbo com data e origem; o saldo vira cálculo. Assim sempre dá para provar de onde veio.

E antes de virar: lista comparando saldo antigo × novo, **cliente por cliente**, conferida à mão. São 61 linhas. Vale a hora.

---

## 5. Jornada do cliente final — em toques

**A regra: ninguém cria conta para comprar.** A conta nasce da compra.

| Passo | Toques |
|---|---|
| Chega pelo WhatsApp ou Instagram, cai na vitrine | 0 |
| Toca na foto do sabor — a foto **é** o botão | 1 |
| Toca em "Pedir" | 1 |
| Nome e WhatsApp, e envia | 2 |

**Quatro toques.** Sem senha, sem e-mail, sem código.

Na volta, o aparelho é reconhecido: *"Oi de novo, Juliana"* — e nunca mais oferece cadastro.

---

## 6. Jornada de quem assina o SaaS — em toques

| Passo | Toques |
|---|---|
| Vê uma loja de exemplo no celular | 0 |
| "Quero a minha" | 1 |
| Nome da confeitaria e WhatsApp | 2 |
| **A loja já existe**, com endereço e 3 produtos de exemplo | — |
| Troca uma foto e um preço | 2 |

**Ela vende antes de pagar.** Cobrança entra depois, com o valor já provado. Nada de teste de 14 dias pedindo cartão.

---

## 7. Jornada operacional diária — em toques

A régua é a frase da Beth: *"acabo deixando pro Rubens que tem mais paciência."*

**Uma tela central — "Hoje"** — que responde três perguntas sem rolagem: o que precisa de mim agora, como está o dia, onde acho um cliente.

| Ação | Toques |
|---|---|
| Confirmar pedido | **1** |
| Vender no balcão | **4** |
| Carimbar o Clube | **0 extras** — entra junto com a venda |
| Baixar estoque | **0** — a venda já baixa |

O carimbo automático é o que mais economiza: hoje se perde carimbo no sábado cheio porque ninguém lembra de fazer depois.

Financeiro, relatórios e cadastros ficam em gaveta. São coisa de fim de expediente, não de balcão com fila.

---

## 8. Sistema de temas por tenant

**Três marcas, três lugares:**

- **TOPOINT** — institucional e assinatura ("por TOPOINT")
- **Gestão Cookie** — o painel. Herda os azuis e a Sora da TOPOINT. **Neutro de propósito:** a Confeitaria da Márcia não opera num sistema com a cara da concorrente.
- **Tenant** — aparece **só na vitrine que o cliente final vê**

**O que o tenant muda:** logo, cor principal, cor de destaque.
**O que é fixo:** espaçamento, tamanho de alvo de toque, hierarquia, tipografia de interface, ritmo.

Assim cada loja parece dela e **nenhuma consegue quebrar a usabilidade** — que é o erro que um tema livre garante.

**Validação obrigatória:** contraste conferido no momento em que o tenant escolhe a cor. Se reprovar, o sistema recusa e explica. A Adoce já mostrou o caso: rosa cupcake com texto branco reprova.

---

## 9. SEO local — e como o produto o automatiza

### 9.1 O tamanho da oportunidade

**46% das buscas do Google têm intenção local.** E **88% de quem faz busca local no celular visita ou liga em 24 horas.** Isso não é público frio: é gente decidindo onde comprar hoje.

O portal atual não aparece em nenhuma dessas buscas — toda navegação é por `#`, então o Google enxerga **uma página** no site inteiro. Vinte e seis sabores com nome, foto e preço, invisíveis.

### 9.2 O que o site precisa ter

- **endereço próprio por produto** — `/tortas/trufado-de-ninho`, renderizado no servidor
- **dados estruturados** `Bakery` na loja e `Product` em cada item, com endereço, telefone e horário
- **sitemap por tenant**, gerado no build
- **título e descrição por página**, com cidade e bairro
- `og:image` com a foto — é o que aparece quando o link é colado no WhatsApp, e isso rende **antes** de qualquer ganho no Google

⚠️ **Só declare o que é verdade.** Disponibilidade vem do estoque real e horário vem do ajuste da loja. Dado estruturado mentiroso é penalizado.

### 9.3 O Perfil da Empresa no Google — o que mais rende, e não depende do site

Em 2026 ele é o fator nº 1 do bloco de mapas. E as **AI Overviews** do Google respondem *"qual a melhor confeitaria aberta agora"* usando os dados dele.

**O algoritmo premia frescor.** Uma loja com 150 avaliações que postou foto hoje ganha de uma com 500 avaliações parada há seis meses.

### 9.4 A oportunidade de produto — e é a melhor ideia desta proposta

A Beth já atualiza os sabores do dia no sistema. **Esse mesmo ato pode publicar no Perfil do Google.**

Um toque no estoque de hoje → foto e sabores do dia no Google → sinal de frescor diário, automático, sem trabalho extra.

**Para a Gestão Cookie isso vale como argumento de venda:** *"sua confeitaria aparece no Google todo dia, sem você fazer nada."* É diferencial que concorrente com planilha não tem.

**Viabilidade:** a API do Business Profile permite publicar posts e fotos. Exige verificação do perfil e autorização do tenant.

**Riscos, honestos:** aprovação da API não é imediata; publicação automática em excesso pode ser vista como spam; e cada tenant precisa autorizar o próprio perfil — não dá para fazer em massa.

### 9.5 SEO local multiplicado por tenant

Cada confeitaria é um negócio local diferente, em cidade diferente. A arquitetura entrega isso sozinha:

- sitemap e dados estruturados **gerados por tenant**, sem trabalho manual
- endereço, telefone e horário vêm do cadastro da loja
- rota `/[loja]/produto/[slug]` funciona para todos

**Um tenant novo nasce com SEO local pronto.** É subproduto da arquitetura, não trabalho por cliente.

### 9.6 Expectativa honesta de prazo

| Prazo | O que rende |
|---|---|
| **Dias** | Perfil da Empresa no Google criado e completo; `og:image` fazendo link bonito no WhatsApp |
| **Semanas** | avaliações acumulando; frescor diário no perfil |
| **Meses** | busca orgânica do site |

**SEO de site não salva os 60 dias da Adoce.** O Perfil do Google pode ajudar em semanas. Não confunda os dois — e não deixe ninguém te vender o primeiro prometendo o prazo do segundo.

---

## 10. Estrutura de pastas

```
D:\TOPOINT\gestao-cookie\
├─ app/
│  ├─ (loja)/[loja]/          ← vitrine pública
│  ├─ (operacao)/             ← o dia a dia
│  ├─ (admin)/                ← plataforma
│  └─ api/
├─ features/                  ← regra de negócio, SEM React
├─ design-system/             ← BASE, congelado
├─ lib/{supabase,tipos}/      ← tipos é BASE
├─ db/{migrations,testes}/    ← testes = varredura RLS + vazamento
├─ migracao/
└─ docs/TERRITORIOS.md        ← quem mexe em quê
```

**O que mais importa:** `features/` tem a regra **sem React**. Testável sem navegador. No projeto anterior isso funcionou — as regras testadas eram sólidas; o que faltou foi ligá-las.

---

## 11. O menor corte que já vende — a aposta desta proposta

**Aqui eu me separo do briefing.**

O briefing pede a jornada "até o pedido no site". Eu proponho que **o primeiro corte não tenha checkout.**

### 11.1 O raciocínio

O Rubens relata: *"clientes desistem e mandam o pedido direto no meu zap."*

A leitura comum é que o site falhou. **Eu leio o contrário: o cliente está dizendo onde ele quer comprar.**

E tem o dado: no pré-pago brasileiro, WhatsApp não gasta internet e o site gasta. **Para boa parte do público, o site compete com o WhatsApp em desvantagem.**

### 11.2 O primeiro corte

**Uma tela.** A vitrine.

O cliente toca nas fotos, monta o pedido, e o botão abre o **WhatsApp com o pedido escrito**:

> Oi! Quero: 2 fatias de Trufado de Ninho (calda de chocolate) e 1 de Oreo. Total R$ 48. Sou a Juliana.

**Zero cadastro. Zero senha. Zero pagamento. Zero painel.**

A operação continua no WhatsApp, que é onde a Beth já está — e a Beth não precisa aprender sistema nenhum na primeira semana.

**No servidor**, o pedido fica registrado no momento em que o botão é tocado. Então já existe dado: o que foi pedido, quando, por quem. É a base do painel da fase 2.

### 11.3 Por que isso é melhor que a alternativa

- **Ship em dias, não semanas**
- **Elimina de uma vez** as três reclamações: cadastro complexo, pedido que falha, cliente que desiste
- **Não pede nada da Beth** — ela continua no zap
- E gera o dado para construir a fase 2 sabendo o que realmente vende

### 11.4 As fases seguintes

| Fase | O que entra | Quando |
|---|---|---|
| 1 | vitrine + pedido pelo WhatsApp | agora |
| 2 | painel "Hoje" + confirmação + estoque | quando o volume incomodar |
| 3 | Clube migrado | quando a operação estiver estável |
| 4 | pagamento no site | quando o cliente pedir |
| 5 | cadastro de novo tenant e cobrança | quando a Adoce estiver vendendo bem |

O banco é multi-tenant desde a fase 1. **Só a interface é que chega aos poucos.**

---

## 12. Riscos desta proposta

**O corte 1 pode ser confundido com preguiça.** Uma vitrine que termina no WhatsApp parece "menos produto". Se o Rubens quiser mostrar um sistema para investidor ou para vender a plataforma, isso não impressiona. É risco de percepção, não de funcionamento.

**Sem checkout, não há dado de conversão real.** Sabe-se quem tocou em "pedir", não quem pagou. Mitigação parcial: a Beth marca no painel quando entregar.

**Next.js pode ser grande demais.** Se o time for uma IA só e o volume pequeno, a complexidade pode custar mais do que a otimização de imagem devolve.

**`tenant_id` + RLS tem um ponto único de falha.** Uma política errada vaza dado entre empresas. Os testes 4 e 5 reduzem muito, mas não a zero. Banco por tenant seria mais seguro e mais caro — é um trade-off consciente, não um descuido.

**A migração dos carimbos é irreversível na percepção.** Se um cliente perder carimbo, ele não volta para reclamar: ele some. E não dá para medir quem sumiu.

**A hospedagem está indefinida** porque falta descobrir os 8,7 milhões de tokens. Se isso vier de recurso de plataforma, pode reaparecer em outra.

---

## 13. O que eu precisaria saber e não sei

1. **O que consumiu 8,7 milhões de tokens de IA na Netlify?** Muda a escolha de hospedagem.
2. **O banco de produção tem estoque cadastrado hoje?** O Codex relatou zero registros e nunca ficou claro se era produção — se for, a vitrine atual está vazia agora.
3. **Quantos dos 61 membros do Clube estão ativos?** Se forem 10, a migração é simples. Se forem 61, o cuidado muda.
4. **Existe alguma confeitaria já interessada em assinar?** Se sim, o cadastro de tenant sobe de prioridade. Se não, ele é especulação.
5. **A Beth aceita continuar operando pelo WhatsApp na fase 1?** Toda a aposta do item 10 depende disso.
6. **Quem paga a conta enquanto isso?** Supabase, hospedagem e domínio têm custo mensal, e a Adoce está endividada.


---
---

# PARTE 3 — Como avaliar

*Uso do Rubens. Não enviar às IAs que estão propondo.*

---

**12/08/2026**

---

## A armadilha da quarta IA

Sua ideia de usar uma quarta IA para avaliar é boa, mas tem um risco que precisa ser dito:

**IA julgando IA premia a mais eloquente, não a que funciona.**

A quarta IA não testa nada, não conhece a Beth, não sabe o que é 4G pré-pago em Fortaleza, e não vai pagar a conta se der errado. Se você pedir "escolha a melhor", ela vai escolher **a mais completa e mais confiante** — que costuma ser a mais longa, não a mais certa.

**A solução não é abandonar a quarta IA. É dar a ela o trabalho certo.**

| A quarta IA faz | A quarta IA NÃO faz |
|---|---|
| lê as três e monta comparação item a item | escolher a vencedora |
| aponta onde as três concordam | dar nota |
| aponta onde divergem, e o que está em jogo | decidir por você |
| transforma divergência em pergunta factual | opinar sobre gosto |
| pega contradição e afirmação não verificável | |

**A decisão continua sua.** A quarta IA faz a leitura pesada e te entrega o material organizado.

---

## O princípio que faz a avaliação funcionar

> **Onde as três concordam, provavelmente está certo. Onde divergem, é decisão sua — e cada divergência precisa virar uma pergunta de fato, não de opinião.**

Exemplo. Se uma propõe Next.js e outra Vite, a pergunta não é "qual é melhor". É:

> *"O ganho de otimização de imagem e SEO do Next compensa a complexidade extra, dado que o código é escrito por IA e o público está em 4G caro?"*

Isso você consegue responder. "Qual é melhor" você não.

---

## Os seis critérios — tirados da sua realidade, não de manual

Não avalie por "boas práticas". Avalie pelo que te machuca hoje.

### 1. Toques até o pedido
Mensurável. Menos é melhor. **Foi o que fez seu cliente desistir.**

### 2. Peso da primeira tela
Quantos KB o celular baixa para ver a vitrine. Seu cliente **paga por esse dado**. Proposta que não fala disso não entendeu o público.

### 3. Tempo até a primeira venda nova
Quantos dias até um cliente comprar pelo sistema novo. **Você tem 60 dias.** Proposta que só entrega valor no mês três chegou tarde.

### 4. Prova de isolamento entre tenants
Não "vamos usar RLS". **Como se prova que funciona, automaticamente, a cada publicação.** É responsabilidade legal.

### 5. Recuperação quando quebrar
Vai quebrar. A pergunta é como você descobre e como volta. **"Cada correção quebra dez coisas" foi o que matou o projeto anterior.**

### 6. A Beth usaria?
A régua final. Sistema que a dona evita não existe. Se a proposta não mostra que pensou nela, o resto não importa.

### 7. SEO local sem trabalho manual
Cada tenant é um negócio de bairro diferente. A arquitetura entrega endereço próprio, dados estruturados e sitemap **sozinha**, ou alguém vai ter que fazer à mão para cada cliente? E a proposta separa o que rende em semanas do que só rende em meses — ou mistura os dois e promete demais?

**Sugestão de peso:** critérios 1, 3 e 6 valem dobro. São os que decidem se a Adoce sobrevive.

---

## O prompt para a quarta IA

Cole isso, junto com as três propostas.

---

### PROMPT — Avaliador

Você recebeu **três propostas de arquitetura** para o mesmo projeto, escritas por três IAs diferentes a partir do mesmo briefing.

**Seu papel não é escolher uma vencedora.** É fazer a leitura pesada e entregar o material organizado para que o dono do projeto decida. Ele é iniciante em programação, tem 60 dias para salvar o negócio dele, e vai ser quem paga a conta se a decisão for errada.

**Não dê notas. Não eleja a melhor. Não escreva código.**

Entregue exatamente isto:

**1. Onde as três concordam**
Liste ponto a ponto. Consenso entre três raciocínios independentes é o sinal mais forte que existe aqui. Marque isso como "provavelmente resolvido".

**2. Onde divergem — e o que está em jogo**
Para cada divergência:
- o que cada proposta defende, em uma frase
- **o que teria que ser verdade** para cada opção ser a certa
- **a pergunta factual** que o dono precisa responder para decidir
- o custo de errar essa decisão, e se dá para voltar atrás depois

Este é o item mais importante da sua entrega. Divergência convertida em pergunta respondível vale mais que opinião sua.

**3. O que só uma delas viu**
Ideias que aparecem em uma proposta só. Podem ser as mais valiosas — ou as mais arriscadas. Diga qual dos dois, e por quê.

**4. Contradições e afirmações não verificáveis**
Onde uma proposta se contradiz, promete algo que não sustenta, ou afirma sem base. Cite o trecho.

**5. O que nenhuma das três resolveu**
Buracos comuns às três. É onde o dono vai ser pego de surpresa.

**6. Comparação nos seis critérios**

| Critério | Proposta A | B | C |
|---|---|---|---|
| Toques até o pedido | | | |
| Peso da primeira tela | | | |
| Dias até a primeira venda nova | | | |
| Prova de isolamento entre tenants | | | |
| Como se recupera quando quebra | | | |
| A dona da confeitaria usaria? | | | |

Se uma proposta não responde um critério, escreva **"não respondeu"** — isso é informação, não falha sua.

**7. As três perguntas que o dono precisa responder antes de qualquer código**
Só três. As que mais mudam o resultado.

**Regras:**
- Não invente consenso onde não há
- Não suavize divergência para parecer equilibrado
- Se uma proposta for claramente mais fraca num ponto, diga — mas com o motivo, não com nota
- Português claro. Quem vai ler não é engenheiro.

---

## Como usar o resultado

1. Leia o **item 1** — o que já está resolvido, não precisa decidir
2. Leia o **item 7** — três perguntas, responda
3. Volte no **item 2** e decida cada divergência com as respostas na mão
4. O **item 5** é a sua lista de risco — e o que você vai me trazer

Aí a fusão vira montagem, não debate.

---

## Uma última coisa

**Não peça a fusão para a quarta IA.**

Quem avalia não deve montar — vai puxar para o que já elogiou. Depois de você decidir as divergências, a fusão é trabalho de escrita, e pode ser feita por qualquer uma das três, ou por mim.

O que a quarta entrega é **a leitura**. A decisão é sua, e a montagem vem depois dela.
