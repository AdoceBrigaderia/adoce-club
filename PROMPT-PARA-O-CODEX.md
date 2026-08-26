# Prompt para o Codex — Clube Adoce / Adoce Brigaderia
**Preparado em 07/08/2026** · Cole o conteúdo abaixo da linha para o Codex.

---

## Contexto

Você está assumindo tarefas no projeto **Clube Adoce**, o site da Adoce Brigaderia (confeitaria em Fortaleza — CE, dois sócios: Rubens e Beth). Outro assistente trabalhou no projeto hoje, diagnosticou vários problemas e corrigiu parte deles, mas esbarrou em limites de ambiente (sem acesso de rede ao Netlify para upload, sem permissão para apagar arquivos de trava do Git no Windows, e sem credenciais para `git push`).

Este documento descreve **o estado real verificado**, não suposições. Cada número abaixo foi conferido diretamente no banco, no Git ou na API do Netlify.

---

## Estado verificado do projeto

### Ambientes

| | Produção | Homologação |
|---|---|---|
| Netlify | `adocebrigaderia` (site id `bb0c96cd-5af2-4270-a9a8-b63b9637b1f4`) | `adoce-homologacao` (site id `f0cc51be-a0ec-4451-9644-a394592cdc37`) |
| Domínio | www.adocebrigaderia.com.br | adoce-homologacao.netlify.app |
| Supabase | `uefwywizqhfvvijaopcn` | `vazozolhbehnriytzcdc` |
| Migrações aplicadas no banco | **58** (última `20260723124000`) | **151** (última `20260807063009`) |
| Funções publicadas | 12 | 23 |
| Origem do deploy | CLI (manual) | GitHub, branch `homologacao-adoce` |

### O problema estrutural (causa raiz de quase tudo)

O repositório tem **8 worktrees** registradas, cada uma numa branch diferente, várias apontando para pastas que provavelmente não existem mais:

```
D:/Clube Adoce                                → fonte-oficial/portal-adoce-2026-07-25  (cópia de trabalho atual)
D:/Clube Adoce Homologacao                    → codex/novo-portal-homologacao          (prunable)
D:/Clube Adoce Homologacao Snapshot           → detached                               (prunable)
D:/Clube Adoce Hotfix                         → codex/hotfix-live-orders               (prunable)
D:/Clube Adoce LAN Candidate                  → detached                               (prunable)
D:/Clube Adoce Patch Homologacao 20260807     → fix/catalogo-fotos-e-home-story-...    (prunable)
D:/Clube Adoce Redesign V2                    → homologacao/redesign-aprovado-v2       (prunable)
D:/Clube Adoce Verificacao Release 20260807   → detached                               (prunable)
```

E **3 remotes apontando para 2 repositórios GitHub diferentes**:
- `adoce-oficial` → `AdoceBrigaderia/adoce-club` ← **o oficial, confirmado pelo Rubens**
- `fonte-oficial` → `RMBPS/adoce-club`
- `origin` → `RMBPS/clube-adoce`

**Divergência concreta:**
- Branch `adoce-oficial/homologacao-adoce` (commit `123f715`, 29/07): **140 migrações**, última `20260728225000`
- Cópia de trabalho local (não commitada): **152 migrações**, última `20260807120000`
- Banco de homologação: **151 migrações aplicadas**

Ou seja: **o banco de homologação está à frente da branch que o Netlify publica.** O código mais novo existe apenas na cópia de trabalho local, sem commit. `src/AdoceHoje.tsx` diverge em 2.428 linhas entre a branch e a cópia local.

### Ruído de fim de linha

A cópia local mostra **306 arquivos alterados**, dos quais **137 modificados**. Verificado byte a byte: a maioria é apenas `LF` → `CRLF` (provavelmente causado por `continuar_consolidacao_fonte_oficial.ps1`). Exemplo: `netlify.toml` aparece com 48 linhas alteradas e o conteúdo é idêntico. `git config core.autocrlf` está vazio e **não existe `.gitattributes`**.

