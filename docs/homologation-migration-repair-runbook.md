# Repair controlado do histórico de migrations — homologação

## Objetivo

Remover exclusivamente três registros duplicados do histórico de migrations do projeto de homologação, usando o comando oficial `supabase migration repair --status reverted`.

Este procedimento **não executa SQL de negócio**, não altera tabelas funcionais e não pode ser usado em produção.

## Ambiente autorizado

- Projeto de homologação: `vazozolhbehnriytzcdc`
- Projeto de produção bloqueado: `uefwywizqhfvvijaopcn`
- Branch autorizada: `reestruturacao/ux-crm-operacao-imagens-v1`
- Workflow: `Reparar histórico de migrations na homologação`
- Plano versionado: `docs/evidence/homologation-migration-repair-plan-20260727.json`

## Escopo exato

O workflow preserva as versões:

- `20260727035116` — `backend_only_tables_explicit_deny`
- `20260727035246` — `operational_foreign_key_indexes`
- `20260727035513` — `public_analytics_bff_only`

E marca somente estas versões duplicadas como revertidas:

- `20260727035059`
- `20260727035343`
- `20260727040533`

Qualquer divergência no histórico esperado encerra o workflow antes do repair.

## Configuração necessária no environment `homologation`

### Variables

- `ADOCE_HOMOLOGATION_SUPABASE_REF=vazozolhbehnriytzcdc`
- `ADOCE_PRODUCTION_SUPABASE_REF=uefwywizqhfvvijaopcn`

### Secrets

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_HOMOLOGATION_DB_URL`

Os valores secretos devem ser inseridos diretamente no cofre do GitHub Environment. Não registrar tokens, senhas ou URLs com credenciais em commits, issues ou comentários.

## Execução

A execução é exclusivamente manual por `workflow_dispatch`.

Entradas obrigatórias:

- `expected_commit`: SHA completo do head autorizado.
- `confirmation`: `REPARAR SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc`

O workflow valida antes de qualquer alteração:

1. branch exata;
2. SHA exato;
3. project ref de homologação;
4. separação em relação ao projeto de produção;
5. URL PostgreSQL pertencente à homologação;
6. conteúdo integral do plano versionado;
7. presença das seis versões esperadas no escopo anterior;
8. vínculo local do Supabase CLI com a homologação.

## Evidências preservadas

O artefato `migration-repair-homologation-*` mantém por 30 dias:

- plano redigido executado;
- histórico de migrations antes do repair;
- recorte das duplicidades antes da alteração;
- saída de `supabase migration list` antes;
- saída individual dos repairs;
- histórico posterior;
- recorte final esperado;
- saída de `supabase migration list` depois;
- resultado JSON do executor.

Nenhum segredo deve aparecer nesses arquivos.

## Etapas posteriores obrigatórias

Depois de um repair aprovado:

1. capturar novo snapshot redigido do histórico remoto;
2. confirmar que cada nome possui somente a versão preservada;
3. renomear os três arquivos locais conforme o plano;
4. executar auditoria de integridade;
5. executar reconciliação local versus homologação;
6. executar `supabase migration list --linked`;
7. executar `supabase db push --linked --dry-run`;
8. validar reconstrução em branch descartável de banco;
9. somente então liberar o gate de publicação da homologação.

## Produção

Este workflow:

- não possui gatilho automático;
- usa o environment `homologation`;
- não contém deploy;
- não contém `release:prod`;
- rejeita a referência de produção;
- não executa migrations de negócio;
- não faz merge;
- não publica o portal.

Qualquer ação em produção continua proibida sem aprovação expressa, backup, rollback e smoke tests confirmados.
