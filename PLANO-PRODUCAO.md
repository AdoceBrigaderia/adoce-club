# Subir para produção — plano
**07/08/2026** · Preparado para execução com o Rubens acompanhando.

---

## Estado atual

| | Produção | Homologação |
|---|---|---|
| Supabase | `uefwywizqhfvvijaopcn` | `vazozolhbehnriytzcdc` |
| Migrações aplicadas | **58** (última `20260723124000`, de 23/07) | **152** |
| Migrações pendentes | **94** | 0 |
| Funções Netlify publicadas | 12 | 23 |
| Código publicado | 31/07, por CLI | reconciliado no PR #22 |

**94 migrações separam os dois bancos.** Entre elas: catálogo Meta, Instagram, WhatsApp Cloud OTP, custos, caixa, LGPD, e todo o endurecimento de segurança (`anon_grants_hardening`, `lock_sensitive_function_execute`, `public_endpoint_rate_limits`, `backend_only_tables_explicit_deny`).

---

## O que muda para o cliente

**Melhora:**
- Botão de liberar produção consertado nas três camadas — o bug que fechou a loja por 11 dias
- Horário de retirada travado na janela real do dia
- Orçamento em A4 e ficha 58 mm com a logo
- "O que o cliente pediu" visível na operação
- Paleta correta da marca em todo o site
- Home nova, área do Clube nova
- Fechamento de brechas de segurança: funções abertas ao público caem de 18 para 6

**Não muda ainda:**
- Login continua no fluxo atual (WhatsApp OTP escondido, falta Cloud API)
- Mercado Pago não entra (credenciais só em homologação)
- Google Wallet não entra (falta Issuer ID)

---

## Riscos reais

**1. Migrações que endurecem permissões podem quebrar o que hoje funciona.**
`anon_grants_hardening` e `lock_retired_direct_rpcs` revogam acessos. Em homologação isso foi validado, mas produção tem 75 clientes e dados que homologação não tem.

**2. Produção nunca rodou o código novo.**
Homologação roda desde 07/08. Produção está em 31/07.

**3. Sem backup, não há volta.**
Migração aplicada não se desfaz sozinha.

---

## Sequência

### Antes de tudo — backup

No painel do Supabase de produção: **Database → Backups → criar backup manual**, e anotar o horário. Sem isso, não começamos.

⚠️ Confirmar também qual é o plano do projeto: no plano gratuito o histórico de backup é limitado. Se for o caso, exportar um dump completo antes.

### Lote 1 — segurança e correções (baixo risco)

`20260725213624` até `20260727113349` — 60 migrações.
Endurecimento de permissões, LGPD, índices, correções de nome.

**Verificar depois:** site abre, Adoce Hoje lista sabores, um pedido de teste é aceito, a operação abre.

### Lote 2 — custos e produtos configuráveis

`20260728073000` até `20260728225000` — 22 migrações.
Custeio, montador de bolo, produtos configuráveis, rendimento.

**Verificar depois:** catálogo comercial abre, encomenda pode ser solicitada.

### Lote 3 — correções recentes

`20260803024900` até `20260805132853` — 6 migrações.
Permissões de cadastro, alertas de fatia, grants do pedido.

### Lote 4 — Meta, WhatsApp e o conserto do estoque

`20260807062957` até `20260807114331` — 6 migrações.
Catálogo Meta, base Instagram, WhatsApp configurável, trava de pagamento, cardápio recorrente, **liberação de produção por todos os canais**.

**Verificar depois:** o botão de liberar produção enxerga produção planejada em qualquer canal.

### Depois dos quatro lotes

1. Rodar `npm run audit:migrations` e `audit:migration-reconciliation` — devem apontar 152 = 152
2. Rodar os advisors de segurança e comparar com homologação (esperado: funções `anon` caindo de 18 para ~6)
3. Só então publicar o código

---

## Publicação do código

Produção publica por **CLI**, não por Git. Depois do merge do PR #22:

```
npm run release:check
npm run release:prod
```

O `release:check` é o portão que barrou o Codex hoje — ele só passa se as migrações estiverem reconciliadas. **Isso é proteção, não obstáculo.**

---

## Como voltar atrás

**Código:** o Netlify guarda os deploys anteriores. Em Deploys, abrir o de 31/07 e usar **Publish deploy**. Volta em segundos.

**Banco:** restaurar o backup. **Isso perde os dados criados depois dele** — pedidos, cadastros, carimbos. Por isso a janela de aplicação deve ser curta e em horário de pouco movimento.

---

## Janela recomendada

**Domingo de manhã.** Segunda não tem festival, o movimento é o menor da semana, e sobra o dia inteiro para corrigir se algo der errado.

**Não fazer:** sexta ou sábado à noite, que são os dias cheios do Cantinho.

---

## Antes de executar, confirmar com o Rubens

- [ ] Backup manual feito e horário anotado
- [ ] Momento escolhido (recomendado: domingo cedo)
- [ ] Rubens disponível para testar entre os lotes
- [ ] Aceito que restaurar o banco perde dados posteriores ao backup
