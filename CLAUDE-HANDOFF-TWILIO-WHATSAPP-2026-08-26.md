# Repasse ao Claude — Twilio e pedidos pelo WhatsApp

Data: 26/08/2026  
Fonte atual: `D:\Clube Adoce Replica Local\app\working-copy`

## 1. Decisões obrigatórias do proprietário

1. A aplicação geral passa a se chamar **Adoce**.
2. **Clube Adoce** continua sendo somente o programa de fidelidade e a área de Clientes.
3. Toda homologação será executada na máquina local do proprietário.
4. **Não criar outro projeto Supabase de homologação**, nem vazio.
5. Não usar o Supabase de produção em testes locais.
6. Não publicar a aplicação no Netlify enquanto o portão `npm run release:check` não passar integralmente.
7. Não alterar produção, DNS, domínio oficial, banco de produção ou deploy de produção.
8. Credenciais Twilio ficam apenas em `.env.local` ou no mecanismo local equivalente, nunca no Git, documentação, frontend ou logs.

## 2. Mudanças de infraestrutura já concluídas

### Git

- A homologação antiga foi eliminada do GitHub.
- Foram removidas cinco branches remotas antigas de homologação, backup e redesign.
- A branch remota `homologacao-adoce` foi substituída por um histórico novo criado a partir desta pasta local.
- Commit inicial da nova fonte: `381c4164e4a5abb89e71534616547f6e38441ec5`.
- Repositório oficial: `AdoceBrigaderia/adoce-club`.
- Também foram removidas cinco branches locais, uma tag e dois worktrees antigos de homologação.
- Não restou referência local antiga contendo `homolog` no repositório legado.
- A produção privada `RMBPS/clube-adoce`, branch `main`, não foi alterada.

### Supabase

- O projeto remoto `Clube Adoce - Homologacao`, referência `vazozolhbehnriytzcdc`, foi excluído permanentemente.
- Banco, Auth, Storage, Edge Functions, backups, chaves e configurações desse projeto foram removidos.
- O projeto de produção `uefwywizqhfvvijaopcn` permaneceu intocado e foi confirmado como `ACTIVE_HEALTHY` após a exclusão.
- O app local usa Supabase local em `127.0.0.1`.
- Não criar substituto remoto para a homologação.

### Netlify

- O site antigo de homologação, ID `f0cc51be-a0ec-4451-9644-a394592cdc37`, foi excluído com seu histórico.
- Foi criado um projeto Netlify novo e vazio com o mesmo endereço.
- Novo ID: `fb7bdf65-1998-4bb0-92ac-3971c293cc3b`.
- Endereço reservado: `https://adoce-homologacao.netlify.app`.
- O endereço está vazio e retorna 404 intencionalmente.
- Não tentar fazer o Netlify acessar `localhost`; servidores Netlify não enxergam a máquina do proprietário.

### Validação da fonte

- 108 arquivos de teste passaram.
- 736 testes passaram.
- TypeScript passou.
- O build chegou ao gerador de SEO.
- `release:check` foi bloqueado porque o Supabase local retornou 0 sabores e o gerador exige pelo menos 26 sabores públicos.
- Isso deve ser corrigido no ambiente local antes de qualquer publicação, sem usar produção como atalho.

## 3. Situação atual de WhatsApp no código

- Ainda não existe integração Twilio de WhatsApp implementada.
- `supabase/config.toml` possui `[auth.sms.twilio]`, atualmente desabilitado. Essa seção é de **SMS do Supabase**, não é o motor do bot de pedidos por WhatsApp.
- Há uma fundação anterior de autenticação via **Meta WhatsApp Cloud API**, incluindo:
  - `netlify/functions/auth-whatsapp-start.ts`;
  - `netlify/functions/auth-whatsapp-verify.ts`;
  - `netlify/functions/meta-whatsapp-webhook.ts`;
  - `netlify/functions/_shared/whatsapp-auth.ts`;
  - migração `20260821092506_whatsapp_auth_hook_foundation.sql`.
