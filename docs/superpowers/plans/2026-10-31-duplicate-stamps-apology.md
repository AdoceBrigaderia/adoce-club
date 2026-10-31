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

- [ ] Após autorização: aplicar exclusivamente a nova migração de auditoria; publicar uma vez no domínio oficial e validar autenticação e simulação.
- [ ] Executar lotes manuais até esgotar pendências. Conferir SID, auditoria, falhas e reservas sem resultado, sem repetir tentativas incertas. Aceite Twilio não comprova entrega: conferir status dos SIDs no servidor.
- [ ] Confirmar 100 registros `stamps.duplicate_apology_sent` e listar falhas. Se não atingir 100, reportar diferença e investigar antes de qualquer reenvio manual.

## Etapa 3 — remoção

- [ ] Remover endpoint e código de envio, manter auditoria e índices de proteção, documentar resultado, testar, commit e push.
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
