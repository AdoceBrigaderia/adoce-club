# Prompt 15 para o Codex — subir tudo: homologação e produção
**11/08/2026** · Cole tudo abaixo da linha.

---

## O que é para fazer

Duas etapas, na mesma execução, sem parar entre elas:

1. **Homologação** — subir tudo que entrou depois do último deploy
2. **Produção** — logo em seguida, o lote completo

Não abra chamado, não peça confirmação, não devolva plano para aprovação. Se algo travar, **pule e deixe por último**; não fique parado esperando resposta.

---

## Etapa 1 — Homologação

### Arquivos que entraram depois do último deploy

**Pede Junto com pagamento individual e minichat** *(novos, testados aqui)*

```
src/pede-junto-pagamento.ts
src/pede-junto-pagamento.test.ts      (17 testes verdes)
src/PedeJuntoPagamento.tsx
src/pede-junto-pagamento.css
supabase/migrations/20260811150000_pede_junto_pagamento.sql
```

Rota `#pede-junto` em `App.tsx`, lazy como as demais.

⚠️ A migração referencia `public.group_orders` e `public.group_order_participants`. **Confirme os nomes reais** com `select table_name from information_schema.tables where table_schema='public' and table_name like '%group%'` e corrija as `references` se for diferente. Não crie tabela nova para contornar.

Regras que a tela obedece, e que têm teste travando cada uma:

- ninguém paga antes de a Adoce marcar "separei tudo"
- o organizador vê apenas `nome`, `fatias`, `pagou` — nada de meio de pagamento
- cinco fatias é o mínimo, não o teto

BFF, nunca a tabela direto — as duas tabelas novas já vêm com `revoke all` para `anon` e `authenticated`:

```
netlify/functions/auth-bff-pede-junto-grupo.ts     lê grupo, participantes e recados
netlify/functions/auth-bff-pede-junto-recado.ts    grava recado
netlify/functions/pede-junto-gerar-links.ts        gera as preferências do Mercado Pago
```

`pede-junto-gerar-links` roda **quando a operação marca "separado"** — nunca antes. Em homologação usa a credencial de teste, que é para isso mesmo.

### E o que ainda não estava ligado

Do prompt 13, se ainda não subiu: `decidirPorta()` nas telas do Clube, `pacotes-de-docinhos` no catálogo, `ExperienciaAdoce` em `#eventos` / `#adoce-na-escola` / `#aluguel-decoracao`.

---

## Etapa 2 — Produção, em seguida

### As três migrações que só existem em produção

Não precisa reconstruir por dedução. O SQL está gravado no próprio banco:

```sql
select version, name, statements
  from supabase_migrations.schema_migrations
 where name in ('fin_personal_planning_schema',
                'fin_recurrence_engine_v2',
                'app_saas_homologacao_multi_conta')
 order by version;
```

Salve cada uma como arquivo em `supabase/migrations/` **com o mesmo `version` já gravado** — carimbo novo faria rodar de novo. Commit na homologação e siga.

Se `statements` vier vazio em alguma, reconstrua a partir do estado real (`information_schema.columns`, `pg_policies`, `pg_get_functiondef`) e siga também. **Não pare por causa disso.**

⚠️ As duas `fin_*` são o planejamento financeiro pessoal do Rubens e da Beth, isoladas por RLS. Têm dados reais. Não apague, não mova, não "limpe".

### O lote das 99

Aplique. Uma coisa só precisa de cuidado no caminho, e você resolve sozinha:

**Se alguma migração do lote recriar `submit_instant_order`**, ela derruba o gatilho `private.sincronizar_reserva_de_fatias()` que está aplicado direto em produção — e a reserva volta a não baixar fatia do estoque. Então:

1. antes de aplicar, guarde o `pg_get_functiondef` do gatilho e das versões atuais
2. `grep -l "submit_instant_order"` no lote — se aparecer, aplique e **recrie o gatilho depois**
3. ao terminar, confirme que ele existe e está ativo

Isso não é motivo para parar. É motivo para conferir no fim.

### Depois de aplicar

Rode o deploy de produção e confira, nesta ordem:

1. o site abre e mostra o que tem hoje
2. fazer uma reserva de teste **baixa a fatia do estoque**
3. o aviso de pedido chega (Telegram e Web Push)
4. entrar no Clube com quem já tem carimbos **não** oferece cadastro
5. `#sabores` abre com foto grande e tem saída

Se o passo 2 falhar, é o gatilho. Recrie e teste de novo.

---

## Me devolva ao terminar

- hash do topo de `adoce-oficial/homologacao-adoce` e o id do deploy de homologação
- hash e id do deploy de produção
- quantas migrações foram aplicadas em produção e quantas restaram
- se `submit_instant_order` foi recriada, e se o gatilho está de pé
- a saída de `git grep -l "PedeJuntoPagamento" -- src` (tem que listar `App.tsx`)

---

## O que NÃO fazer

- Não apagar nem mexer nas tabelas `fin_*`
- Não inventar `version` novo para as três
- Não dar `grant` novo a `anon` ou `authenticated`
- Não deixar produção sem o gatilho de baixa de estoque
- Não parar para pedir aprovação: se travar, pule e deixe por último
