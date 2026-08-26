# Onde paramos — 07/08/2026

Documento para retomar sem precisar reconstruir contexto.

---

## 🔴 O mais urgente

**117 notificações pendentes desde 22/07.** O sistema registra tudo certo e ninguém entrega.

```
operation_notifications · push_status = 'pending'
  07/08 12:40  instant_order.created  "FAT-20260807-0025 · Juliana Sousa · 32.00"
  07/08 19:27  profile.created        Maria Eduarda Nobre Lopes
  07/08 19:38  profile.created        Francisco Flávio da Silva Júnior
  07/08 19:49  profile.created        Rayssa Ranielle
```

**O que aconteceu:** Juliana pediu 2 fatias às 12h40, ninguém viu, ela ligou às 18h e os sabores tinham acabado.

**Causa raiz — duas falhas somadas:**
1. O único aviso dependia do cliente tocar em "enviar" no WhatsApp depois de já ter concluído. Links `wa.me` abrem a conversa com texto pronto mas **não enviam**.
2. Ninguém lê as filas: `outbox_events` (102 pendentes) nem `operation_notifications` (117 pendentes).

**O que já existe e não está ligado:**
- `public/sw.js` com handlers de `push` e `notificationclick` ✅
- `operation_push_subscriptions` (0 inscrições) ✅
- `src/OperationNotificationCenter.tsx` com `pushManager` ✅
- Gatilho que cria a notificação a cada pedido ✅
- **Falta:** função que envia o push + par de chaves VAPID + Rubens inscrito

**Rubens recusou Telegram.** Caminho escolhido: **Web Push** pelo próprio site instalado.
Escrevi `netlify/functions/alerta-pedidos.ts` para Telegram — **está no repositório mas não deve ser usado.** Apagar ou reescrever para push.

---

## Estado dos ambientes

| | Produção | Homologação |
|---|---|---|
| Supabase | `uefwywizqhfvvijaopcn` | `vazozolhbehnriytzcdc` |
| Migrações | **58** de 152 — faltam **94** | 152 ✅ |
| Código | 31/07, por CLI | PR #22 em rascunho |
| Deploy para reverter | `6a6cfa57ebf6cc18b5e7361c` | — |

**Produção NÃO foi tocada.** Nenhuma migração aplicada, nenhum deploy.

---

## Feito hoje em produção (dados, não código)

- Estoque de 07/08 publicado — **a loja voltou a vender depois de 11 dias esgotada**
- 8 sabores publicados para **08/08**, incluindo estreia da **Torta de Pudim** (R$ 20, premium)
- Horários corrigidos: fechamento 22h em todos os canais; Cantinho 19h30 qui/sex, 18h sáb
- `pickup_locations`: criado **Cantinho da Adoce** (Av. da Saudade, S/N)
- Mensagem do canal: "Reserve agora — retirada a partir das 19h30, no Cantinho da Adoce"
- Pedido da Gabriela (ADO-2026-000011) remarcado para 12/08 às 18h

---

## Código pronto, testado, aguardando publicação

**300 testes passando · typecheck limpo · build limpo**

| Arquivo | O que faz |
|---|---|
| `supabase/migrations/20260807114331_release_production_all_channels.sql` | **Conserta o bug dos 11 dias.** Havia 3 travas de canal: aba, contagem e a própria RPC filtrando `channel_slug='online_orders'`. A produção de 31/07 e 01/08 (78 fatias) foi planejada em `in_person` e o botão nunca viu. Já aplicada em homologação. |
| `src/WeeklyMenuAdmin.tsx` | Remove as duas travas de canal na tela |
| `src/pickup-window.ts` + teste | Janela de retirada. **Reescrito**: trabalha com lista de janelas e recusa o vão entre elas (fábrica de dia + Cantinho à noite). 15 testes. |
| `src/AdoceHoje.tsx`, `src/InstantOrderPanel.tsx` | Ligam a janela ao campo de horário |
| `src/RequestQuoteDocument.tsx` + CSS + teste | Orçamento A4 e "O que o cliente pediu" na operação — **nunca era renderizado** |
| `src/OperationCommercialAdmin.tsx` | Integra o orçamento |
| `src/adoce-tokens.css` + `src/main.tsx` | Paleta correta da logo. Existiam **109 variáveis em 68 arquivos** para ~15 cores (o rosa tinha 7 nomes). Os nomes antigos viraram apelidos. Importado **por último** de propósito. |
| `src/AdoceHome.tsx` + CSS | Home nova. Antiga em `#home-antiga`. |
| `src/AdoceEntrar.tsx` + CSS | Login por WhatsApp — **escondido em `#entrar-novo`**, não funciona ainda |
| `src/AdoceClube.tsx` + CSS | Área do cliente, duas cartelas (fatia → coração) |
| `public/wallet/progress/v1/progress-00..14.png` | 15 faixas redesenhadas |

