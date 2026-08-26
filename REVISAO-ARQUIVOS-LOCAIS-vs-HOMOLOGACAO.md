# Revisão: arquivos locais × homologação publicada (`d3fd830`)
**09/08/2026** · Somente leitura. Nada foi alterado, movido, commitado, publicado ou executado.

Confirmei os seus números: **215 arquivos fora do Git**, sendo **36 idênticos**, **108 diferentes** e **71 inexistentes** na homologação. Este relatório cobre os **179** que não são cópias idênticas.

---

## A conclusão que muda tudo

**O conteúdo local não é uniformemente mais novo que o publicado.** Em alguns arquivos o local está à frente; em outros, o publicado evoluiu e o local ficou para trás.

Subir tudo causaria **regressão**, não avanço. Dois exemplos concretos, com evidência:

| Arquivo | Publicado (`d3fd830`) | Local | Quem está à frente |
|---|---|---|---|
| `src/pickup-window.ts` | `pickupWindowForDay()` devolve **uma** janela | `pickupWindowsForDay()` devolve **lista** e recusa o vão entre janelas | **local** |
| `src/ConnectedClubSummary.tsx` | `fetch("/api/customer-club-summary")` — passa pelo BFF | `.from("profiles")`, `.from("loyalty_tracks")` — acesso direto às tabelas | **publicado** |

O segundo caso é o mesmo defeito que derrubou o painel do dia (`permission denied for table instant_orders`). Subir a versão local do Clube reintroduziria esse erro.

---

## 1. Migrações — 85 arquivos

### 1.1 · 82 migrações: diferença **apenas de fim de linha**

```
20260725213624_central_image_placeholders.sql  …até…  20260807063009_recurring_weekly_service_menu_rules_20260803.sql
```
(lista completa: todas as `supabase/migrations/*.sql` diferentes, exceto as três do item 1.2)

- **Categoria:** migration
- **O que faz:** nada de novo — é o mesmo SQL, byte a byte, depois de normalizar CRLF/LF
- **Necessário?** não. Já estão aplicadas em homologação
- **Dependências:** nenhuma
- **Risco:** **baixo** para o banco, **médio** para o histórico — regravar arquivo de migração já aplicada suja o diff e pode confundir a reconciliação
- **Recomendação:** **não subir**
- **Evidência:** `git show d3fd830:<arquivo> | tr -d '\r' | diff - <(tr -d '\r' < <arquivo>)` → vazio nas 82

### 1.2 · 3 migrações: a **publicada está corrompida**, a local está correta

```
20260804185307_slice_availability_alerts.sql
20260807062957_meta_catalog_sync_20260731.sql
20260807063006_instant_order_payment_guard_20260803.sql
```

- **Categoria:** migration
- **O que faz:** a diferença é **só acentuação em comentários e em `comment on`**. O publicado tem `n?o`, `Sincroniza??o`, `p?blico`; o local tem o texto correto
- **Necessário?** não para funcionar. Sim para a documentação do banco não ficar ilegível
- **Risco:** **médio** — são migrações **já aplicadas**. Reescrevê-las não muda o banco (o `comment on` já rodou) e pode conflitar com o histórico remoto
- **Recomendação:** **não subir como alteração de migração.** Se o texto dos comentários importa, corrigir por migração **nova**, o que este pedido proíbe — então fica registrado como dívida
- **Evidência:** diff mostra apenas linhas de comentário; nenhuma instrução DDL/DML diverge

> ⚠️ Estas três provam que **a corrupção de acentuação entrou no repositório publicado**, não só na tela. O `.gitattributes` do commit `d3fd830` ("Build: proteger fontes UTF-8") é posterior ao estrago.

---

## 2. Catálogo Meta / Instagram — 13 arquivos

```
netlify/functions/_meta-catalog-service.ts     netlify/functions/_meta-catalog.ts
netlify/functions/meta-catalog-history.ts      netlify/functions/meta-catalog-product-status.ts
netlify/functions/meta-catalog-product-sync.ts netlify/functions/meta-catalog-retry-errors.ts
netlify/functions/meta-catalog-status.ts       netlify/functions/meta-catalog-sync.ts
netlify/functions/meta-instagram-webhook.ts    src/MetaCatalogAdmin.tsx
src/meta-catalog.test.ts                       src/meta-catalog-migration.test.ts
docs/19-integracao-catalogo-meta.md            docs/20-integracao-instagram.md
```

