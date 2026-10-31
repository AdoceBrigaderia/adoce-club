# Aviso sobre carimbos duplicados — plano de execução

**Objetivo:** avisar uma única vez cada cartão afetado, com os dois textos exatos aprovados pelo proprietário em 31/10/2026.

**Arquitetura:** função temporária manual, exclusiva do proprietário autenticado. Consulta somente leitura das reversões, perfis, cartões e recompensas; envio no servidor Netlify pelo template de atendimento, variável `1`. Reserva persistente em `audit_events` antes de cada tentativa, protegida por índice único, impede concorrência e repetição após falhas ou interrupções. Até 20 tentativas por chamada, com limite de tempo. Nenhum agendamento.

**Restrições:** somente `D:\AdoceOnLine`; preservar `38f184e` e o estorno; nunca modificar `ledger_entries`, `loyalty_tracks`, `rewards`; nunca obter credenciais Twilio localmente; não publicar nem enviar sem autorização explícita. Não armazenar lista de clientes no Git.

## Etapa 1 — preparação local autorizada

- [x] Testes antes da implementação: textos exatos, agrupamento, integridade 144/100/233 e 92/8, dados inválidos, envios anteriores, concorrência, falhas Twilio e falhas de auditoria após aceite.
- [x] Implementar composição e simulação compartilhadas, seleção por reversões e auditoria; índice único de reserva e de envio em migração nova, sem aplicar em produção.
- [x] Implementar endpoint POST proprietário, modo padrão simulação, envio explicitamente solicitado, template obrigatório, sem retries automáticos. Reservas nunca expiram nem são apagadas automaticamente.
- [x] Executar consulta somente leitura real e simulação local, apresentar contagens e um exemplo de cada texto. Executar `npm run release:check`, revisar, commit e push sem disparar publicação.

## Etapa 2 — depende de autorização para publicar E enviar

- [x] Após autorização: aplicar exclusivamente a nova migração de auditoria; publicar uma vez no domínio oficial e validar autenticação e simulação.
- [x] Executar lotes manuais até esgotar pendências. Conferir SID, auditoria, falhas e reservas sem resultado, sem repetir tentativas incertas. Aceite Twilio não comprova entrega; entrega/leitura individual permanece sem aferição no provedor.
- [x] Confirmar 100 registros `stamps.duplicate_apology_sent` e listar falhas. Se não atingir 100, reportar diferença e investigar antes de qualquer reenvio manual.

## Etapa 3 — remoção

- [x] Remover endpoint e código de envio, manter auditoria e índices de proteção, documentar resultado, testar, commit e push.
- [ ] Pedir autorização explícita para publicar a remoção; publicar e confirmar endpoint indisponível no domínio oficial. Git limpo e igual ao remoto.

## Decisões e evidências

- O pedido já especifica destinatários, texto, provedor, trilha de auditoria e portões de autorização; execução direta deste plano dentro desse escopo.
- Reserva permanente prioriza ausência de envio duplicado em caso de timeout entre Twilio e banco. Não é possível garantir transação atômica entre esses dois serviços; resultados incertos exigem conciliação manual pelo SID.
- Consulta real inicial: 144 reversões, 100 cartões, 100 clientes e 233 carimbos. Nenhuma escrita realizada.
- Simulação com dados atuais: 92 textos comuns, 8 textos de fatia cancelada, 100 pendentes, zero tentativas anteriores; nenhum envio. Exemplos: saldo 10/14 no texto comum e 12/14 (faltam 2) no texto de fatia cancelada.
- Revisão independente e leitura das permissões reais identificaram INSERT/UPDATE/DELETE concedidos ao papel autenticado na auditoria, com RLS. Acrescentadas políticas restritivas somente para os três marcadores da campanha, impedindo falsificação ou remoção por sessões do aplicativo.
- 16 testes focados aprovados; tipagem explícita do endpoint aprovada; SQL executado em Postgres embutido local descartável, com políticas, grants, reserva única e preservação das tabelas do Clube. Concorrência distribuída real e integração Twilio dependem da publicação autorizada.
- `npm run release:check`: aprovado (173 arquivos de testes, 992 testes aprovados, 1 ignorado; tipos, build, documentação e proteções do projeto aprovados). Revisão final independente sem achados materiais. Nenhuma interface alterada.
- Antes do push, consultada a configuração real Netlify: repositório de publicação diferente do remoto Git desta tarefa, branch de produção `main`, sem branches adicionais permitidas. Push desta etapa não publica o mecanismo. Publicação e envio continuam aguardando autorização explícita.
- Em seguida o proprietário autorizou explicitamente aplicar a proteção, publicar e enviar. Ruling: acrescentado controle temporário dentro da auditoria exclusiva do proprietário para acionar a API por sua sessão existente, sem transferir credenciais nem usar console de código no navegador. Revisão independente sem achados materiais; testes de sessão, modo padrão e ausência de retry aprovados.
- Proteção aplicada isoladamente e registrada no histórico remoto. Verificados os dois índices, as três políticas restritivas e a execução exclusiva do RPC por `service_role`.
- Ruling: o deploy padrão da CLI consulta variáveis de functions mesmo sem build. Preparado publicador com os módulos oficiais da CLI, configuração offline e bloqueio de consultas de env, preservando release:check e Git limpo. O servidor recebe os pacotes; credenciais de runtime continuam na Netlify.
- Ensaio completo do publicador sem rede: 457 arquivos, 44 funções, duas agendas preservadas e rota do aviso presente. O primeiro preparo remoto permaneceu em estado `new`, sem publicação, após falha local; o publicador permite retomar exclusivamente esse estado no mesmo site.
- Publicado no mesmo deploy `6ae6214f7b05e4cf19a01708`, pacote `8e13789`. Releasecheck: 994 testes aprovados e 1 ignorado. Domínio oficial e recusa anônima conferidos; painel verificado em computador/celular/tablet, console sem erros.
- Cinco lotes de 20 entre 14h15 e 14h17 de 31/10/2026 (São Paulo). Conferência independente: 100 eventos sent, 100 cartões, 100 SIDs distintos, 92/8 variantes, zero destinatários externos, zero pendências, zero falhas e zero reservas incertas. O status de entrega ao aparelho não foi consultado; o resultado significa aceite pelo provedor.
- Retirada local preparada: removidos emissor, endpoint, controle, serviço e scripts específicos; tela original e netlify.toml idênticos a `38f184e`. Migração `20261031210000` preparada, ainda não aplicada. Revisão independente sem achados materiais; nova autorização de produção pendente.
- Retirada validada automaticamente: release:check aprovado (978 testes aprovados, 1 ignorado), empacotamento offline aprovado com 457 arquivos, 43 funções e as duas agendas anteriores preservadas. Nenhuma publicação da retirada realizada.
