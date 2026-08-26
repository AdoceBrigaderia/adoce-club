# Prompt 3 para o Codex — fechar o PR e subir para produção
**07/08/2026** · Cole tudo abaixo da linha.

---

O Rubens autorizou a execução completa, incluindo produção, com backup full. Sua regra de não executar sem ordem explícita continua válida — **esta é a ordem**, com as condições abaixo.

## Janela de execução

✅ **Liberado para executar agora.** O Rubens confirmou em 07/08 que a loja já fechou; a restrição de horário que existia aqui foi levantada por ele.

**Janela de correção: até a abertura de sábado, 08/08 às 18h** (Cantinho da Adoce). Tudo que quebrar precisa estar resolvido ou revertido antes disso. São ~23 horas.

⚠️ **Atenção ao sábado:** há 8 sabores publicados para 08/08, incluindo a estreia da Torta de Pudim. Se o site estiver quebrado amanhã, a perda é de um dia cheio de vendas — sábado é um dos dois dias mais fortes da semana.

Mantenha a ordem dos lotes e as verificações entre eles. Pare e reporte a qualquer falha.

---

## Parte 1 — Fechar o PR #22 (pode fazer agora)

**1.1** Traga de `D:\Clube Adoce` os arquivos ainda não enviados:

```
src/pickup-window.ts          (reescrito: lista de janelas, nao intervalo unico)
src/pickup-window.test.ts     (15 testes)
src/AdoceHome.tsx             src/adoce-home.css
src/AdoceEntrar.tsx           src/adoce-entrar.css
src/AdoceClube.tsx            src/adoce-clube.css
src/App.tsx                   (rotas novas)
src/AdoceHoje.tsx             (pickupWindowsForDay)
src/InstantOrderPanel.tsx     (pickupWindows, pickupBoundsForDay)
public/wallet/progress/v1/progress-00..14.png   (15 faixas redesenhadas)
```

**1.2** O que mudou em `App.tsx`, para você não reverter sem querer:
- home padrão passa a ser `AdoceHome`; a antiga fica em `#home-antiga`
- `#clube` passa a ser `AdoceClube`
- **`#entrar` continua no fluxo atual do `AccessApp`** — a tela nova fica em `#entrar-novo`, escondida, porque o envio de código por WhatsApp ainda não está ligado

**1.3** Em `AdoceClube.tsx`, os botões de carteira e de compartilhar foram removidos de propósito — apontavam para telas inexistentes. **Não os reponha.**

**1.4** Rode a verificação de codificação em todos os arquivos novos — vários têm acento, cedilha e til. O problema já apareceu duas vezes hoje.

**1.5** Verificar: `npx tsc -b`, `npx vitest run` (**esperado 300**), `npx vite build`.

**1.6** Tire o rascunho, faça o merge em `homologacao-adoce`, confirme que o deploy automático passou e me informe a URL.

**1.7** Refaça o teste dos sabores em homologação. Conferi o banco: existem **5 sabores para 2026-08-07**, `available`, 13 unidades, ativos, e as políticas permitem leitura por `anon` (`availability_public_read`: `service_date >= CURRENT_DATE - 1`; `flavors_public_read`: `active`). Sua medição de 0 foi feita antes de eu popular. Se ainda vier 0 com build usando as variáveis de homologação, aí é bug de código — investigue e reporte.

---

## Parte 2 — Backup de produção (antes das migrações)

**2.1** Backup completo do Supabase `uefwywizqhfvvijaopcn`. Se o plano do projeto não garantir restauração pontual, faça também um **dump lógico completo** e guarde fora do Supabase.

**2.2** **Informe o horário exato do backup**, com fuso. Sem isso, não siga.

**2.3** Registre o deploy atual do Netlify de produção para poder republicar: o vigente é `6a6cfa57ebf6cc18b5e7361c`, de 31/07.

---

## Parte 3 — Migrações em produção (depois das 22h)

Produção tem **58 aplicadas**, última `20260723124000`. Faltam **94**.

Aplique **em quatro lotes**, verificando entre cada um. **Pare e reporte se qualquer lote falhar.**

**Lote 1 — 60 migrações** · `20260725213624` → `20260727113349`
Endurecimento de permissões, LGPD, índices.
Verificar: site abre, Adoce Hoje lista sabores, operação abre, console sem erro novo.

**Lote 2 — 22 migrações** · `20260728073000` → `20260728225000`
Custeio, montador de bolo, produtos configuráveis.
Verificar: catálogo comercial abre, solicitação de encomenda é aceita.

**Lote 3 — 6 migrações** · `20260803024900` → `20260805132853`
Permissões de cadastro, alertas de fatia, grants do pedido.
Verificar: cadastro de cliente funciona.

**Lote 4 — 6 migrações** · `20260807062957` → `20260807114331`
Catálogo Meta, base Instagram, WhatsApp configurável, trava de pagamento, cardápio recorrente, e **`release_production_all_channels`** — o conserto do bug que fechou a loja por 11 dias.
Verificar: o botão de liberar produção enxerga produção planejada em **qualquer canal**, não só `online_orders`.

**Atenção ao Lote 1:** contém `anon_grants_hardening`, `lock_sensitive_function_execute`, `public_endpoint_rate_limits`, `backend_only_tables_explicit_deny` e `lock_retired_direct_rpcs`. São os que mais podem quebrar algo que hoje funciona. Verifique com cuidado extra antes de seguir para o Lote 2.

---

## Parte 4 — Conferência

**4.1** `npm run audit:migrations` e `npm run audit:migration-reconciliation` → devem apontar **152 = 152**.

**4.2** Advisors de segurança em produção. **Esperado:** funções executáveis por `anon` caindo de **18 para cerca de 6**. Se continuar em 18, o Lote 1 não surtiu efeito — pare e reporte.

**4.3** Verifique que o vazamento continua tratado: há 7 registros em `site_analytics_events` com JWT completo no `page_path`. **Reporte se ainda existem** — a sanitização precisa entrar antes de considerarmos isso resolvido.

---

## Parte 5 — Publicar o código

```
npm run release:check
npm run release:prod
```

O `release:check` só passa com as migrações reconciliadas. Se barrar, **não contorne** — investigue.

Depois: confirme que www.adocebrigaderia.com.br abre, que o Adoce Hoje lista os 8 sabores de 08/08, e que a operação abre.

---

## Como voltar atrás

**Código:** Netlify → Deploys → `6a6cfa57ebf6cc18b5e7361c` → Publish deploy.

**Banco:** restaurar o backup. ⚠️ **Perde tudo criado depois dele.** Só faça com ordem explícita do Rubens, e avise antes quantos pedidos e cadastros seriam perdidos.

---

## Ao terminar, responda

1. Horário do backup, com fuso
2. Cada lote: aplicado com sucesso? o que verificou?
3. Auditorias: 152 = 152?
4. Advisors: funções `anon` caíram de 18 para quanto?
5. Os 7 registros com JWT ainda existem?
6. Deploy de produção passou? Site e operação abrindo?
7. Qualquer coisa que você tenha decidido sozinho e queira que eu revise