- **Categoria:** correção de funcionalidade publicada (acentuação) + **divergência arquitetural** no `MetaCatalogAdmin`
- **O que faz:** nas funções, a diferença é **só acentuação em mensagens de erro** (`M?todo n?o permitido` → `Método não permitido`). Essas mensagens chegam ao usuário
- **Atenção no `MetaCatalogAdmin.tsx`:** além da acentuação, o **publicado importa `metaCatalogRequest` de `./services/meta-catalog-admin`** e o local não. O publicado passa pelo serviço; o local chama direto. **O publicado está à frente**
- **Necessário?** as funções, não; a correção de texto, sim, para o cliente não ler `n?o`
- **Dependências:** as 9 funções podem ir juntas; o `MetaCatalogAdmin` **não**
- **Risco:** **baixo** nas 9 funções (só string), **alto** no `MetaCatalogAdmin` (regressão arquitetural)
- **Recomendação:** **subir em pacote** as 9 funções + os 2 testes · **não subir** `MetaCatalogAdmin.tsx` · **pode subir** os 2 docs
- **Evidência:** `git show d3fd830:src/MetaCatalogAdmin.tsx | grep metaCatalogRequest` retorna import que **não existe** no local

---

## 3. Janela de retirada — pacote fechado

```
src/pickup-window.ts        src/pickup-window.test.ts
src/AdoceHome.tsx
```

- **Categoria:** funcionalidade nova / correção de bug real
- **O que faz:** o publicado devolve **uma** janela por dia. O local devolve **lista** e **recusa o vão entre janelas** — o caso "fábrica de dia + Cantinho à noite", que hoje aceita horário impossível
- **Necessário?** sim. É bug ativo no site publicado
- **Dependências:** ⚠️ **quebra a compilação se for sozinho.** `pickupWindowForDay` deixa de existir. Precisam entrar juntos, e **todos os consumidores** precisam ser adaptados no mesmo commit: `AdoceHome.tsx`, e verificar `AdoceHoje.tsx` e `InstantOrderPanel.tsx` no branch
- **Risco:** **médio** — a mudança é boa, a coordenação é o risco
- **Recomendação:** **subir em pacote**
- **Evidência:** exports do publicado × local, listados acima; `AdoceHome` local já importa `pickupWindowsForDay`

---

## 4. Clube do cliente — **não subir**

```
src/AdoceClube.tsx        src/ConnectedClubSummary.tsx
```

- **Categoria:** cópia antiga
- **O que faz:** o local consulta `profiles`, `account_memberships` e `loyalty_tracks` **direto do navegador**. O publicado busca `/api/customer-club-summary`
- **Necessário?** não. O publicado já faz melhor
- **Risco:** **alto** — reintroduz acesso direto a tabela, que é exatamente o que produziu `permission denied` no painel do dia
- **Recomendação:** **arquivar/excluir** a versão local
- **Evidência:** `ConnectedClubSummary` publicado usa `fetch("/api/customer-club-summary")`; o local usa `.from("profiles")`

---

## 5. Acentuação em telas publicadas — pacote seguro

```
src/RequestQuoteDocument.tsx   src/request-quote-document.test.ts
src/adoce-tokens.css
```

- **Categoria:** correção de funcionalidade publicada
- **O que faz:** o orçamento impresso hoje sai com `Or?amento`, `hor?rio`, `Confeitaria artesanal ? Fortaleza ? CE`. O local tem o texto correto. No `adoce-tokens.css` a diferença é **só em comentário**
- **Necessário?** sim — esse documento vai para o cliente
- **Dependências:** o teste acompanha o componente
- **Risco:** **baixo** — nenhuma lógica muda
- **Recomendação:** **pode subir** (`adoce-tokens.css` é opcional, cosmético)

---

## 6. Funções de aviso — nada a fazer

```
netlify/functions/alerta-pedidos.ts     netlify/functions/alerta-telegram.ts
```

- **Categoria:** funcionalidade já publicada
- **O que faz:** diferença de **uma linha em branco** no fim. Funcionalmente idênticos
- **Risco:** baixo, mas sem ganho
- **Recomendação:** **não subir**
- **Evidência:** `diff` → `188d187 <` (linha vazia)