---

## Tarefas

### 1. Diagnóstico das linhagens (fazer primeiro, sem alterar nada)

Determine qual linhagem de código é a correta para seguir. Compare:
- `adoce-oficial/homologacao-adoce`
- a cópia de trabalho local em `D:/Clube Adoce`
- as branches `homologacao/redesign-aprovado-v2` e `fix/catalogo-fotos-e-home-story-2026-08-06`

Critério objetivo: **a linhagem correta é a que bate com as 151 migrações aplicadas no banco de homologação** e que contém as funções Netlify do catálogo Meta (`meta-catalog-*`, `meta-instagram-webhook`).

**Entregue um relatório antes de mexer em qualquer coisa.**

### 2. Normalizar fim de linha

Criar `.gitattributes` na raiz com `* text=auto` (e `*.png binary`, `*.jpg binary`, `*.webp binary`), rodar `git add --renormalize .` e commitar isso **isolado**, num commit só, para não misturar com mudanças de conteúdo.

### 3. Limpar worktrees órfãs

```
git worktree prune
git branch -D adoce/melhorias-07-08
```

A branch `adoce/melhorias-07-08` e a worktree `/tmp/adoce-wt` foram criadas hoje pelo assistente anterior e **devem ser apagadas** — não contêm nada de valor. Se houver arquivos de trava em `.git/worktrees/`, apague-os manualmente.

### 4. Publicar o trabalho de hoje em homologação

Estes **12 arquivos** estão na cópia de trabalho local, testados (typecheck limpo, **295 de 295 testes passando**, `npx vite build` limpo). Precisam chegar na branch que o Netlify de homologação publica:

**Novos:**
```
src/adoce-tokens.css
src/pickup-window.ts
src/pickup-window.test.ts
src/RequestQuoteDocument.tsx
src/request-quote-document.css
src/request-quote-document.test.ts
supabase/migrations/20260807120000_release_production_all_channels.sql
```

**Modificados:**
```
src/main.tsx
src/AdoceHoje.tsx
src/InstantOrderPanel.tsx
src/WeeklyMenuAdmin.tsx
src/OperationCommercialAdmin.tsx
```

⚠️ **As edições em `AdoceHoje.tsx`, `InstantOrderPanel.tsx`, `WeeklyMenuAdmin.tsx` e `OperationCommercialAdmin.tsx` são pequenas** (poucas linhas cada). Se a linhagem escolhida na tarefa 1 for diferente da cópia local, **reaplique as edições sobre a versão correta** em vez de sobrescrever o arquivo inteiro. Sobrescrever apagaria trabalho.

O que cada mudança faz:

- **`adoce-tokens.css` + `main.tsx`** — arquivo único de tokens com a paleta correta da logo (rosa antigo `#f8dad3`, terra `#a9564a`, dourado `#e8c9a8`, marrom `#3d1f14`). Existiam **109 variáveis CSS em 68 arquivos** para ~15 cores (o rosa tinha 7 nomes: `--pink`, `--access-coral`, `--m-coral`, `--public-coral`, `--c-coral`, `--customer-pink`, `--adoce-pink`). O arquivo mantém todos os nomes antigos como apelidos apontando para os novos, então as 68 folhas recebem a paleta correta sem reescrita. **Importado por último em `main.tsx` de propósito** — precisa vencer o `:root` do `theme.css`. Inclui também `min-height: 44px` para botões no mobile e `100dvh`.

- **`pickup-window.ts` + teste + `AdoceHoje.tsx` + `InstantOrderPanel.tsx`** — o campo de horário de retirada era `<input type="time">` livre, sem `min`/`max`, e a validação só checava se estava vazio. Cliente conseguia reservar para 14h num dia em que a loja abre 19h30. Agora a janela vem de `business_hours` do canal `in_person`. 10 testes.

