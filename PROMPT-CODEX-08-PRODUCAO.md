# Prompt 8 para o Codex — subir para produção
**08/08/2026** · Cole tudo abaixo da linha.

---

O Rubens autorizou levar para produção tudo que está pronto, **exceto encomendas e docinhos**.

## ⏰ Janela de execução

**Não execute antes das 22h de sábado 08/08.** A loja abre às 18h com oito sabores e a estreia da Torta de Pudim; sábado é um dos dois dias mais fortes da semana.

**Janela ideal: domingo 09/08 pela manhã.** Movimento fraco e o dia inteiro para corrigir.

Se o Rubens mandar antes, confirme com ele por escrito que a loja já fechou.

---

## ⚠️ O `release:check` obriga as 94 migrações

`npm run release:prod` chama `release:check`, que só passa com as migrações reconciliadas. Produção tem 58 aplicadas; faltam 94.

**Não existe subir só o código.** Ou as migrações vão junto, ou não vai nada. **Não contorne o `release:check`** — foi ele que impediu um deploy inconsistente antes.

---

## 1. Antes de tudo

**1.1 Backup manual do banco de produção**, com horário e fuso informados. O backup diário automático das 03:00 não basta: vai ter muita coisa nova do dia.

**1.2 Registre o deploy atual** do Netlify para poder republicar em segundos se precisar.

**1.3 Confirme que os seis consertos da auditoria de 08/08 continuam valendo em produção** — estão em `AUDITORIA-PRODUCAO-08-08.md` e você já os capturou em migração. Se alguma migração antiga os reverter, é **parada imediata**.

Verificação rápida:
```sql
-- deve devolver 0
select count(*) from information_schema.role_table_grants
where table_schema='public' and grantee='anon' and privilege_type in ('TRUNCATE','DELETE');
-- deve devolver só o job 1
select jobid from cron.job;
-- gatilhos de reserva devem existir
select tgname from pg_trigger where tgname like 'sincroniza_reserva%';
```

---

## 2. As 94 migrações, em quatro lotes

Verifique entre cada um. **Pare e reporte a qualquer falha.**

**Lote 1 — 60 migrações** · `20260725213624` → `20260727113349`
Endurecimento de permissões, LGPD, índices.
⚠️ **O mais perigoso.** Contém `anon_grants_hardening`, `lock_sensitive_function_execute`, `public_endpoint_rate_limits`, `backend_only_tables_explicit_deny`, `lock_retired_direct_rpcs` — todos revogam acesso.
**Depois dele, rode de novo as três verificações do item 1.3.**
Verificar: site abre, Adoce Hoje lista sabores, operação abre, console sem erro novo.

**Lote 2 — 22 migrações** · `20260728073000` → `20260728225000`
Custeio, montador de bolo, produtos configuráveis.
Verificar: catálogo comercial abre, solicitação de encomenda é aceita.

**Lote 3 — 6 migrações** · `20260803024900` → `20260805132853`
Permissões de cadastro, alertas de fatia, grants do pedido.
Verificar: cadastro de cliente funciona.

**Lote 4 — 6 migrações** · `20260807062957` → `20260807114331`
Catálogo Meta, Instagram, WhatsApp configurável, trava de pagamento, cardápio recorrente e **`release_production_all_channels`** — o conserto do bug que fechou a loja por 11 dias.
Verificar: o botão de liberar produção enxerga produção planejada em **qualquer canal**.

**Lote 5 — as migrações da auditoria de 08/08**, se ainda não estiverem em produção (elas foram aplicadas à mão lá; se a captura for idempotente, aplique; se não, marque como já aplicadas).

---

## 3. O que sobe de código

**Vai:**
- `PainelDoDia` + `painel-do-dia.ts` — a nova porta de entrada da operação
- `PedidoNaEsteira` + `jornada-do-pedido.ts` — as etapas do pedido e as mensagens ao cliente
- `PedeJuntoPrazo` + `pede-junto-prazo.ts`
- `AdoceHome`, `AdoceClube` (`AdoceEntrar` só escondida em `#entrar-novo`)
- `FichaTermica` — a ficha de 58 mm
- `alerta-pedidos.ts` (Web Push) e `alerta-telegram.ts` + dependência `web-push`
- `adoce-tokens.css` e a limpeza do passo 1 do prompt 7 (campanhas e andaimes)

**Também vai** (o Rubens confirmou em 08/08 que é tudo):
- `AgendaDeEncomendas` + `capacidade-de-encomenda.ts` — a agenda de encomendas
- as correções dos docinhos configuráveis: limite de sabores **desabilitando** os demais em vez de avisar depois, e quantidade em **múltiplos de 25**
- o **desligamento do montador de torta** — rota escondida em `#montador-antigo`, arquivos preservados. Motivo: não existe custo nem preço por camada, recheio ou adicional. Ver `adoce-nao-vender-o-que-nao-tem-custo` nas decisões.

Detalhe de cada um nos passos 6 e 7 do `PROMPT-CODEX-07-LIMPEZA.md`.

⚠️ **Não sobe de jeito nenhum:** a tela `#adoce-hoje` redesenhada. Ela ainda não existe — só há um desenho aprovado, sem código. É a tela onde a venda acontece; não improvise.

---

## 4. Publicar

```
npm run release:check
npm run release:prod
```

Depois: `www.adocebrigaderia.com.br` abre, Adoce Hoje lista os sabores do dia, operação abre, painel do dia aparece como primeira tela.

---

## 5. Conferência final

- `npm run audit:migrations` e `audit:migration-reconciliation` → **152 = 152**
- advisors de segurança: funções executáveis por `anon` devem cair de **18 para cerca de 6**. Se continuar em 18, o Lote 1 não surtiu efeito — **pare e reporte**
- as três verificações do item 1.3 continuam passando
- as duas funções de aviso aparecem em Netlify → Functions, agendadas a cada minuto
- um pedido de teste incrementa `quantity_reserved` e o cancelamento devolve

---

## Como voltar atrás

**Código:** Netlify → Deploys → o deploy registrado no item 1.2 → Publish deploy. Volta em segundos.

**Banco:** restaurar o backup do item 1.1. ⚠️ **Perde tudo criado depois dele** — pedidos, cadastros, carimbos. Só com ordem explícita do Rubens, e diga antes quantos registros seriam perdidos.

---

## Ao terminar, responda

1. Horário do backup, com fuso
2. Cada lote: aplicado? o que verificou?
3. As três verificações do item 1.3, antes e depois do Lote 1
4. Auditorias: 152 = 152?
5. Advisors: funções `anon` caíram de 18 para quanto?
6. Deploy passou? Site, operação e painel do dia abrindo?
7. Confirmação de que o montador está desligado, os docinhos andam de 25 em 25 com os sabores excedentes desabilitados, e que a `#adoce-hoje` **não** foi alterada
8. Qualquer coisa que você decidiu sozinho e queira que eu revise
