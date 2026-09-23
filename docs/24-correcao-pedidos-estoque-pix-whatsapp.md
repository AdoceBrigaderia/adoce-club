---
title: Correção de pedidos, estoque atual, Pix e WhatsApp
description: Regras aprovadas, causa comprovada, validação local e pendências de publicação do incidente de 15/09/2026.
status: Implementado localmente; validação e publicação registradas por ambiente
---

# Pedidos, estoque atual, Pix e WhatsApp — 15/09/2026

## Escopo e limites

Correção do incidente de estoque do pedido informado pelo proprietário, cobrança Pix, comprovantes dentro do pedido, comunicação automática de etapas pelo remetente oficial e horários do bot. Este capítulo não declara auditoria integral concluída. O código de trabalho é a cópia Release WhatsApp 20260901; a raiz do diretório contém uma versão mais antiga. Alterações anteriores foram preservadas e os arquivos modificados antes desta tarefa têm cópias em `evidence/20260915-order-repair`.

## Causa comprovada do estoque

A consulta somente leitura em produção encontrou uma unidade livre de cada sabor do pedido, no saldo diário e nos lotes. A reserva usava o estoque atual, mas a alocação de lotes desconsiderava pedidos criados em outro dia ao calcular a reserva pendente. Um teste PostgreSQL local reproduziu a mesma exceção da tela antes da correção.

A data de criação do pedido não limita o estoque utilizável. Reservas e baixas usam a posição atual. `stock_service_date` rastreia a reserva efetiva; não é data de validade do pedido. Ao pagar uma reserva de outro dia, a transação libera a reserva anterior e reserva o saldo atual antes de baixá-lo. Se faltar saldo atual, a transação inteira falha sem confirmar pagamento ou consumir estoque histórico. Repetir a confirmação não duplica a baixa.

## Sequência aprovada pelo proprietário

| Estado | Significado e comunicação |
|---|---|
| Reserva recebida | Recebemos o pedido de reserva. Informar previsão dos lotes quando disponível. Não cobrar nem afirmar separação. |
| Reserva registrada | Saldo reservado. Aguardar disponibilidade e separação. Não cobrar. |
| Em separação | Equipe iniciou a separação. Não afirmar que concluiu. |
| Separação confirmada | A equipe confirma explicitamente a separação. Registrar `separation_confirmed_at` e enviar cobrança. |
| Comprovante recebido | Arquivo guardado no pedido; não equivale a pagamento aprovado. |
| Pagamento confirmado | Equipe conferiu arquivo e recebimento na conta. Aguardar liberação. |
| Liberado para retirada | Equipe liberou o pedido pago para retirada. |
| Entregue | Entrega registrada. |

Pix usa exclusivamente a chave informada pelo proprietário: `pagamentos@adocebrigaderia.com.br`. Não exigir link para Pix. O bot não apresenta a chave antes da confirmação de separação. Para outro meio de pagamento, permanece a necessidade de informação compatível com esse meio.

O registro de venda já paga/concluída permanece uma ação operacional explícita; não deve gerar uma sequência atrasada de cobranças ao cliente. A fila descarta avisos pendentes que já não correspondem ao estado atual.

## Comprovantes e segurança

Imagens JPG, PNG, WebP e PDF, limitados a 16 MiB por arquivo, são guardados em `order-payment-receipts`, privado. Metadados ficam no schema `private`, com RLS e sem acesso direto de visitantes/clientes. O servidor exige sessão operacional autorizada para emitir URLs de leitura de cinco minutos. Segredos e credenciais Twilio não chegam ao navegador.

Número do pedido precisa pertencer ao telefone remetente. Sem número explícito, só associar automaticamente quando existir um único pedido Pix pendente elegível. Na ambiguidade, guardar o anexo e solicitar o número. Cada resposta associa somente o primeiro lote de mensagem pendente, e o bot informa a ordem dos envios. Não associar todos os arquivos de um telefone ao mesmo pedido. Receber arquivo nunca aprova pagamento.

Fotos de referência em atendimento humano continuam no suporte; só tratar como comprovante nesse contexto quando houver identificação de pedido ou legenda de pagamento. Arquivos de pedido podem chegar fora do horário. Falhas de armazenamento não podem ser respondidas como sucesso. A chave de armazenamento é estável por mensagem para evitar duplicação de arquivos nas tentativas.

## Avisos oficiais e dependências externas

