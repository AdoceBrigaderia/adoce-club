# Integridade e reconciliação das migrations da reestruturação

Atualização de 27/07/2026. Este documento acompanha exclusivamente a branch `reestruturacao/ux-crm-operacao-imagens-v1` e o Supabase de homologação `vazozolhbehnriytzcdc`.

## Resultado atual

A auditoria local e a leitura somente consulta do histórico remoto confirmaram que o problema é mais amplo que os três timestamps locais repetidos:

- 60 arquivos locais no recorte da reestruturação;
- 63 registros correspondentes no histórico remoto da homologação;
- 57 migrations locais com drift entre o timestamp do arquivo e a versão registrada remotamente;
- 0 versões já alinhadas no recorte;
- 3 grupos de versões locais duplicadas;
- 3 nomes registrados duas vezes no histórico remoto;
- nenhuma migration local sem correspondente remoto por nome;
- nenhum nome remoto fora do inventário local no recorte.

O snapshot redigido usado na comparação está em:

- `docs/evidence/homologation-migrations-20260727.json`

Ele contém somente nomes, versões, ambiente, projeto e horário da coleta. Nenhum SQL, dado de cliente ou segredo foi copiado.

## Duplicidades locais confirmadas

### `20260727082000`

- `20260727033336_pede_junto_bff_only.sql`
- `20260727034403_quick_sale_favorites_and_ranking.sql`

### `20260727180000`

- `20260727112539_privacy_deletion_readiness.sql`
- `20260727112924_privacy_profile_anonymization.sql`

### `20260727182000`

- `20260727113213_privacy_anonymization_generated_identity_email_fix.sql`
- `20260727113133_privacy_anonymization_plan_alignment.sql`

## Duplicidades no histórico remoto

O histórico da homologação possui dois registros para cada nome abaixo:

- `backend_only_tables_explicit_deny`: `20260727035059` e `20260727035116`;
- `operational_foreign_key_indexes`: `20260727035246` e `20260727035343`;
- `public_analytics_bff_only`: `20260727035513` e `20260727040533`.

A comparação redigida dos statements confirmou:

- as duas versões de `backend_only_tables_explicit_deny` são semanticamente equivalentes; a diferença observada é documental;
- as duas versões de `operational_foreign_key_indexes` criam o mesmo conjunto de índices; uma versão inclui transação explícita e a outra foi reaplicada em formato compacto;
- as duas versões de `public_analytics_bff_only` executam o mesmo revoke/grant; uma versão inclui transação explícita e a outra foi reaplicada em formato compacto.

Nenhum registro foi removido ou alterado no histórico remoto nesta etapa.

## Proteções e relatórios

### Integridade dos nomes locais

```bash
npm run report:migration-integrity
npm run audit:migrations
```

Artefatos:

- `artifacts/migration-integrity.json`
- `artifacts/migration-integrity.md`

### Reconciliação local versus homologação

```bash
npm run report:migration-reconciliation
npm run audit:migration-reconciliation
```

Artefatos:

- `artifacts/migration-reconciliation.json`
- `artifacts/migration-reconciliation.md`

O relatório de reconciliação:

- compara por nome canônico, sem ler o conteúdo SQL local;
- identifica drift de versão;
- gera o nome de arquivo sugerido para correspondências unívocas;
- bloqueia renomeação automática quando o histórico remoto possui mais de uma versão para o mesmo nome;
- lista ausências, colisões e registros remotos sem arquivo local;
- nunca altera arquivos ou o banco.

Os testes do relatório fazem parte de `npm run verify`. O gate produtivo executa as duas auditorias em modo estrito. A homologação preserva os quatro artefatos como evidência do deploy.

## Próxima etapa controlada

A correção definitiva deve ocorrer em duas partes, sempre somente na homologação:

1. registrar uma decisão explícita para qual versão remota será preservada em cada um dos três nomes repetidos;
2. gerar backup do conteúdo atual de `supabase_migrations.schema_migrations`;
3. usar `supabase migration repair` para marcar somente os três registros excedentes como revertidos, sem desfazer objetos já existentes no banco;
4. atualizar o snapshot remoto e executar novamente o relatório;
5. renomear os arquivos locais para as versões remotas preservadas, mantendo conteúdo e ordem lógica;
6. executar `supabase migration list --linked` e `supabase db push --linked --dry-run`;
7. validar reset em branch de banco descartável ou ambiente equivalente;
8. somente depois declarar a reconciliação aprovada.

Não executar delete ou update manual na tabela interna de migrations quando o comando oficial de repair estiver disponível. Não reaplicar SQL já executado.

## Produção

A publicação deve permanecer bloqueada enquanto `audit:migrations` ou `audit:migration-reconciliation` falhar. Nenhuma ação de repair, renomeação, migration ou deploy foi feita em produção. Produção permanece proibida sem aprovação expressa, backup, plano de rollback e smoke tests.
