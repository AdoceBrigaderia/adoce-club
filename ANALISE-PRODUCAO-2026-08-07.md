# Análise do site em produção — Adoce Brigaderia / Clube Adoce
**Data:** 07/08/2026 · **Base:** código local, Supabase de produção (`uefwywizqhfvvijaopcn`), Netlify (`adocebrigaderia`), dados reais de uso.

---

## 1. O que existe hoje (fato, não documentação)

| Item | Estado |
|---|---|
| Produção | `adocebrigaderia.com.br` — Netlify, deploy `ready` |
| Homologação | **Já existe**: Netlify `adoce-homologacao` + Supabase `Clube Adoce - Homologacao` |
| Stack | React + Vite (SPA), TypeScript, Supabase, 23 Netlify Functions, 0 Edge Functions |
| Tamanho do front | 145 arquivos `.ts/.tsx`, ~22.500 linhas |
| CSS | **68 arquivos**, ~500 KB de folhas de estilo |
| Maior arquivo | `AccessApp.tsx` — **4.820 linhas** (clube + operação no mesmo arquivo) |
| Banco | 53 tabelas, todas com RLS ligado |
| Roteamento | Por hash (`#adoce-hoje`, `#encomendas`…), sem router de verdade |

### Dados reais de uso (produção)

- **75 clientes cadastrados**, sendo **47 nos últimos 14 dias** — o cadastro está funcionando bem.
- 85 lançamentos no ledger de fidelidade, 1.682 eventos de analytics.
- **6 pedidos imediatos** e **9 solicitações comerciais** no total.

### Funil real do "Adoce Hoje" (fatias)

```
305 visualizações da página
 → 27 abriram o pedido      (8,9%)
 → 18 iniciaram              (5,9%)
 →  5 concluíram             (1,6%)   ← último em 25/07, há 13 dias
```

Em paralelo: **80 cliques no WhatsApp** na mesma página. Ou seja, **as pessoas estão pedindo, mas não pelo site** — elas usam o site como cardápio e fecham no WhatsApp. Esse é o número mais importante deste relatório.

Encomendas: 81 visualizações → 16 `prebook_start` (20%, bem melhor que fatias).
Festas/eventos/escola/aluguel: 47 visualizações somadas (**~3% do tráfego**) — já é residual. **O dado confirma sua decisão de despriorizar.** Não precisa de coragem, só de execução.

---

## 2. Problemas críticos (resolver antes de qualquer melhoria)

### 🔴 Vazamento de token de sessão
Existem **7 registros** em `site_analytics_events` com o `page_path` contendo um **JWT de acesso completo** (`/#access_token=eyJ...`). O analytics está gravando a URL bruta depois do login social, incluindo o token. Qualquer um com leitura nessa tabela consegue a sessão do cliente.
**Correção:** sanitizar `page_path` antes de gravar (cortar tudo após `#access_token`/`?code`), purgar os registros existentes, e limpar a URL logo após o retorno do OAuth.

### 🔴 4 tabelas com RLS ligado e **nenhuma política**
`outbox_events`, `pilot_customers`, `pilot_transactions`, `whatsapp_verification_challenges`. RLS ligado sem política bloqueia tudo — mas indica descuido e pode quebrar fluxos silenciosamente.

### 🟠 18 funções `SECURITY DEFINER` executáveis por `anon`
Cada uma é uma porta aberta sem login. Precisa de auditoria uma a uma: as que realmente devem ser públicas (`record_site_analytics_event`, `submit_service_request`) e as que não devem.

### 🟠 5 versões da mesma função em produção
`submit_instant_order`, `_v2`, `_v3`, `_v4`, `_v5` coexistem no banco. Ninguém sabe qual está viva. Isso é dívida técnica perigosa.

### 🟠 Proteção contra senha vazada desativada no Supabase Auth
Um clique para ligar.

### 🟠 SEO: o Google enxerga **uma única página**
Com roteamento por hash, `#encomendas`, `#cardapio-fatias` e `#docinhos` **não existem para o Google**. Para um negócio que quer vender fatias e encomendas por busca, isso é a maior perda comercial silenciosa do site.