Mudanças persistidas de etapa geram eventos em `private.order_customer_notifications`. O servidor usa exclusivamente `TWILIO_WHATSAPP_FROM`, nunca o WhatsApp do operador. A operação remove os atalhos manuais das etapas e mostra pendente, processamento, aceito, entregue, lido, falha ou envio incerto. Aceitação pela API não significa entrega ao cliente.

Callbacks validam assinatura e tentativa. Um callback atrasado não pode substituir o resultado de outra tentativa nem transformar falha de entrega em sucesso. Resultados incertos não são reenviados automaticamente. Etapas posteriores podem continuar sem repetir uma mensagem anterior incerta. Não há novo agendamento por minuto.

Configuração necessária no servidor: credenciais Twilio, remetente oficial, `ORDER_NOTIFICATION_WEBHOOK_SECRET` e o segredo correspondente no Vault para o disparo por evento. A operação também chama o processador autenticado após a mudança. Fora da janela de 24 horas iniciada pelo cliente, exige `TWILIO_CUSTOMER_ORDER_STAGE_CONTENT_SID`, com modelo aprovado e variáveis 1 (primeiro nome), 2 (número do pedido) e 3 (mensagem da etapa, sem quebras de linha). Ausência de modelo aparece como falha de configuração, sem fallback para texto livre proibido.

A inspeção desta tarefa encontrou credenciais ocultas na leitura de configuração e ausência dessa variável de modelo. Não foi comprovada aprovação do modelo na Twilio. A ausência do bucket de mídias citado pelo código antigo também foi confirmada; a migração nova cria armazenamento específico para comprovantes.

