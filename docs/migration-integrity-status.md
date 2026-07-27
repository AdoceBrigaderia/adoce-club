# Integridade das migrations da reestruturação

Atualização de 27/07/2026. Este documento acompanha exclusivamente a branch `reestruturacao/ux-crm-operacao-imagens-v1`.

## Resultado atual

A auditoria de nomes encontrou versões locais duplicadas. O Supabase identifica migrations pelo prefixo de timestamp; portanto, dois arquivos com a mesma versão não podem ser tratados como migrations independentes em uma publicação controlada.

Duplicidades confirmadas no inventário atual:

### `20260727082000`

- `20260727082000_pede_junto_bff_only.sql`
- `20260727082000_quick_sale_favorites_and_ranking.sql`

### `20260727180000`

- `20260727180000_privacy_deletion_readiness.sql`
- `20260727180000_privacy_profile_anonymization.sql`

### `20260727182000`

- `20260727182000_privacy_anonymization_generated_identity_email_fix.sql`
- `20260727182000_privacy_anonymization_plan_alignment.sql`

## Proteção adicionada

O comando abaixo gera artefatos redigidos, contendo somente nomes e contagens:

```bash
npm run report:migration-integrity
```

Artefatos:

- `artifacts/migration-integrity.json`
- `artifacts/migration-integrity.md`

A validação estrita é executada por:

```bash
npm run audit:migrations
```

O gate de produção executa a validação estrita antes de qualquer publicação. Enquanto houver timestamp duplicado ou nome inválido, a publicação produtiva permanece bloqueada.

## Remediação obrigatória

Não renomear arquivos de forma cega, porque parte das migrations já foi ensaiada ou aplicada manualmente na homologação.

Antes da correção definitiva:

1. consultar o histórico remoto com `supabase migration list --linked` usando somente o projeto de homologação;
2. comparar os timestamps locais e remotos;
3. escolher versões exclusivas preservando a ordem de dependência;
4. renomear somente os arquivos necessários;
5. usar `supabase migration repair` na homologação quando o histórico remoto precisar ser alinhado sem reaplicar SQL já executado;
6. executar `supabase db push --linked --dry-run`;
7. executar reset/teste em ambiente descartável ou branch de banco;
8. registrar as versões finais e o resultado no issue #3.

Nenhuma ação de reparo ou renomeação será feita em produção. Produção permanece proibida sem aprovação expressa, backup, plano de rollback e smoke tests.