- Não misturar silenciosamente Meta Cloud API e Twilio. Definir um adaptador de canal e escolher explicitamente o provedor ativo.
- O pedido web atual registra o pedido no banco e depois abre `wa.me` com uma mensagem pronta. Isso não é automação bidirecional.
- O número padrão atual para pedidos em vários pontos do código é `+55 85 98215-6026`.
- O número `+55 85 98199-4370` também aparece e foi definido pelo proprietário para solicitações de orçamento. Confirmar qual número será o sender Twilio do bot de pedidos antes de alterar qualquer configuração.

## 4. Homologação local da Twilio

Twilio precisa entregar webhooks em um endereço HTTPS público. Como o servidor ficará local:

1. executar a aplicação e o Supabase localmente;
2. executar `netlify dev` ou o servidor local responsável pelas Functions;
3. abrir um túnel HTTPS temporário apenas para o endpoint do webhook;
4. configurar o Twilio WhatsApp Sandbox para enviar mensagens recebidas ao endereço do túnel;
5. manter o túnel somente durante os testes;
6. nunca expor diretamente Postgres, Studio, Inbucket, Docker ou portas administrativas do Supabase;
7. validar `X-Twilio-Signature` em todas as chamadas;
8. tornar o processamento idempotente pelo `MessageSid`;
9. configurar callback de status e URL de fallback;
10. não registrar Auth Token, conteúdo sensível ou telefone completo em logs.

Sugestão de endpoint local:

`POST /.netlify/functions/twilio-whatsapp-inbound`

Variáveis locais sugeridas:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_MESSAGING_SERVICE_SID` quando aplicável
- `TWILIO_WEBHOOK_BASE_URL`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_VALIDATE_SIGNATURE=true`
- `TWILIO_CONTENT_SID_MENU`
- `TWILIO_CONTENT_SID_ORDER_UPDATE`
- `TWILIO_CONTENT_SID_RESERVATION_EXPIRING`

Não prefixar segredos com `VITE_`.

## 5. Pedido completo pelo WhatsApp — viabilidade

É viável automatizar consulta de sabores, montagem do carrinho, reserva, escolha de retirada, forma de pagamento, confirmação e acompanhamento pelo WhatsApp.

O bot deve ser um **novo canal para o mesmo motor de pedido**, nunca um segundo motor com regras diferentes. Deve reutilizar preços, disponibilidade, lotes, estoque, idempotência, reserva e estados já existentes.

Componentes existentes a reaproveitar:

- `flavor_availability` — disponibilidade agregada por sabor e dia;
- `flavor_availability_batches` — lotes com `available_from`, `quantity_available` e `quantity_reserved`;
- `get_public_flavor_availability_batches(date)` — lotes públicos e quantidade livre;
- `private.flavor_batch_quantity_by_time(...)` — quantidade disponível até determinado horário;
- `submit_instant_order_v7(...)` — pedido idempotente, horário, método de retirada e reserva por lote;
- `private.instant_order_batch_allocations` — alocação do pedido nos lotes;
- `reserved_until` e `payment_expires_at` — prazo da reserva e pagamento;
- `get_checkout_payment_methods()` — formas de pagamento vigentes;
- `get_public_order_whatsapp_number()` — número público configurável;
- `src/order-whatsapp.ts` — formatação atual da mensagem e número de pedidos.

Importante: a migração `20260819170000_instant_order_sem_janela_do_cantinho.sql` removeu a exigência de uma janela fixa do Cantinho. Continuam obrigatórios horário futuro, estoque liberado até o horário, método de retirada e idempotência. Não codificar novamente “20h” como regra fixa.

## 6. Jornada recomendada

### WA-ORD-001 — Entrada

Qualquer mensagem abre ou retoma a conversa. Se a intenção estiver clara, ir direto ao ponto. Quando não estiver:

> Oi! Sou o atendimento automático da Adoce. Como posso ajudar?  
> 1 — Fazer um pedido de fatias  
> 2 — Ver sabores disponíveis  
> 3 — Acompanhar meu pedido  
> 4 — Pedir orçamento  
> 5 — Falar com uma pessoa

Aceitar número, texto e variações simples. `menu`, `início`, `voltar`, `cancelar` e `atendente` devem funcionar em qualquer etapa.

### WA-ORD-002 — Tipo de disponibilidade