---

## 3. Catálogo Instagram + WhatsApp — você já tem 80% pronto

Isto foi a maior surpresa da análise. **O código da integração já existe:**

- 10 Netlify Functions: `meta-catalog-sync`, `-status`, `-history`, `-reconcile`, `-retry-errors`, `-product-sync`, `-product-status`, `_meta-catalog-service.ts`
- Webhooks prontos: `meta-instagram-webhook.ts`, `meta-whatsapp-webhook.ts`
- Painel na operação: `MetaCatalogAdmin.tsx` (status, histórico, sync manual)
- Documentação: `docs/19-integracao-catalogo-meta.md`, `docs/20-integracao-instagram.md`
- Testes: `meta-catalog.test.ts`, `meta-catalog-migration.test.ts`, `meta-instagram-webhook.test.ts`

**MAS:** não existe **nenhuma tabela `meta_*` no banco de produção.** A migração nunca foi aplicada. A integração está escrita, testada em unidade, e **desligada**.

Então isso não é "construir do zero" — é **terminar e ligar**:

1. Aplicar a migração das tabelas Meta (em homologação primeiro).
2. Configurar as variáveis de ambiente no Netlify (App ID, token, Catalog ID, verify token do webhook).
3. Rodar o `full_sync` e conferir no Commerce Manager.

**O que só você pode resolver (fora do código):**
- Conta comercial Meta + Página do Facebook vinculada ao Instagram profissional
- Catálogo criado no **Commerce Manager**
- **WhatsApp Business Platform** (API) — o WhatsApp Business normal do celular *não* sincroniza catálogo por API
- Revisão do app pela Meta para as permissões `catalog_management` / `instagram_shopping`

**Aviso realista:** o Instagram Shopping (checkout/tag de produto) tem aprovação lenta e regras rígidas para alimentos. O catálogo do **WhatsApp** é bem mais rápido de aprovar e, no seu caso, provavelmente vende mais — já que 80 pessoas por período estão indo pro WhatsApp de qualquer jeito.

---

## 4. Reconstruir do zero em homologação? **Não. E explico por quê.**

Sua intuição de que "está bagunçado" está certa. Mas a bagunça não está onde parece.

**O que tem valor real e levaria meses para refazer:**
- 53 tabelas com RLS, políticas, ~60 funções RPC de negócio, auditoria e ledger
- 23 Netlify Functions (login por telefone, código por e-mail, segurança de conta, rollback, Meta)
- ~40 arquivos de teste
- Regras de negócio que já sobreviveram a uso real

**O que realmente dói:**
- 68 arquivos CSS sem sistema (`public-site.css`, `public-visual-2026.css`, `adoce-mobile-first-2026.css`, `home-reference-2026.css`… são camadas históricas se sobrescrevendo)
- `AccessApp.tsx` com 4.820 linhas fazendo clube e operação
- Roteamento por hash
- Código morto: `LegacyApp`, `PilotApp`, `operation-v2`, `DirectorPlanChecklist`, campanhas sociais

**Nenhum desses quatro problemas é resolvido por um banco novo.** Todos são do front-end e se resolvem por refatoração — com o site vendendo enquanto isso.

### Sobre "aproveitar só clientes e produtos"

**Não faça.** Isso jogaria fora os 85 lançamentos do ledger de fidelidade — ou seja, **os carimbos dos seus 75 clientes**. Um cliente que juntou 11 carimbos e voltar a ver zero não reclama: ele só não volta. O programa de fidelidade é o ativo mais frágil do negócio, e a confiança nele não se remigra.

### O que eu recomendo no lugar

**Reset seletivo do banco por migration**, não banco novo:
- Apagar as tabelas de protótipo: `pilot_customers`, `pilot_transactions`, `project_decision_reviews`
- Deletar 4 das 5 versões de `submit_instant_order`
- Fechar as permissões `anon` das funções
- Manter tudo que é vivo

