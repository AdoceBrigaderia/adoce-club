# Gestão Cookie — proposta de arquitetura
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