> Registro: estas funções **existem em homologação** e **não existem em produção** — produção está no deploy de 31/07. O problema do Telegram de sábado é ausência de deploy, não ausência de arquivo.

---

## 7. Os 71 arquivos que não existem na homologação

### 7.1 · Documentação e evidência — 24 arquivos

Todos os `.md` da raiz e `docs/19`, `docs/20`: análises, guias, planos, prompts, auditoria, inventário, limpeza.

- **Categoria:** documentação/evidência
- **Necessário?** não para o site funcionar. Sim para não se perder o histórico das decisões
- **Risco:** **baixo** — não entram no build
- **Recomendação:** **pode subir**, de preferência numa pasta `docs/`

### 7.2 · ⚠️ `CHAVES-WEB-PUSH.txt` — risco de credencial

- **Categoria:** configuração com **segredo**
- **Conteúdo:** par de chaves VAPID, incluindo **chave privada**. Não reproduzo o valor
- **Risco:** **alto.** Se for commitado, a chave privada entra no histórico do Git para sempre
- **Recomendação:** **não subir. Apagar do disco** depois de confirmar que as variáveis do Netlify estão preenchidas — elas estão, conferi em produção e homologação

### 7.3 · 40 arquivos vindos do branch de backup

```
src/SliceMenuPage.tsx           src/OperationSliceAlerts.tsx    src/PublicMobileNav.tsx
src/PublicCatalogNav.tsx        src/ProductImageViewer.tsx      src/SliceAvailabilityAlert.tsx
src/lib/thermal-printer.ts      src/order-whatsapp.ts           src/image-fit-analysis.ts
src/lib/client-id.ts            netlify/functions/request-email-code.ts
netlify/functions/verify-email-code.ts   scripts/qa-homologation.cjs
+ os CSS 2026 (adoce-app-2026, adoce-mobile-first-2026, public-shell-2026, public-visual-2026,
  home-reference-2026, commercial-reference-2026, customer-account-reference-2026, operation-v3,
  customer-v3, public-mobile-nav, public-mobile-fixes, public-catalog-nav, slice-menu-page,
  product-image-viewer, slice-availability-alert, operation-slice-alerts, commercial-gallery,
  instant-order-empty, today-availability-compact)
+ os testes correspondentes
+ 4 imagens em public/site/
```

- **Categoria:** **desconhecido / possivelmente aposentado**
- **Evidência decisiva:** o último commit de cada um está em **`backup/homologacao-20260807-antes-restauracao-producao`** — o branch salvo **antes** da restauração de 07/08. **Estes arquivos foram deliberadamente deixados de fora, não esquecidos.**
- **O que fazem:** há coisas potencialmente valiosas aqui — `thermal-printer.ts` (impressão térmica), `order-whatsapp.ts` (montagem de mensagem de pedido), `SliceAvailabilityAlert` (avisar quando o sabor voltar — a Annaliza e a Juliana são candidatas), `request/verify-email-code` (código por e-mail)
- **Risco:** **alto** — são de um estado revertido; podem depender de tabelas, rotas ou componentes que não existem mais. Os CSS `-2026` são justamente uma **quarta linguagem visual**, e subi-los agravaria a mistura que o Rubens apontou
- **Recomendação:** **exigem decisão do Rubens**, um a um. Nenhum entra em pacote automático

### 7.4 · 4 imagens em `public/site/`

```
portal-entry-fatias.png   trufado-de-ninho-home.png
trufado-de-ninho-home-single.png   trufado-de-ninho-home-20260803.png
```
Três variações do mesmo assunto sugerem tentativa. **Não subir** sem alguém dizer qual é a boa.

---

## Lista 1 — Podem subir já para homologação

| Arquivo | Motivo |
|---|---|
| `netlify/functions/meta-catalog-history.ts` | corrige acentuação de mensagem ao usuário |
| `netlify/functions/meta-catalog-product-status.ts` | idem |
| `netlify/functions/meta-catalog-product-sync.ts` | idem |
| `netlify/functions/meta-catalog-retry-errors.ts` | idem |
| `netlify/functions/meta-catalog-status.ts` | idem |
| `netlify/functions/meta-catalog-sync.ts` | idem |
| `netlify/functions/meta-instagram-webhook.ts` | idem |
| `netlify/functions/_meta-catalog.ts` | idem |
| `netlify/functions/_meta-catalog-service.ts` | idem |
| `src/meta-catalog.test.ts` | acompanha os acima |
| `src/meta-catalog-migration.test.ts` | acompanha os acima |
| `src/RequestQuoteDocument.tsx` | orçamento do cliente sai com `Or?amento` hoje |
| `src/request-quote-document.test.ts` | acompanha o componente |
| `src/adoce-tokens.css` | só comentário; cosmético |
| `docs/19-integracao-catalogo-meta.md` | documentação |
| `docs/20-integracao-instagram.md` | documentação |
| 22 documentos `.md` da raiz | documentação, fora do build |

