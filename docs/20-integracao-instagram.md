---
title: Integração oficial com o Instagram
description: Fundação segura, fases, configuração externa e critérios de homologação do canal Instagram.
status: Fundação implementada localmente; automação e produção desativadas
---

# Integração oficial com o Instagram

## Estado real

O portal usa React/Vite, Supabase e Netlify Functions em TypeScript. Não existe backend Go neste repositório. O Instagram será um canal do portal, nunca uma segunda fonte de preços, estoque, reservas, pagamentos ou carimbos.

A fundação local inclui:

- endpoint separado `GET/POST /api/meta-instagram-webhook`;
- validação HMAC SHA-256 da assinatura `x-hub-signature-256`;
- limite de 512 KiB e no máximo 100 eventos por entrega;
- validação da conta profissional configurada;
- idempotência pelo identificador da mensagem/evento da Meta;
- fila persistente com `FOR UPDATE SKIP LOCKED`;
- conversas, vínculos de cliente, mensagens e outbox privados;
- RLS e leitura interna mínima;
- flags para desligar integração, automação e cada fluxo sensível;
- testes sem chamadas reais à Meta.

Por segurança, `INSTAGRAM_INTEGRATION_ENABLED=false` é o padrão. A fundação apenas recebe e enfileira eventos assinados quando essa flag é ligada. Ela ainda não responde ao cliente, cria reservas, gera pagamentos nem movimenta carimbos.

## Arquitetura

```text
Instagram profissional
  -> webhook oficial HTTPS
  -> validação de token, assinatura, tamanho e conta
  -> channel_external_events (idempotência e fila)
  -> processador determinístico futuro
  -> serviços oficiais do portal
  -> channel_outbox_messages
  -> Send API oficial
```

O webhook do WhatsApp continua isolado porque hoje confirma apenas códigos de telefone. Misturar os dois formatos criaria risco de regressão.

## Dados privados

- `channel_accounts`: conta e ambiente, sem token.
- `customer_channel_links`: vínculo verificado entre identificador externo e cliente.
- `channel_conversations`: estado, janela de resposta, automação e atendente.
- `channel_external_events`: entrada idempotente, tentativas e dead-letter.
- `channel_messages`: histórico de entrada e saída.
- `channel_outbox_messages`: envio confiável; criar uma saída não significa que a Meta a entregou.

As tabelas não possuem acesso anônimo. Escritas de webhook e processamento usam somente a chave secreta do servidor. Tokens nunca ficam no navegador ou no banco.

## Limites oficiais considerados

- A conta precisa ser profissional.
- As conversas são iniciadas pelo cliente e respeitam a janela normal de resposta.
- O uso de `HUMAN_AGENT` é para atendimento humano permitido, não para prolongar automação.
- Comentários permitem uma resposta privada inicial dentro do prazo da plataforma; outras mensagens dependem de resposta do cliente.
- Produção para contas externas pode exigir Advanced Access, App Review e Business Verification.
- Disponibilidade, preço, estoque, pagamento e carimbos nunca serão decididos por texto fixo ou IA.

Referências oficiais consultadas em agosto de 2026:

- [Instagram API oficial](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Send API do Instagram](https://www.postman.com/meta/instagram/folder/23987686-f05b6c9f-a4be-4511-9f88-1cd94828fdf3)
- [Assinatura e inscrição de webhooks](https://www.postman.com/meta/instagram/request/23987686-0223707a-7035-46a2-8015-1fdf7249278f)

## Variáveis do servidor

```env
INSTAGRAM_INTEGRATION_ENABLED=false
INSTAGRAM_AUTOMATION_ENABLED=false
INSTAGRAM_RESERVATIONS_ENABLED=false
INSTAGRAM_PAYMENTS_ENABLED=false
INSTAGRAM_LOYALTY_ENABLED=false
INSTAGRAM_COMMENTS_ENABLED=false
INSTAGRAM_STORIES_ENABLED=false
INSTAGRAM_AI_CLASSIFICATION_ENABLED=false
META_INSTAGRAM_ACCOUNT_ID=
META_INSTAGRAM_APP_SECRET=
META_INSTAGRAM_VERIFY_TOKEN=
META_ENVIRONMENT=staging
```

`SUPABASE_URL` e `SUPABASE_SECRET_KEY` já fazem parte da camada de servidor. Nenhuma variável acima pode receber o prefixo `VITE_`.

## Checklist do proprietário

Estas ações só devem ser feitas quando a homologação técnica estiver publicada.

| AÇÃO | ONDE CLICAR | DADO NECESSÁRIO | RESULTADO ESPERADO | COMO VALIDAR |
| --- | --- | --- | --- | --- |
| Confirmar conta profissional | Instagram > Configurações > Tipo e ferramentas da conta | Login oficial | Conta Business ou Creator | O painel profissional aparece no Instagram |
| Selecionar aplicativo | [Meta for Developers](https://developers.facebook.com/apps/) | Conta Meta proprietária | Aplicativo da Adoce aberto | O ID do aplicativo corresponde ao ambiente |
| Adicionar Instagram | Aplicativo > Adicionar produto > Instagram | Conta profissional | Instagram configurado no app | A conta aparece entre os ativos permitidos |
| Configurar webhook de homologação | Aplicativo > Instagram > Webhooks | URL e token entregues pelo suporte | Desafio retorna sucesso | O painel mostra a inscrição ativa |
| Autorizar permissões | App Review > Permissions and Features | Justificativas e gravação do fluxo | Permissões aprovadas quando necessárias | Status `Advanced Access` nas permissões usadas |
| Confirmar negócio | Business Settings > Security Center | Dados oficiais da empresa | Verificação concluída, se solicitada | Status verificado no portfólio |
| Teste final | Instagram oficial e painel de homologação | Mensagem `sabores` | Um único evento aparece na fila | Nenhuma duplicidade após reenviar o evento |

Não envie token ou segredo por mensagem. Eles serão inseridos diretamente nas variáveis protegidas da Netlify.

## Fases restantes

1. Homologar recebimento assinado e confirmar o formato real da conta.
2. Implementar o processador determinístico para menu, sabores, localização e atendimento humano.
3. Implementar outbox e envio dentro da janela permitida.
4. Reutilizar o serviço de pré-reserva, sem duplicar estoque ou preço.
5. Automatizar pagamento somente depois de existir geração e webhook confiáveis do provedor.
6. Vincular cliente e liberar consulta do Clube com verificação adicional.
7. Habilitar comentários e Stories após revisão das permissões.
8. Fazer piloto limitado e só então solicitar produção.

## Rollback

Desligar `INSTAGRAM_INTEGRATION_ENABLED` interrompe imediatamente a ingestão sem afetar o portal. As tabelas devem ser preservadas para auditoria. A remoção de dados exige política de retenção, avaliação LGPD e autorização específica.