> Você quer ver:  
> 1 — sabores para retirada imediata  
> 2 — sabores disponíveis mais tarde no Cantinho Adoce  
> 3 — todos os horários de hoje

- **Imediata:** somar apenas lotes já liberados no horário atual e com `quantity_free > 0`.
- **Mais tarde:** mostrar horários futuros que realmente tenham lote disponível.
- **Todos:** agrupar cada sabor pelo primeiro horário real em que pode ser retirado.
- Se não houver pronta entrega, dizer isso claramente e oferecer os próximos horários, sem retornar lista vazia.

### WA-ORD-003 — Lista de sabores

- Mostrar somente sabores realmente vendáveis.
- Numerar de `01` a `99` durante aquela conversa.
- Guardar no estado da conversa o mapeamento `código -> flavor_id` usado naquela mensagem.
- Não aceitar um código de lista antiga depois que estoque ou lista forem atualizados sem revalidar.
- Exemplo:

> Disponíveis para retirada agora:  
> 01 — Chocolatudo — 4 fatias  
> 02 — Ninho com morango — 2 fatias  
> 03 — Red Velvet — última fatia  
> Responda com o número do sabor. Para mais de um: `01x2, 03x1`.

List Picker pode ser usado para até 10 opções. Para listas maiores, paginar ou usar texto numerado. Nunca mandar dezenas de itens em uma única mensagem.

### WA-ORD-004 — Carrinho

1. receber sabor e quantidade;
2. revalidar estoque;
3. perguntar calda de cada unidade quando aplicável;
4. permitir adicionar outro sabor, alterar quantidade ou remover item;
5. identificar Clube/recompensa pelo telefone somente pelas regras seguras existentes;
6. calcular total pelo preço atual do banco, nunca por valor escrito na conversa.

### WA-ORD-005 — Retirada

- Perguntar o horário desejado usando apenas horários compatíveis com o pedido completo.
- Perguntar quem retira: `1 cliente` ou `2 entregador de aplicativo`.
- O termo correto e visível é **Cantinho Adoce**.

### WA-ORD-006 — Identificação e pagamento

- Solicitar nome e sobrenome quando ainda não reconhecido.
- Usar o telefone do remetente como WhatsApp do pedido, após normalização.
- Consultar `get_checkout_payment_methods()`.
- Não receber número de cartão, CVV ou outros dados de cartão no chat ou em WhatsApp Flow.
- Para Pix, enviar instrução ou link de pagamento seguro.
- Manter a reserva com prazo visível e liberar estoque automaticamente quando expirar ou o pedido for cancelado.

### WA-ORD-007 — Confirmação

Antes de reservar, enviar resumo completo:

> Confira seu pedido:  
> 2 Chocolatudo — 1 sem calda, 1 com calda X  
> 1 Red Velvet — sem calda  
> Retirada: hoje às 19h30  
> Retirada por: cliente  
> Pagamento: Pix  
> Total: R$ XX,XX  
> 1 — Confirmar e reservar  
> 2 — Alterar  
> 3 — Cancelar

Somente a opção `1` chama `submit_instant_order_v7` com uma `operation_key` estável para aquela confirmação.

### WA-ORD-008 — Reserva e conclusão

- Informar número do pedido, prazo da reserva, retirada e próximo passo.
- Atualizações transacionais fora da janela de 24 horas exigem templates aprovados.
- Pagamento aprovado confirma baixa e carimbos pelas regras existentes.
- Cancelamento ou expiração devolve corretamente a reserva aos lotes.
- Oferecer entrada no Clube quando `offer_club_invite` vier verdadeiro.

### WA-ORD-009 — Orçamento e atendimento humano

- Orçamento sai do fluxo automático de pedido de fatias e vai para `+55 85 98199-4370`, conforme decisão anterior do proprietário.
- Transferência humana deve preservar resumo, carrinho e etapa atual para não obrigar o cliente a repetir tudo.
- Enquanto uma pessoa estiver atendendo, o bot fica pausado para aquela conversa.

## 7. Estado e segurança sugeridos

Criar no Supabase **local**, com migração versionada e RLS/negação pública:

