# Backup lógico recuperável da homologação

## Escopo

Este procedimento gera backups recuperáveis do projeto Supabase de homologação `vazozolhbehnriytzcdc` antes de qualquer `migration repair` ou aplicação das migrations pendentes.

Produção (`uefwywizqhfvvijaopcn`) é proibida.

## Pré-requisitos protegidos

No environment GitHub `homologation`, configurar diretamente no cofre:

- `SUPABASE_HOMOLOGATION_DB_URL`: URL PostgreSQL completa do projeto de homologação, preferencialmente pelo Session Pooler;
- `SUPABASE_HOMOLOGATION_SERVICE_ROLE_KEY`: chave exclusiva da homologação para leitura dos objetos do Storage;
- nenhum desses valores pode ser registrado em commits, issues, logs manuais ou mensagens.

Os workflows de backup não executam SQL de alteração, `migration repair`, `db push`, deploy ou merge.

## Backup lógico do banco

Workflow: **Backup lógico recuperável da homologação**.

Entradas obrigatórias:

- `confirmation`: `GERAR BACKUP SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc`;
- `expected_commit`: SHA completo autorizado da branch `reestruturacao/ux-crm-operacao-imagens-v1`;
- `backup_label`: identificador sem espaços, por exemplo `pre-repair-20260728-1800`.

### Arquivos gerados

- `roles.sql`;
- `schema.sql`;
- `data.sql`;
- `history_schema.sql`;
- `history_data.sql`;
- `history.csv`;
- `manifest.json`;
- `manifest.md`.

O manifesto registra projeto, commit, data/hora, tamanho e SHA-256 de cada arquivo. A execução também valida novamente os hashes antes de publicar o artefato.

## Backup separado do Storage

O dump SQL preserva metadados do banco, mas não os objetos binários armazenados nos buckets.

Workflow: **Backup separado do Storage da homologação**.

Entradas obrigatórias:

- `confirmation`: `GERAR BACKUP STORAGE SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc`;
- `expected_commit`: o mesmo SHA completo usado no backup lógico;
- `backup_label`: o mesmo identificador operacional do backup lógico.

O workflow:

- lista todos os buckets da homologação;
- percorre pastas e paginações;
- baixa cada objeto sem alterar o Storage;
- rejeita caminhos com travessia de diretórios;
- preserva o tipo de conteúdo;
- calcula tamanho e SHA-256 por objeto;
- gera `storage-manifest.json`;
- valida novamente todos os hashes antes de publicar o artefato.

A ausência do backup do Storage não autoriza repair ou migrations quando houver arquivos de homologação que precisem ser recuperáveis.

## Evidência aceita pelo repair

Depois de baixar e conferir os dois artefatos, a evidência operacional deve usar o formato:

`BACKUP CONFIRMADO <data ISO> <horário UTC> <backup_label> <digest SQL> <digest Storage>`

Essa evidência deve ser informada ao workflow de repair sem incluir URL de banco, senha, token ou qualquer outro segredo.

## Restauração de teste

Antes de considerar o backup recuperável:

1. validar os hashes dos dois manifestos;
2. confirmar que todos os arquivos SQL são não vazios;
3. confirmar que a quantidade de objetos baixados coincide com o manifesto;
4. preferencialmente restaurar o banco em ambiente descartável;
5. executar `psql` com transação única e `ON_ERROR_STOP=1`;
6. conferir tabelas fundamentais, funções, RLS e histórico de migrations;
7. conferir amostras dos objetos de cada bucket;
8. preservar o relatório do teste.

## Sequência posterior

1. gerar e validar o backup lógico e o backup do Storage;
2. executar os três repairs históricos aprovados;
3. gerar novo snapshot remoto;
4. executar `supabase db push --linked --dry-run`;
5. aplicar as 17 migrations somente na homologação;
6. executar testes de RPC, RLS, custos, Festival de Fatias, caixa e imagens;
7. publicar somente na Netlify de homologação;
8. executar Playwright e smoke tests externos.