- **`WeeklyMenuAdmin.tsx` + migração `release_production_all_channels`** — **este é o bug que manteve a loja "esgotada" de 28/07 a 07/08.** Havia três travas de canal: o botão só aparecia na aba "pedidos online", só contava itens desse canal, e a função `staff_release_weekly_production` filtrava `channel_slug = 'online_orders'` no banco. A produção de 31/07 e 01/08 foi planejada no canal `in_person` (78 fatias) e o botão nunca a enxergou. A migração remove o filtro. **Já aplicada em homologação** (nome `release_production_all_channels`); falta aplicar em produção.

- **`RequestQuoteDocument.tsx` + CSS + teste + `OperationCommercialAdmin.tsx`** — a gaveta de pedido da operação **nunca renderizava** `selections.preferences` nem `customer_notes`. O pedido da cliente Gabriela (`ADO-2026-000011`: "100 docinhos — 25 ninho, 25 brigadeiro, 25 beijinho e 25 nesquik" + "É para aniversário, se puder por favor fazer alguns carimbos") era invisível na tela. Agora aparece em bloco destacado, e o botão A4 gera um orçamento próprio em vez de imprimir o formulário. 7 testes.

Depois do push, **confirme que o deploy do Netlify passou** e informe a URL.

### 5. Verificação

Rode e reporte: `npx tsc -b`, `npx vitest run`, `npx vite build`.
Confirme que continua **295/295**.

---

## O que NÃO fazer

🚫 **Não aplique migrações no banco de produção `uefwywizqhfvvijaopcn`.** Há 93 migrações pendentes lá, incluindo endurecimento de segurança importante. **O Rubens decidiu hoje, explicitamente, que isso fica para depois.** Não contorne essa decisão.

🚫 **Não faça deploy em produção** (`adocebrigaderia` / www.adocebrigaderia.com.br).

🚫 **Não apague branches** além da `adoce/melhorias-07-08`, sem perguntar. Várias podem conter trabalho não reconciliado.

🚫 **Não commite os 137 arquivos de fim de linha junto com mudanças de conteúdo.** Commit separado (tarefa 2).

🚫 **Não altere as variáveis de ambiente do Mercado Pago** — `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `VITE_MP_PUBLIC_KEY` no projeto `adoce-homologacao`. O Rubens acabou de configurá-las à mão com as credenciais de **teste**.

---

## Perguntas para responder de volta

1. Qual linhagem de código é a correta, e por quê? (com evidência: migrações e funções Meta)
2. As branches `homologacao/redesign-aprovado-v2` e `fix/catalogo-fotos-e-home-story-2026-08-06` contêm trabalho que ainda não está em lugar nenhum?
3. Depois de reconciliar, quantas migrações a branch de homologação passa a ter? (esperado: 152)
4. As pastas `D:/Clube Adoce Homologacao`, `Hotfix`, `Redesign V2` etc. ainda existem no disco?
5. O deploy de homologação passou? Qual a URL para o Rubens testar no celular?

---

## Contexto de negócio (para você não quebrar regras que importam)

- **A 14ª fatia do Clube Adoce é presente, nunca desconto.** Não deve aparecer como cupom nem como valor negativo em lugar nenhum.
- **Mensagens ao cliente** são cordiais, explicam o porquê do que pedem, e terminam com 💗. Nunca linguagem de sistema.
- **Retirada:** Cantinho da Adoce (Av. da Saudade, S/N) abre 19h30 (qui/sex) e 18h (sáb), fecha 22h todos os dias. Reservas online 09h–22h. A fábrica (Rua Professor Odílio Filho, 227) é retirada de exceção, liberada caso a caso.
- **Capacidade de encomendas:** 300 docinhos/dia, 5 tortas/dia (já contando a produção do festival), dia de Adoce na Escola é exclusivo. Prazo de 3 dias úteis para data garantida; menos que isso, ou sexta/sábado, exige avaliação manual.
- **Festival (produção fixa de tortas):** terça 3, quarta 3, quinta 6, sexta 8, sábado 8.
