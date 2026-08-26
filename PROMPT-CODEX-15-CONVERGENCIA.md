# Prompt 15 para o Codex — reunir as duas histórias antes de subir
**11/08/2026** · Cole tudo abaixo da linha.

---

## Você parou pelo motivo certo

Aplicar 99 migrações sobre um banco que tem três que você não conhece é como assentar tijolo sem saber o que tem embaixo. Obrigado por não fazer.

Mas o conteúdo das três **não está perdido, e não precisa ser reconstruído por dedução.**

---

## 1. O SQL das três está no próprio banco

O Supabase guarda o texto de cada migração aplicada dentro de `supabase_migrations.schema_migrations`. Rode **em produção**:

```sql
select version, name, statements
  from supabase_migrations.schema_migrations
 where name in (
   'fin_personal_planning_schema',
   'fin_recurrence_engine_v2',
   'app_saas_homologacao_multi_conta'
 )
 order by version;
```

`statements` é um `text[]` com o SQL exato que rodou. Se vier preenchido, acabou a investigação.

Se alguma vier com `statements` nulo ou vazio — acontece quando o SQL foi rodado direto no editor —, aí sim reconstrua **a partir do estado real**, não de memória:

```sql
-- objetos que essas migrações criaram
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name like 'fin\_%'
 order by table_name, ordinal_position;

select tablename, policyname, cmd, qual, with_check
  from pg_policies where schemaname = 'public' and tablename like 'fin\_%';

select p.proname, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public','private') and p.proname like '%recurrence%';
```

---

## 2. O que essas três são — para você não tratar como enigma

**`fin_personal_planning_schema` e `fin_recurrence_engine_v2`** são o planejamento financeiro pessoal do Rubens e da Beth. Moram no banco da Adoce por conveniência, isolados por RLS, e **não fazem parte da operação da confeitaria**. Foram aplicadas direto em produção e nunca viraram arquivo — é exatamente por isso que só existem lá.

Elas precisam virar arquivo e entrar na homologação como qualquer outra. **Não apague nada delas.** Contêm dados reais.

**`app_saas_homologacao_multi_conta`** é a que precisa de olhar antes de replicar: se ela mexe em isolamento por conta, replicar em homologação sem entender pode misturar dado de ambiente. Leia primeiro, me conte o que faz, e só então decida.

---

## 3. Reunir as histórias, nesta ordem

1. Escreva as três como arquivos em `supabase/migrations/`, **com o mesmo `version` que já está gravado no banco** — não invente carimbo novo, senão elas rodam de novo.
2. Commit na homologação. As histórias passam a partir do mesmo tronco.
3. Rode as três na homologação. Como o `version` já bate, o Supabase vai aplicá-las lá e nada mais.
4. **Só então** monte o lote das 99 para produção.

---

## 4. As 99 — não de uma vez

99 migrações num banco que hoje atende cliente é risco grande demais para um passo só. Divida por natureza e me diga o que caiu em cada grupo:

- **Grupo A — só leitura e correção de segurança**: `revoke`, `policy`, `grant` retirado, índice. Não muda dado. Pode ir primeiro.
- **Grupo B — estrutura nova**: `create table`, coluna nova com `default`, função nova. Aditivo, reversível.
- **Grupo C — muda comportamento ou dado existente**: `update`, `alter column`, `drop`, `create or replace` de função que a operação já usa. **Esta lista você me manda antes de rodar qualquer uma.**

Rode A, confira o site. Depois B, confira. C fica para o fim, comigo olhando junto.

Um detalhe do C que já sei: existem quatro versões públicas de `submit_instant_order` em produção, e há um gatilho `private.sincronizar_reserva_de_fatias()` aplicado direto lá para corrigir a baixa de estoque. **Se alguma migração do lote recriar `submit_instant_order`, ela pode derrubar essa correção e o estoque volta a não baixar.** Procure por isso explicitamente.

---

## 5. Antes de tocar em produção, me devolva

```sql
-- as três, com o SQL recuperado
-- a divisão A / B / C, com contagem e a lista completa do C
-- e: alguma migração do lote toca submit_instant_order? quais?
```

E não rode nada do grupo C até eu responder.

---

## O que NÃO fazer

- Não apagar, mover ou "limpar" as tabelas `fin_*` — são dados pessoais reais
- Não inventar `version` novo para as três: use o que já está gravado
- Não aplicar as 99 num lote só
- Não recriar `submit_instant_order` sem me avisar
- Não replicar `app_saas_homologacao_multi_conta` antes de me explicar o que ela faz
