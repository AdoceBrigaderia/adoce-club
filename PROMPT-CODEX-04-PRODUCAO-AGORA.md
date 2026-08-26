# Prompt 4 para o Codex — subir produção
**08/08/2026, madrugada** · Cole tudo abaixo da linha.

---

O Rubens ordenou a execução completa em produção, agora. Sua regra de não executar sem ordem explícita continua válida — **esta é a ordem.**

## O que mudou desde o prompt anterior

- **Backup de produção: FEITO.** O Rubens confirmou. (Peça a ele o horário exato antes de começar e registre na sua saída.)
- **A produção mudou de organização no Supabase.** O projeto `uefwywizqhfvvijaopcn` foi transferido para uma organização nova (`Adoce Producao`), que vai para o plano Pro. A homologação (`vazozolhbehnriytzcdc`) ficou na organização antiga, no Free. **Isso não muda nada nas migrações**, mas se você usa um token de acesso do Supabase, ele pode precisar ser reautorizado para a organização nova.
- **Duas funções novas de aviso de pedido** entram junto (detalhe na Parte 1).

## Janela

⚠️ **A loja abre hoje às 18h**, com 8 sabores publicados e a estreia da Torta de Pudim. Tudo que quebrar precisa estar resolvido ou revertido antes disso.

Mantenha a ordem dos lotes e as verificações entre eles. **Pare e reporte a qualquer falha.**

---

## Parte 1 — Arquivos novos, ainda não enviados

Traga de `D:\Clube Adoce`:

```
netlify/functions/alerta-pedidos.ts     (REESCRITO: era Telegram, agora e Web Push)
netlify/functions/alerta-telegram.ts    (NOVO: o Telegram virou canal secundario)
package.json                            (dependencia web-push + @types/web-push)
package-lock.json
src/pickup-window.ts                    src/pickup-window.test.ts
src/AdoceHome.tsx                       src/adoce-home.css
src/AdoceEntrar.tsx                     src/adoce-entrar.css
src/AdoceClube.tsx                      src/adoce-clube.css
src/App.tsx
src/AdoceHoje.tsx                       src/InstantOrderPanel.tsx
src/RequestQuoteDocument.tsx            src/request-quote-document.css
src/OperationCommercialAdmin.tsx
src/adoce-tokens.css                    src/main.tsx
src/WeeklyMenuAdmin.tsx
public/wallet/progress/v1/progress-00..14.png
supabase/migrations/20260807114331_release_production_all_channels.sql
```

### Sobre as duas funções de aviso

São **dois canais independentes**, de propósito. Em 07/08 uma cliente pediu duas fatias e ninguém soube; a fila existia e ninguém a lia.

- `alerta-pedidos.ts` lê `operation_notifications` e envia **Web Push**. Canal oficial.
- `alerta-telegram.ts` lê `outbox_events` e envia **Telegram**. Rede de segurança, mensagem mais completa.

Ambas agendadas a cada minuto. Ambas retornam 200 com aviso quando ainda não estão configuradas — **isso é intencional**, não trate como erro.

**Não unifique as duas.** A redundância é o objetivo.

### Não reverter sem querer

- `App.tsx`: home padrão passa a ser `AdoceHome`; a antiga fica em `#home-antiga`; `#clube` → `AdoceClube`; **`#entrar` continua no `AccessApp`** e a tela nova fica escondida em `#entrar-novo`, porque o envio de código por WhatsApp ainda não funciona
- `AdoceClube.tsx`: os botões de carteira e compartilhar foram removidos de propósito — apontavam para telas inexistentes
- `adoce-tokens.css` é importado **por último** em `main.tsx` de propósito, para os apelidos vencerem o `theme.css`

**Rode a verificação de codificação** em todos os arquivos novos — vários têm acento, cedilha e til. O problema já apareceu duas vezes.

**Verificar:** `npx tsc -b`, `npx vitest run` (**esperado 300**), `npx vite build`.

Depois: tire o PR #22 do rascunho, faça o merge, confirme o deploy de homologação.

---

## Parte 2 — Migrações em produção

Produção tem **58 aplicadas**, última `20260723124000`. Faltam **94**.

Se usar `supabase db push`, confirme antes que o link é para `uefwywizqhfvvijaopcn` e **não** para homologação.

Aplique **em quatro lotes**, verificando entre cada um.

**Lote 1 — 60 migrações** · `20260725213624` → `20260727113349`
Endurecimento de permissões, LGPD, índices.
Verificar: site abre, Adoce Hoje lista sabores, operação abre, console sem erro novo.

⚠️ **É o lote mais perigoso.** Contém `anon_grants_hardening`, `lock_sensitive_function_execute`, `public_endpoint_rate_limits`, `backend_only_tables_explicit_deny` e `lock_retired_direct_rpcs` — todos revogam acesso. Verifique com cuidado extra antes de seguir.

**Lote 2 — 22 migrações** · `20260728073000` → `20260728225000`
Custeio, montador de bolo, produtos configuráveis.
Verificar: catálogo comercial abre, solicitação de encomenda é aceita.

**Lote 3 — 6 migrações** · `20260803024900` → `20260805132853`
Permissões de cadastro, alertas de fatia, grants do pedido.
Verificar: cadastro de cliente funciona.

**Lote 4 — 6 migrações** · `20260807062957` → `20260807114331`
Catálogo Meta, base Instagram, WhatsApp configurável, trava de pagamento, cardápio recorrente, e **`release_production_all_channels`** — o conserto do bug que fechou a loja por 11 dias.
Verificar: o botão de liberar produção enxerga produção planejada em **qualquer canal**, não só `online_orders`.

---

## Parte 3 — Publicar o código

```
npm run release:check
npm run release:prod
```

O `release:check` só passa com as migrações reconciliadas. Se barrar, **não contorne** — investigue.

Depois: www.adocebrigaderia.com.br abre, Adoce Hoje lista os **8 sabores de 08/08**, a operação abre.

---

## Parte 4 — Conferência

**4.1** `npm run audit:migrations` e `npm run audit:migration-reconciliation` → **152 = 152**

**4.2** Advisors de segurança. **Esperado:** funções executáveis por `anon` caindo de **18 para cerca de 6**. Se continuar em 18, o Lote 1 não surtiu efeito — pare e reporte.

**4.3** Os 7 registros em `site_analytics_events` com **JWT completo** no `page_path` ainda existem? Reporte.

**4.4** As duas funções de aviso aparecem em Netlify → Functions, agendadas?

---

## Como voltar atrás

**Código:** Netlify → Deploys → `6a6cfa57ebf6cc18b5e7361c` → Publish deploy.

**Banco:** restaurar o backup. ⚠️ **Perde tudo criado depois dele.** Só com ordem explícita do Rubens, e diga antes quantos pedidos e cadastros seriam perdidos.

---

## Ao terminar, responda

1. Horário do backup, com fuso
2. Cada lote: aplicado? o que verificou?
3. Auditorias: 152 = 152?
4. Advisors: funções `anon` caíram de 18 para quanto?
5. Os 7 registros com JWT ainda existem?
6. Deploy passou? Site e operação abrindo?
7. As duas funções de aviso estão agendadas?
8. Qualquer coisa que você tenha decidido sozinho e queira que eu revise

---

## O que NÃO fazer

- Não crie conta, não aceite termos, não gere nem rotacione credencial nenhuma
- Não mexa em variáveis de ambiente do Netlify: as cinco de aviso já estão criadas e o Rubens preencheu as chaves
- Não apague nada do Storage. Há 436 MB de imagens originais para limpar, mas isso é outra tarefa, com o Rubens acordado