---

## Decisões do Rubens (não reabrir)

- **Fatia-presente é presente, nunca desconto.** Nada de valor negativo ou cupom.
- **Calda é obrigatória**, com "sem calda" como opção. Não finaliza sem escolher.
- **Cartela de indicação: 12 posições**, não 14 nem 5.
- **Os 5 tortas/dia de encomenda já contam a produção do festival.**
- **Festival fixo:** ter 3, qua 3, qui 6, sex 8, sáb 8 = 28/semana
- **Pede Junto: 5 é mínimo**, não teto. Já houve grupo com 11 moradores.
- **Entrega grátis só em Fortaleza.**
- **Prazo de 3 dias úteis** para data garantida; menos que isso, ou sex/sáb, exige avaliação.
- **Preço por sabor**, não mais dois preços fixos.
- **`homologacao/redesign-aprovado-v2` está abandonada.** Nada dela entra.
- **Sem Google/Facebook no login.** Só WhatsApp.
- **Sem Telegram.**
- **Tom das mensagens:** cordial, explica o porquê, fecha com 💗.

---

## Custos — importado em homologação

44 ingredientes · 48 preços · 21 receitas/preparações · 58 componentes · 42 alocações

**Descobertas:**
- Comprar Óreo na caixa custa **42% menos** que avulso (KitKat −25%, Galak −20%)
- Custo real da fatia tradicional: **R$ 10,96** → margem **31,5%**, não os 72% que o custo direto sugeria
- **Mão de obra não alocada é R$ 4,46 por fatia** — as receitas capturam 73 das 880 horas/mês da folha
- Aluguel, água, internet, MEI, depreciação e manutenção somados: **R$ 0,36/fatia**. Irrelevante perto da mão de obra.
- Vender mais dilui: 200 tortas em vez de 152 leva a margem de 31% para 38%

**Pendente da Beth (domingo):** minutos reais de cada receita. Os atuais são estimativa minha.

---

## Bloqueios externos

| Item | Situação |
|---|---|
| Meta — empresa verificada | ✅ 07/08 |
| `META_BUSINESS_ID` | ✅ `1180557051818355` |
| Instagram | ✅ `17841462700532462` |
| App de desenvolvedor Meta | ⏳ travava; **resolve em janela privada** |
| WhatsApp Cloud API | ⏳ depende do app; número de teste da Meta serve para provar |
| Mercado Pago | ⏳ credenciais de teste em homologação |
| Google Wallet | ⏳ falta Issuer ID |
| 2FA do portfólio Meta | ❌ ainda em "Ninguém" |
| Chip novo para WhatsApp | ⏳ eSIM resolve sem sair de casa |

---

## Ordem recomendada para amanhã

1. **Web Push** — resolve o problema da Juliana. Isolado, sem migração, pode ir sozinho para produção.
2. **Fechar o PR #22** com todos os arquivos acima
3. **Produção** — backup + 94 migrações em 4 lotes. **Domingo de manhã**, não sábado.
4. Blocos de tela restantes: operação, encomendas, Pede Junto

---

## Dívidas registradas

- 7 registros em `site_analytics_events` com **JWT completo** no `page_path` — precisa sanitizar e purgar
- **6 versões** de `submit_instant_order` vivas no banco
- Horário de retirada é texto livre dentro de `notes` — precisa de coluna própria (`v7`)
- `#adoce-hoje` nunca atinge `document_idle` — suspeita de timer ou requisição pendente
- Fotos dos sabores: qualidade não verificada, e a home nova depende delas
- `slice_availability_alerts` existe e nunca foi usada — **a Juliana é a primeira candidata**, avisar quando Surpresa de Uva voltar
