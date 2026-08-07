# Integridade e reconciliação das migrations de homologação

Atualização de 07/08/2026. Esta evidência acompanha a branch `homologacao-adoce` e o Supabase de homologação `vazozolhbehnriytzcdc`. Produção não participa desta auditoria.

## Resultado atual

A consulta ao histórico vivo da homologação confirmou 152 migrations aplicadas. O inventário local possui os mesmos 152 arquivos, com versões e nomes idênticos. Não há migration pendente, drift de versão, nome duplicado ou arquivo sem correspondência.

O snapshot gerado diretamente da consulta ao vivo está em:

- `docs/evidence/homologation-migrations-20260807.json`

Os snapshots anteriores foram preservados com o sufixo `.superseded.json`, pois registram corretamente o estado histórico de 27 e 28/07, antes da atualização do banco.

## Correções históricas confirmadas

O snapshot de 27/07 continha entradas duplicadas que já não existem no histórico vivo. As versões canônicas preservadas na homologação são:

- `backend_only_tables_explicit_deny`: `20260727035116` (a entrada histórica `20260727035059` foi superada);
- `operational_foreign_key_indexes`: `20260727035246` (a entrada histórica `20260727035343` foi superada);
- `public_analytics_bff_only`: `20260727035513` (a entrada histórica `20260727040533` foi superada).

Nenhuma migration foi aplicada, reparada ou removida por esta atualização de evidência.

## Proteções e relatórios

```bash
npm run audit:migrations
npm run audit:migration-reconciliation
npm run report:homologation-pending-migrations
```

Os relatórios continuam estritos: qualquer novo arquivo local posterior à baseline que não esteja representado pelo snapshot torna o plano inválido. Uma baseline alinhada só é válida quando declara zero pendências.

## Produção

Produção permanece fora deste processo. As migrations pendentes no projeto produtivo continuam sendo um alerta separado e não foram modificadas.
