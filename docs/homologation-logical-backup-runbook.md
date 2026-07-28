# Backup lógico recuperável da homologação

## Escopo

Este procedimento gera um backup lógico do projeto Supabase de homologação `vazozolhbehnriytzcdc` antes de qualquer `migration repair` ou aplicação das migrations pendentes.

Produção (`uefwywizqhfvvijaopcn`) é proibida.

## Pré-requisitos protegidos

No environment GitHub `homologation`, configurar diretamente no cofre:

- `SUPABASE_HOMOLOGATION_DB_URL`: URL PostgreSQL completa do projeto de homologação, preferencialmente pelo Session Pooler;
- a URL deve conter a senha atual do banco e nunca pode ser registrada em commits, issues, logs manuais ou mensagens.

O workflow não executa SQL de alteração, `migration repair`, `db push`, deploy ou merge.

## Execução

Workflow: **Backup lógico recuperável da homologação**.

Entradas obrigatórias:

- `confirmation`: `GERAR BACKUP SOMENTE HOMOLOGACAO vazozolhbehnriytzcdc`;
- `expected_commit`: SHA completo autorizado da branch `reestruturacao/ux-crm-operacao-imagens-v1`;
- `backup_label`: identificador sem espaços, por exemplo `pre-repair-20260728-1800`.

## Arquivos gerados

- `roles.sql`;
- `schema.sql`;
- `data.sql`;
- `history_schema.sql`;
- `history_data.sql`;
- `history.csv`;
- `manifest.json`;
- `manifest.md`.

O manifesto registra projeto, commit, data/hora, tamanho e SHA-256 de cada arquivo. A execução também valida novamente os hashes antes de publicar o artefato.

## Storage

O dump SQL preserva os metadados do banco, mas não os objetos binários armazenados nos buckets. O backup do Storage é uma operação separada e deve registrar:

- lista de buckets;
- caminhos dos objetos;
- tamanho e tipo de conteúdo;
- download dos arquivos;
- SHA-256 por objeto ou por arquivo compactado;
- manifesto independente.

A ausência do backup de Storage não autoriza repair ou migrations quando houver arquivos de homologação que precisem ser recuperáveis.

## Evidência aceita pelo repair

Depois de baixar e conferir o artefato, a evidência operacional deve usar o formato:

`BACKUP CONFIRMADO <data ISO> <horário UTC> <backup_label> <digest do artefato>`

Essa evidência deve ser informada ao workflow de repair sem incluir URL de banco, senha, token ou qualquer outro segredo.

## Restauração de teste

Antes de considerar o backup recuperável:

1. validar os hashes do manifesto;
2. confirmar que todos os arquivos SQL são não vazios;
3. preferencialmente restaurar em banco descartável;
4. executar `psql` com transação única e `ON_ERROR_STOP=1`;
5. conferir tabelas fundamentais, funções, RLS e histórico de migrations;
6. preservar o relatório do teste.

## Sequência posterior

1. gerar e validar o backup;
2. executar os três repairs históricos aprovados;
3. gerar novo snapshot remoto;
4. executar `supabase db push --linked --dry-run`;
5. aplicar as 17 migrations somente na homologação;
6. executar testes de RPC, RLS, custos, Festival de Fatias, caixa e imagens;
7. publicar somente na Netlify de homologação;
8. executar Playwright e smoke tests externos.
