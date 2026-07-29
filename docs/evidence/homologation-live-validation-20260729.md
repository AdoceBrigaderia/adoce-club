# Evidência viva da homologação — 29/07/2026

## Escopo

Validação exclusivamente no projeto Supabase de homologação `vazozolhbehnriytzcdc` e no site Netlify de homologação `f0cc51be-a0ec-4451-9644-a394592cdc37`.

A referência produtiva `uefwywizqhfvvijaopcn` e o site produtivo `bb0c96cd-5af2-4270-a9a8-b63b9637b1f4` permaneceram proibidos e não foram utilizados.

## Estado das migrations

Consulta direta e somente leitura ao histórico remoto confirmou as 22 versões planejadas, de `20260728073000` até `20260728225000`.

Resultado observado:

- migrations esperadas: 22;
- migrations registradas na homologação: 22;
- versões ausentes: 0;
- versões extras no intervalo auditado: 0.

Esta evidência descreve o estado observado do banco. Ela não atribui a aplicação das migrations ao transporte estático da Netlify nem executa novamente o lote.

## Auditoria pós-migration

A auditoria `supabase/tests/homologation_post_migration_live.sql` foi executada em transação encerrada com `ROLLBACK` e terminou sem exceções.

Foram confirmados:

- tabelas fundamentais do montador, produtos configuráveis e motor de custos;
- RLS habilitado nas relações protegidas;
- ausência de acesso direto de leitura e escrita para `anon` e `authenticated` nas tabelas BFF/RPC-only auditadas;
- funções privadas de canonicalização, redação e snapshots financeiros;
- RPCs administrativas e públicas esperadas;
- seis produtos configuráveis reais completos;
- histórico remoto integral das 22 migrations.

## Auditoria das RPCs privilegiadas

A auditoria viva de `SECURITY DEFINER` foi executada em transação encerrada com `ROLLBACK` e terminou sem exceções para as funções críticas novas.

Confirmado:

- `get_configurable_product_catalog(text)` e `public_get_cake_builder_catalog(uuid)` possuem `search_path` vazio, filtram somente registros ativos/publicados e não devolvem custos internos reais;
- RPCs gerenciais não são executáveis por `anon`, usam `private.is_manager()` e possuem `search_path` vazio;
- o workspace de encomendas exige usuário autenticado e valida atribuição/permissão operacional por loja.

O arquivo versionado `supabase/tests/homologation_security_definer_live.sql` preserva esse gate de forma repetível.

## Transporte atômico pela Netlify de homologação

O workflow `Empacotar migrations pendentes da homologação`, execução `30411201171`, concluiu com sucesso.

Evidências do bundle:

- migrations: 22;
- `BEGIN` externo: 1;
- `COMMIT` externo: 1;
- registros de histórico: 22;
- atomicidade: aprovada;
- SHA-256 do bundle: `6361e156fc6d0b787b067796220050b1ff3db754cd5c25f218bc947ac4e1d0c2`;
- deploy de homologação: `6a694904cfc6847aaf65a091`;
- secret scan da Netlify: sem ocorrências.

A autorização cifrada de uso único foi removida da branch depois do consumo.

## Tentativas registradas

1. Execução `30411015551`: falhou antes do deploy porque o parent autorizado ficou desatualizado após avanço concorrente da branch.
2. Repetição dos jobs com falha: mesma falha determinística, sem acesso ao banco e sem publicação.
3. Execução `30411201171`: autorização alinhada ao head, transporte atômico e publicação somente na Netlify de homologação concluídos.

## Pendências dos advisors

A leitura dos advisors do Supabase apontou itens que permanecem em tratamento:

- proteção contra senhas conhecidas como comprometidas ainda desativada no Auth;
- avisos de `SECURITY DEFINER` que precisam permanecer classificados entre catálogos públicos, RPCs de clientes, equipe e gerência;
- tabelas RPC/BFF-only com RLS habilitado e sem policy direta, situação intencional que deve continuar documentada e testada;
- chaves estrangeiras sem índice de cobertura, incluindo relações novas do montador, snapshots financeiros e produtos configuráveis;
- policies permissivas duplicadas em algumas tabelas legadas e públicas.

Os avisos de índices não usados não autorizam remoção automática, pois a homologação ainda possui tráfego insuficiente para essa decisão.

## Próximo marco seguro

- reconciliar o catálogo do montador sem apagar histórico, despublicando opções que saíram do cadastro comercial;
- executar o seed primeiro com rollback e depois somente na homologação;
- manter a auditoria de RPCs privilegiadas como gate manual redigido;
- preparar uma rodada específica de índices das novas relações, sem misturar alterações legadas e sem aplicar em produção;
- publicar o portal funcional somente na Netlify de homologação após os gates.

## Produção

Nenhum merge, migration, seed, deploy, alteração de variável ou acesso operacional foi realizado em produção durante esta validação.
