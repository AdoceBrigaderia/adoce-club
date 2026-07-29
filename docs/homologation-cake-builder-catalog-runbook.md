# Catálogo real do montador de tortas — homologação

## Objetivo

Aplicar, validar e auditar o catálogo real do montador de tortas somente no Supabase de homologação, sem criar produtos comerciais fictícios e sem qualquer capacidade de publicação produtiva.

## Escopo

O procedimento usa exclusivamente:

- branch `reestruturacao/ux-crm-operacao-imagens-v1`;
- projeto Supabase de homologação `vazozolhbehnriytzcdc`;
- seed `supabase/seeds/homologation/20260729_real_cake_builder_catalog.sql`;
- auditoria viva `supabase/tests/homologation_cake_builder_catalog_live.sql`;
- workflow manual `Aplicar catálogo real do montador somente na homologação`.

O seed reaproveita os produtos comerciais publicados `torta-p`, `torta-m` e `torta-g`. Ele não cadastra novos produtos, não inventa frutas, adicionais, custos ou acréscimos.

## Pré-requisitos obrigatórios

1. As 22 migrations pendentes precisam estar aplicadas e auditadas na homologação.
2. O GitHub Environment `homologation` precisa possuir o secret `SUPABASE_HOMOLOGATION_DB_URL` apontando exclusivamente para o projeto de homologação.
3. Deve existir backup recuperável confirmado antes da execução.
4. O commit autorizado precisa ser o HEAD exato da branch no momento do disparo.
5. O PR #10 deve permanecer aberto, em rascunho e sem merge.

## Entradas do workflow

### `expected_commit`

SHA completo do HEAD autorizado.

### `backup_evidence`

Texto iniciado por:

```text
BACKUP CONFIRMADO
```

A evidência deve identificar data, horário e referência do backup recuperável.

### `confirmation`

Texto exato:

```text
APLICAR CATALOGO REAL DO MONTADOR SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc
```

## Sequência protegida

1. Confirma branch, SHA, backup e URL PostgreSQL.
2. Rejeita URL que não contenha a referência da homologação.
3. Rejeita explicitamente a referência produtiva.
4. Executa os testes contratuais do seed e do workflow.
5. Gera uma cópia do seed cujo `COMMIT` final é substituído por `ROLLBACK`.
6. Executa o ensaio completo e reversível no banco.
7. Aplica o seed original somente após o ensaio aprovado.
8. Executa a auditoria viva em transação somente leitura operacional, finalizada com `ROLLBACK`.
9. Preserva manifesto, hashes, logs e evidências redigidas por 30 dias.

## Critérios de aprovação

- Existem exatamente três produtos comerciais elegíveis.
- Existem exatamente três templates ativos e publicados.
- Cada template possui três camadas de massa e duas de recheio.
- Mistura de massas permanece desabilitada.
- Mistura de recheios permanece habilitada.
- Todas as massas e recheios presentes no catálogo comercial aparecem no montador.
- Cada template possui exatamente um acabamento padrão ativo e publicado.
- Opções provisórias não possuem preço ou custo diferente de zero.
- Nenhum produto comercial é criado pelo seed.

## Falhas e repetição

Falhas transientes de runner, instalação de pacote ou conectividade podem ser repetidas até três vezes. Falhas reais de contrato, SQL, catálogo ou auditoria devem ser corrigidas no código antes de nova execução.

Uma falha durante o ensaio não altera dados, porque o arquivo termina em `ROLLBACK`. Uma falha depois da aplicação exige inspeção dos artefatos e nova auditoria antes de qualquer outra ação.

## Produção

Este procedimento não:

- executa `db push`;
- realiza deploy na Netlify;
- faz merge do PR;
- acessa o Supabase produtivo;
- altera DNS ou variáveis produtivas.

Qualquer ação produtiva permanece proibida sem aprovação expressa, backup, plano de rollback e smoke tests confirmados.