**Nenhum destes reintroduz campanha ou andaime.** Verificado: não existe menção a `SocialCampaign`, `LaunchCampaign`, `launch-campaign.css`, `social-campaign.css`, `HomologationVisualNavigator` ou `HomologationValidationBanner` em nenhum arquivo desta lista.

---

## Lista 2 — Pacotes que só sobem juntos

**Pacote A — janela de retirada**
```
src/pickup-window.ts
src/pickup-window.test.ts
src/AdoceHome.tsx
+ adaptar no branch: AdoceHoje.tsx, InstantOrderPanel.tsx (e qualquer outro consumidor)
```
Sozinhos, quebram a compilação: `pickupWindowForDay` deixa de existir.

**Pacote B — catálogo Meta**
As 9 funções + os 2 testes da Lista 1. Coerência de mensagens.

---

## Lista 3 — Cópias antigas, descartáveis ou aposentadas

| Arquivo | Motivo |
|---|---|
| 82 migrações com diferença só de CRLF | já aplicadas; regravar suja o histórico |
| `netlify/functions/alerta-pedidos.ts` | difere em uma linha em branco |
| `netlify/functions/alerta-telegram.ts` | idem |
| `src/AdoceClube.tsx` | publicado está à frente (BFF) |
| `src/ConnectedClubSummary.tsx` | publicado está à frente (BFF) |
| `src/MetaCatalogAdmin.tsx` | publicado usa `metaCatalogRequest`; local não |
| `CHAVES-WEB-PUSH.txt` | **contém chave privada — apagar do disco** |

---

## Lista 4 — Exigem decisão do Rubens

| Item | Pergunta |
|---|---|
| 40 arquivos do branch `backup/…antes-restauracao-producao` | foram deixados de fora de propósito na restauração de 07/08. Voltam? Quais? |
| `src/lib/thermal-printer.ts` + teste | já existe impressão térmica escrita. Conversa com a `FichaTermica` nova ou é caminho paralelo? |
| `src/SliceAvailabilityAlert.tsx` + `OperationSliceAlerts.tsx` + CSS + migração `20260804185307` | avisar cliente quando o sabor voltar. **A Annaliza falhou duas vezes com Abacaxi com Coco.** Vale reativar? |
| `netlify/functions/request-email-code.ts` / `verify-email-code.ts` | login por código de e-mail. A decisão registrada é "só WhatsApp". Confirma que morre? |
| 19 arquivos CSS `-2026` / `-v3` | são uma quarta linguagem visual. Entram na migração visual ou são descartados? |
| `src/AdoceEntrar.tsx` | 33 linhas de diferença; a tela está escondida em `#entrar-novo` e o login por WhatsApp não funciona. Qual versão vale? |
| 4 imagens `public/site/` | três variantes do mesmo assunto. Qual é a boa? |
| `src/order-whatsapp.ts` + teste | monta mensagem de pedido pelo WhatsApp — pode ser exatamente o que faltou sábado |
| 3 migrações com acentuação corrompida no publicado | corrigir por migração nova (fora do escopo deste pedido) ou deixar como dívida? |

---

## Verificação final pedida

Comparei o conjunto local com `d3fd830` e confirmo: **nenhum arquivo da Lista 1 ou dos Pacotes A e B reintroduz `SocialCampaign`, `LaunchCampaign`, `launch-campaign.css`, `social-campaign.css` ou os andaimes de homologação.** As campanhas aposentadas não voltam por esta via.

Registro adicional: o branch `adoce-oficial/homologacao-adoce` já avançou dois commits além de `d3fd830` — `974cff3` e `b78dea2`, ambos removendo telas legadas da operação. Qualquer subida deve partir do topo atual, não de `d3fd830`.