Referências oficiais: [modelos WhatsApp e janela de atendimento](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates), [status das mensagens](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status) e [controle de acesso do Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Acompanhamento integral da conversa

### Consulta permanente de conversas — 21/09/2026

A operação separa as conversas em atendimento das encerradas. A aba Histórico permite buscar pelo final do telefone ou pelo texto da última mensagem e abrir toda a conversa registrada, inclusive após “Encerrar chat”. O encerramento tira a conversa da fila e libera a automação; não apaga as mensagens. Uma migração remove a exclusão automática de conversas encerradas após 30 dias. Conversas que já tenham sido excluídas antes da migração ou mensagens que nunca foram registradas não podem ser reconstruídas a partir desta base. O acesso permanece restrito à caixa autorizada de proprietários e gerentes, por função exclusiva do servidor; clientes não recebem acesso direto às tabelas privadas.

A janela de atendimento passa a mostrar conversas automáticas desde a primeira mensagem: texto do cliente, opções numéricas escolhidas, respostas completas do robô, anexos, avisos de etapa e intervenções da equipe, com autor e data/hora. O histórico anterior que nunca foi gravado não é reconstruído por suposição. Pedidos iniciados pelo site também criam uma conversa quando ocorre um aviso de etapa.

“Assumir conversa” pausa o robô e atribui o atendimento ao operador. Se uma resposta automática estiver em processamento, a tomada aguarda sua conclusão; a equipe recebe orientação para tentar em instantes. Responder exige sessão autorizada e a posse da conversa. “Devolver ao robô” preserva o histórico e o carrinho ainda válido; pedidos já registrados não são apagados. O estado temporário do carrinho continua sujeito à expiração documentada, mas a pausa humana não depende dessa expiração. Mensagens e comprovantes continuam sendo guardados durante a intervenção.

Se uma conversa for encerrada por engano, proprietários e gerentes podem usar “Reabrir conversa”. A reabertura remove o estado encerrado, pausa o robô, assume a conversa para a equipe e registra um evento de sistema no histórico. A equipe também pode iniciar uma conversa nova pelo número oficial informando manualmente o WhatsApp ou usando o botão no cadastro do cliente; a primeira mensagem enviada cria ou reabre o histórico daquele telefone. Se o WhatsApp/Twilio bloquear conversa iniciada pela empresa fora da janela permitida, a operação deve mostrar falha em vez de registrar envio como confirmado.

A resposta humana pode ser programada para uma data e horário futuros. A mensagem programada fica em fila privada, aparece na conversa com status pendente, pode ser cancelada antes do envio e é disparada por rotina agendada do servidor a cada poucos minutos. Ao enviar, o histórico recebe a mensagem como resposta da equipe; em falha temporária, o servidor tenta novamente; em falha final, grava aviso na conversa para a equipe conferir antes de reenviar. Anexos não são programados nesta etapa.

Lançamentos de carimbos pelo atendimento devem tentar avisar o cliente pelo WhatsApp oficial depois que o banco confirmar a atualização. A mensagem informa quantos carimbos entraram, o novo saldo no cartão e quantos faltam para a fatia Adoce grátis. Quando o lançamento completa um cartão, a mensagem deve comemorar a recompensa e informar que a fatia Adoce grátis está liberada. A venda e os carimbos permanecem válidos mesmo se o envio externo falhar; a falha precisa aparecer para a equipe.

Tabelas de histórico têm RLS, sem acesso de clientes. Mídias da conversa usam bucket privado; comprovantes referenciam o mesmo arquivo privado do pedido. A migração repõe o bucket de atendimento ausente. Não apagar mensagens de conversas abertas apenas por idade. A caixa atual permite proprietários e gerentes, preservando a autorização existente.

Um aviso ainda não enviado aparece como pendente, falha ou resultado incerto; aceitação pela Twilio não é apresentada como confirmação de entrega. O prazo de pagamento começa apenas no retorno de entrega/leitura da cobrança, não no clique de separação ou numa tentativa que falhou.

## Horários e mensagem aprovada

Horário local de Fortaleza/Brasília. Pedidos de fatias: terça a sábado, das 12h até antes das 22h. Atendimento humano: segunda a sábado, das 9h até antes das 22h. Domingo não abre essas janelas. Receber comprovantes permanece permitido.

Mensagem aprovada para pedidos fora do horário:

> Olá! 💗 Obrigada pelo carinho e pelo interesse nas nossas fatias! Recebemos pedidos do Festival de Fatias de terça a sábado, das 12h às 22h. Neste momento, estamos fora do horário de pedidos, mas vamos adorar atender você quando voltarmos. Esperamos você por aqui! 🍰

O bot acrescenta o atalho para atendimento. Para a equipe: “Olá! 💗 Nossa equipe responde de segunda a sábado, das 9h às 22h. Pode deixar sua mensagem por aqui; responderemos quando o atendimento retornar.”

## Validação e publicação

### Publicação autorizada em 15/09/2026

Após a instrução explícita “publica tudo agora”, foram aplicadas em produção a correção de estoque, a estrutura de mídias ausente e as três migrações de comprovantes, avisos e histórico completo. O deploy Netlify `6aa980908f71a67e9ec6c665` foi publicado em `https://www.adocebrigaderia.com.br`. O portão de publicação passou com 112 arquivos de teste e 691 testes, tipos e build.

Verificação no banco de produção: a reserva dos dois itens do pedido do incidente foi executada em transação de teste e revertida, com duas unidades alocadas em lotes atuais, sem conflitos. Não foi confirmado pagamento nem realizada baixa definitiva do pedido. Buckets privados e RLS das tabelas foram conferidos; visitantes/clientes não receberam acesso aos comprovantes ou ao histórico.

Verificação autenticada no domínio oficial: nova janela de conversas visível; pedido real mostra chave Pix correta e seção de comprovantes, carregada sem erro de console. Endpoints privados recusam acesso sem autenticação. Recebimento real de nova mensagem, anexo e callback Twilio continuam pendentes de exercício com cliente de teste autorizado. O modelo aprovado para avisos fora da janela de 24 horas permanece dependência externa.

Aplicativo Android: versão `1.0.20260915` preparada com as novas telas e adaptação específica para URLs de API e cache de comprovantes no WebView. Esta adaptação está no pacote Android e não exige nova publicação do site. Instalação e conferência física dependem de conectar o tablet por USB; nenhum aparelho foi detectado até esta atualização do relatório. A publicação do site não atualiza o APK automaticamente.

O restante desta seção registra os testes preparatórios e o procedimento de aceite.

Evidências e scripts locais em `evidence/20260915-order-repair`: reprodução anterior à correção, testes PostgreSQL com dados fictícios, testes executáveis do webhook/worker/horários e validação renderizada da interface real com servidor simulado. Esse servidor não acessa produção. Aprovação automática não é aprovação funcional em produção.

Validação visual executada no navegador local: acompanhar cliente/robô, assumir, responder, devolver, estados vazio/erro; pedido com Pix, comprovante ilustrativo, confirmar separação, confirmar pagamento, liberar retirada e entregar. Larguras verificadas: 320, 360, 375, 390, 412, 430, 768, 1024 e 1280 px. Corrigidos filtros que extrapolavam telas estreitas e controles apertados da intervenção. Imagem e link PDF usam dados simulados; envio/download real do provedor e PDF real permanecem no aceite de produção. Não houve erro novo de console no fluxo final; os erros iniciais do servidor de teste foram corrigidos antes da validação.

Testes PostgreSQL aplicam as migrações em banco novo, com funções de estoque reais e dados fictícios, sem conexões externas: última unidade para pedido antigo, reserva de ontem com baixa hoje, falta de saldo atual, repetição sem baixa duplicada, ambiguidade de comprovantes, callback fora de ordem/tentativa antiga, prazo só após entrega, separação repetida, escolha numérica, tomada humana, retomada e permissões. Isso não substitui executar a jornada no Supabase/WhatsApp publicado.

Antes da publicação: conferir os pré-requisitos de atendimento/mídias de 30/08 e 01/09 e aplicar as quatro migrações de 15/09 em ordem no ambiente alvo autorizado; confirmar buckets privados, permissões e funções; configurar/verificar modelo aprovado; executar `npm run release:check`; obter autorização explícita de produção. Não usar `db push` indiscriminado porque há migrações locais anteriores cujo histórico diverge. A aprovação da frase de atendimento não autoriza publicação.

Após publicação: conferir o domínio oficial sem iniciar outro deploy; testar com identidade de equipe e cliente de teste autorizado, mensagem recebida no remetente oficial, Pix após separação, upload real e leitura privada do comprovante, conferência manual, retirada, repetição e erros. Validar versão do aplicativo Android separadamente; validar navegador tablet não comprova atualização do APK instalado.

Rollback: reverter o deploy de interface/funções se necessário e desativar o trigger novo de avisos em ação autorizada. Preservar comprovantes, eventos e data de estoque, sem exclusão de histórico. Avaliar reversão de funções de estoque em conjunto com as reservas existentes, não apagar colunas nem restaurar contagens cegamente.

## Próxima auditoria integral — proposta para detalhar após este incidente

Criar inventário por superfície (site público, Clube, Hoje, Operação), rota, botão, RPC, tabela/política e integração. Para cada função registrar entrada, pré-condições, resultado visível, persistência após recarregar, efeitos em estoque/financeiro/Clube, permissões, duplicação, concorrência, erro e evidência por ambiente. Nenhuma linha pode ser marcada concluída por busca de texto ou compilação.

Ordem proposta: (1) pedidos e estoque, inclusive lotes futuros, meia-noite e reservas antigas; (2) pagamento, taxas, baixa e estornos; (3) bot, atendimento, mídia e mensagens oficiais; (4) Clube, carimbos e prêmios; (5) clientes, identidade e acesso; (6) catálogo, horários e configurações; (7) impressão, tablet, reconexão e atualização de versão; (8) relatórios, histórico, auditoria e backup. Para cada área executar fluxo completo com erro provocado e recuperação, em computador/celular/tablet aplicáveis. O relatório deve separar implementado, automático, visual, funcional e produção, com bloqueios explícitos.

## Supressão individual e diagnóstico dos avisos — 15/09/2026

A pedido explícito do proprietário, o pedido FAT-20260911-0079 foi silenciado em produção por registro privado individual. A proteção impede reivindicar novos avisos e torna eventos novos ou reenfileirados inelegíveis ao envio; mantém pedido, estoque e histórico. As duas tentativas anteriores estavam sem identificador de envio, com erro `template_required`; nenhuma estava em processamento. A chamada de obtenção de aviso retornou nulo após o bloqueio. Um evento de cobrança inserido em transação revertida também não pôde ser obtido pelo processador.

Diagnóstico original: produção não continha `TWILIO_CUSTOMER_ORDER_STAGE_CONTENT_SID`, o que bloqueava mensagens de etapa quando não havia mensagem recebida nas últimas 24 horas. A idade do pedido não define a janela: pedidos atuais feitos pelo site também podem precisar de modelo aprovado. O modelo foi confirmado como aprovado e configurado em 22/09/2026, conforme registrado abaixo.

## Primeiro contato pelo número oficial — 15/09/2026

Pedidos recebidos no WhatsApp particular e cadastrados na operação também devem receber avisos pelo remetente oficial, mesmo sem conversa anterior nesse número. O pedido histórico FAT-20260911-0079 permanece explicitamente silenciado.

Após login do proprietário, o painel Twilio confirmou que o modelo existente de novo pedido se destina à equipe. Foi criado e submetido como Utility o modelo `adoce_atualizacao_pedido_cliente_20260915`, SID `HX26892027d9dc0fd572fc75cbd6f232f1`, em português brasileiro, com variáveis 1 (primeiro nome), 2 (pedido) e 3 (mensagem da etapa). Texto: “Olá, {{1}}! Aqui é a Adoce Brigaderia, pelo nosso WhatsApp oficial. Temos uma atualização sobre o seu pedido {{2}}: {{3}}\nVocê pode responder por aqui para falar com nossa equipe sobre este pedido. Obrigada pela sua compra! 💗”. Exemplos de submissão usam dados fictícios.

Estado verificado em 22/09/2026: Approved na Twilio, categoria Utility. A variável protegida `TWILIO_CUSTOMER_ORDER_STAGE_CONTENT_SID` foi configurada no contexto production/functions com o SID `HX26892027d9dc0fd572fc75cbd6f232f1`; a ativação efetiva exige novo deploy. Isso libera mensagens de atualização de pedido fora da janela de 24 horas, desde que o provedor aceite o envio do modelo aprovado.

## Modelos Twilio para conversas proativas — 22/09/2026

Mensagens iniciadas pela operação, mensagens programadas e avisos automáticos de fidelidade precisam respeitar a janela oficial do WhatsApp. O servidor usa texto livre somente quando há mensagem recebida da cliente nas últimas 24 horas; fora dessa janela, exige modelo aprovado da Twilio/Meta e falha de forma explícita quando a configuração ainda não existe.

Novas variáveis protegidas previstas:

- `TWILIO_SUPPORT_MESSAGE_CONTENT_SID`: modelo de mensagem da equipe para iniciar conversa pelo número oficial e para envio programado fora da janela de 24 horas. Variável 1: texto escrito pela equipe.
- `TWILIO_LOYALTY_STAMPS_CONTENT_SID`: modelo de atualização de carimbos. Variáveis 1 nome, 2 carimbos recebidos, 3 total atual, 4 carimbos faltantes.
- `TWILIO_LOYALTY_REWARD_CONTENT_SID`: modelo de recompensa liberada. Variáveis 1 nome, 2 carimbos recebidos, 3 recompensa liberada.

Textos preparados para submissão na Twilio:

- `adoce_clube_carimbos_atualizados_20260922`: “Olá, {{1}}! Seu Cartão Clube Adoce acabou de receber {{2}}. Agora você está com {{3}} de 14 carimbos. Faltam só {{4}} para conquistar sua fatia Adoce grátis.”
- `adoce_clube_fatia_gratis_liberada_20260922`: “Olá, {{1}}! Que alegria: seu Cartão Clube Adoce acabou de receber {{2}} e você completou seu cartão. Sua recompensa já está liberada: {{3}} para deixar o dia mais doce.”
- `adoce_mensagem_equipe_cliente_20260922`: “Olá! Aqui é a Adoce Brigaderia, pelo nosso WhatsApp oficial. {{1}} Você pode responder por aqui para falar com nossa equipe.”

Estado da integração após submissão em 22/09/2026: código preparado e SIDs configurados no Netlify production/functions. Os três novos modelos estão com status `Received` na Twilio e ainda dependem de aprovação final da Meta/Twilio antes de serem confiáveis para envio fora da janela de 24 horas.

- `adoce_clube_carimbos_atualizados_20260922`: SID `HXa5b28e4aed8c1db0dfe81fd10733e791`, status `Received`, categoria Utility.
- `adoce_clube_fatia_gratis_liberada_20260922`: SID `HX8447342905cb285c9779d386d7f82087`, status `Received`, categoria Utility.
- `adoce_mensagem_equipe_cliente_20260922`: SID `HX55dd340a01578092520424a099d29ea1`, status `Received`, categoria Utility.

O modelo `adoce_atualizacao_pedido_cliente_20260915` foi confirmado como Approved em 22/09/2026 e configurado no Netlify production/functions.

## Recuperação de senha por WhatsApp — 22/09/2026

O fluxo do próprio cliente em “esqueci minha senha” usa o WhatsApp cadastrado para enviar um código de recuperação, não uma senha pronta. Após confirmar o código, o cliente segue para criar ou trocar a senha.

O reset feito pela operação gera uma senha temporária, marca o cadastro para troca obrigatória no próximo acesso e tenta enviar pelo WhatsApp oficial um link de acesso ao Clube quando o cadastro possui os dados necessários. A senha temporária continua retornando para a tela da operação para atendimento assistido. Esse fluxo ainda não possui um modelo separado que envie automaticamente a senha temporária inteira pelo WhatsApp oficial do cliente.