**Homologação como bancada de trabalho** (você já tem os dois ambientes montados): refazer a camada visual e a navegação lá, com uma cópia do banco de produção, e promover em blocos.

---

## 5. Plano proposto — 5 fases

### Fase 0 — Segurança (2–3 dias) · **inegociável**
Sanitizar analytics e purgar tokens · políticas nas 4 tabelas · auditar as 18 funções `anon` · limpar as versões duplicadas · ligar proteção de senha vazada.

### Fase 1 — Fundação visual (1–2 semanas)
Um único arquivo de tokens (cor, tipografia, espaço, raio, sombra) → consolidar os 68 CSS em ~8 · mobile-first de verdade (área de toque ≥44px, `dvh` em vez de `vh`, safe-area do iPhone) · componentes base reutilizados (botão, card de produto, sheet, chip).
*Resultado:* toda tela nova nasce no mesmo estilo — inclusive as de festa, que você quer discretas mas coerentes.

### Fase 2 — Foco em venda (2 semanas) · **maior retorno**
- **Rotas reais** no lugar de hash (`/fatias`, `/encomendas`) — abre o Google, que hoje só vê a home
- **Home vira vitrine de fatias**: o que tem hoje, preço, e "Pedir" acima da dobra. Sem carrossel institucional antes do produto.
- **Reduzir o pedido a menos passos.** Hoje 27 abrem e 5 concluem. A meta é dobrar isso.
- **Assumir o WhatsApp em vez de brigar com ele:** botão "Pedir pelo WhatsApp" que **monta a mensagem já com os itens escolhidos**. Você não perde o pedido nem o dado.
- **Festas/eventos/escola/aluguel:** sair da navegação principal, virar uma página só ("Outros serviços"), mesmo estilo visual, sem destaque. Zero código apagado — só reposicionado. Reversível.

### Fase 3 — Catálogo Meta (1–2 semanas de código + o tempo da Meta)
Aplicar migração → configurar credenciais → sync em homologação → produção. Fazer o **WhatsApp primeiro**, Instagram depois.

### Fase 4 — Operação e logins (2 semanas)
- Hoje existem **5 formas de entrar**: telefone+senha, e-mail+código, Google, Facebook, código de staff. É superfície de ataque e de suporte demais. Recomendo: **cliente = telefone + código** (é como ele já pensa) e **operação = e-mail + senha + 2FA**, separando de vez os dois mundos.
- Operação: painel do dia em uma tela só (fila de pedidos, estoque de fatias, alertas), pensado para celular no balcão.

### Fase 5 — Quebra do `AccessApp` (contínua)
Fatiar os 4.820 linhas em módulos separados de cliente e operação, sem parar o site.

---

## 6. Resumo direto

| Pergunta | Resposta |
|---|---|
| É possível integrar Instagram/WhatsApp? | **Sim — e o código já existe.** Falta migrar, configurar e a Meta aprovar. |
| É necessário reconstruir do zero? | **Não.** O banco e as funções são o ativo. O problema é o front. |
| Vale banco novo aproveitando só clientes/produtos? | **Não.** Perderia os carimbos dos 75 clientes. Limpeza por migration resolve. |
| O que é descartável? | `LegacyApp`, `PilotApp`, `operation-v2`, `DirectorPlanChecklist`, campanhas sociais, tabelas `pilot_*`, `project_decision_reviews`, 4 versões de `submit_instant_order`, ~60 dos 68 CSS. |
| Onde está o maior retorno? | **Fase 2.** Rotas reais (SEO) + pedido mais curto + WhatsApp pré-preenchido. |
| Onde está o maior risco? | **Fase 0.** O token de sessão vazado no analytics. |

---

## 7. O que ainda não verifiquei

Esta análise é de **código, banco e dados de uso**. Não inspecionei o site renderizado no celular — para isso preciso da extensão do Chrome conectada, ou de prints seus das telas principais. É o passo que falta para eu apontar os problemas visuais específicos (espaçamento, contraste, ordem de blocos) em vez de recomendações gerais.