- conversa por telefone normalizado e estado atual;
- carrinho temporário e mapeamento dos códigos de sabor;
- eventos recebidos, identificados por `MessageSid` único;
- mensagens enviadas e status de entrega;
- controle de atendimento humano;
- expiração da conversa/carrinho;
- auditoria mínima sem armazenar conteúdo além do necessário.

O webhook deve:

1. validar assinatura antes de ler ou processar o corpo;
2. normalizar `From` e `To` no formato E.164;
3. rejeitar replay/duplicidade pelo `MessageSid`;
4. responder rapidamente e processar trabalhos demorados de modo seguro;
5. revalidar preço e estoque no banco no momento da confirmação;
6. usar transação/idempotência do pedido;
7. limitar tentativas por telefone e por etapa;
8. nunca confiar no número textual escolhido pelo cliente como ID de sabor permanente.

## 8. Regras atuais da Twilio que afetam o desenho

- Uma mensagem recebida do cliente abre uma janela de atendimento de 24 horas.
- Dentro dessa janela podem ser usadas mensagens livres e mensagens interativas compatíveis.
- Fora da janela só podem ser enviados templates aprovados.
- List Picker suporta até 10 opções e somente dentro da sessão de 24 horas.
- WhatsApp Flows permite formulário com várias telas, mas não deve transportar dados PCI.
- `twilio/catalog` pode mostrar produtos, permitir carrinho e devolver o carrinho ao negócio; avaliar somente depois que catálogo, IDs e estoque dinâmico estiverem confiáveis.

Referências oficiais:

- https://www.twilio.com/docs/whatsapp/api
- https://www.twilio.com/docs/whatsapp/sandbox
- https://www.twilio.com/docs/content/twiliolist-picker
- https://www.twilio.com/docs/content/whatsapp-flows
- https://www.twilio.com/docs/content/twilio-catalog
- https://www.twilio.com/docs/usage/webhooks/webhooks-security

## 9. Testes mínimos antes de considerar funcionando

1. webhook com assinatura válida e assinatura falsa;
2. mensagem duplicada e fora de ordem;
3. menu por número, texto, opção inválida, voltar, cancelar e atendente;
4. nenhum sabor imediato e oferta correta dos próximos horários;
5. última fatia disputada por dois clientes;
6. lista atualizada entre consulta e confirmação;
7. vários sabores com horários diferentes e cálculo do primeiro horário do pedido completo;
8. molho por unidade;
9. pedido idempotente com repetição do webhook;
10. reserva, aprovação, cancelamento e expiração com estoque correto;
11. janela de 24 horas aberta e expirada;
12. template aprovado, rejeitado e pausado;
13. transferência para pessoa e retomada pelo bot;
14. logs sem token, código OTP ou telefone completo;
15. teste real no Twilio Sandbox usando túnel HTTPS temporário;
16. toda a suíte atual continua passando.

## 10. Ordem recomendada para o Claude

1. Ler `AGENTS.md`, `docs/documentation-manifest.json`, este repasse e `docs/21-especificacao-executavel-operacao-e-whatsapp.md`.
2. Conferir código, migrações e comportamento local; não tratar a documentação histórica como prova.
3. Configurar apenas variáveis locais da Twilio, sem mostrar valores.
4. Subir Supabase e aplicação locais.
5. Configurar Twilio Sandbox e túnel HTTPS restrito ao webhook.
6. Implementar primeiro webhook seguro, estado determinístico e menu básico.
7. Ligar consulta real de sabores/lotes.
8. Ligar montagem do carrinho e `submit_instant_order_v7`.
9. Ligar pagamento/reserva e transferência humana.
10. Executar testes automáticos, funcionais, visuais e concorrentes.
11. Não fazer deploy nem tocar produção sem nova autorização explícita.

## 11. Resultado esperado da primeira entrega

Uma homologação local na qual o proprietário envia uma mensagem ao Sandbox da Twilio, recebe o menu, consulta sabores reais do Supabase local, escolhe retirada imediata ou futura, monta o pedido, confirma, gera uma reserva idempotente e vê o pedido aparecer na operação local — sem Supabase remoto, sem Netlify publicado e sem qualquer alteração em produção.
