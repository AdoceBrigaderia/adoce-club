---
title: Operação e administração
description: Atendimento, gestão do conteúdo, clientes, equipe, campanhas e auditoria.
status: Em implementação prioritária
---

# Operação e administração

## Prioridade de implantação

Este capítulo entra no início da implantação porque permite que proprietários e gerentes mantenham o Adoce Hoje e a comunicação diária sem depender de uma nova publicação de código a cada mudança.

Ordem aprovada:

1. catálogo, descrição, preço e galeria de produtos;
2. disponibilidade diária, horários, locais e exceções;
3. promoções com período de validade, pré-visualização e auditoria;
4. preferências de comunicação no cadastro e no perfil do cliente;
5. central de notificações com segmentação, revisão e consentimento;
6. conclusão dos demais recursos administrativos e indicadores deste capítulo;
7. Apple Wallet e Google Wallet, mantendo o app/web como alternativa.

O QR Code do cliente e a busca alternativa por nome já fazem parte da operação e devem ser preservados durante estas entregas.

## Papéis

| Papel        | Responsabilidades                                                       |
| ------------ | ----------------------------------------------------------------------- |
| Atendente    | Identificar, registrar compra, validar indicação e resgatar prêmio      |
| Gerente      | Tudo do atendente, ajustes, reversões, conteúdo e análises operacionais |
| Proprietário | Configurações, regras, usuários, auditoria, campanhas e governança      |

Cada funcionário usa uma conta individual. A área interna nunca pode ser acessada apenas por conhecer uma URL. Google e Facebook podem iniciar uma sessão para facilitar o acesso, mas a operação somente é liberada quando o identificador autenticado possui um vínculo ativo em `staff_members`. E-mail confirmado, nome ou outros metadados do provedor social nunca concedem função de equipe automaticamente.

## Atendimento

O fluxo principal deve concentrar:

- leitura real do QR pela câmera;
- busca alternativa por telefone;
- confirmação da identidade sem expor dados além do necessário;
- registro de quantidade de itens elegíveis;
- seleção de prêmio principal ou Espalhe Doçura;
- confirmação automática de eventual convite pendente na primeira compra, sem digitação de código;
- confirmação do saldo anterior e do resultado;
- comprovante visual da operação.

## Clientes e grupos

A equipe autorizada poderá:

- localizar clientes e grupos;
- consultar cartões, prêmios e histórico;
- verificar participantes e seus acessos;
- bloquear e desbloquear conta;
- reenviar acesso ou convite;
- revogar QR ou passe comprometido;
- realizar ajuste ou reversão com justificativa;
- atender solicitações de exportação ou anonimização de dados.

## Adoce Hoje

O painel deve oferecer edição simples para:

- status da loja física;
- status do atendimento presencial;
- status de pedidos online e encomendas;
- horários regulares e exceções;
- sabores do dia e disponibilidade;
- promoções, banners e comunicados;
- programação de publicação e retirada.

Recomendação: combinar horários automáticos com um controle manual de exceção e registrar quem alterou cada estado.

### Central Adoce

A primeira versão administrativa deve permitir, para proprietários e gerentes:

- cadastrar e editar produtos, categoria e preço;
- limitar nome a 80 caracteres, chamada curta a 90, descrição a 300 e ingredientes a 400;
- manter até seis fotos por produto, com uma foto principal;
- aceitar JPEG, PNG e WebP de até 4 MB e reduzir automaticamente para WebP com dimensão máxima de 1600 px;
- marcar disponibilidade de hoje como disponível, últimas unidades, esgotado, somente encomenda ou indisponível;
- configurar horários recorrentes e exceções por data;
- seguir a agenda automática ou pausar excepcionalmente um canal;
- criar promoções com início, fim, ativação e pausa;
- visualizar o resultado publicado no Adoce Hoje;
- registrar as alterações sensíveis na auditoria.

Na ausência de uma confirmação atual do banco, nenhum produto pode ser apresentado ao cliente como disponível. Encartes feitos para uma data específica não são usados como conteúdo permanente.

## Indicações

A administração poderá consultar:

- indicações aguardando primeira compra;
- confirmações e data da compra;
- indicador e indicado;
- bônus concedidos às duas partes;
- cancelamentos e reversões;
- alertas de duplicidade ou comportamento suspeito.

## Campanhas

Campanhas devem usar critérios auditáveis, por exemplo:

- número de cartões completados;
- prêmios disponíveis;
- tempo desde a última compra;
- número de indicações confirmadas;
- participação em grupo;
- consentimento de marketing válido.

O consentimento para participar do Clube Adoce não autoriza automaticamente mensagens promocionais.

### Preferências e envio seguro

Durante a conclusão do cadastro, o cliente escolhe de forma simples quais assuntos deseja receber: sabores, festival, promoções, novidades do Clube, prêmios e aniversário. As mesmas escolhas ficam editáveis no perfil.

E-mail, notificação do aparelho e WhatsApp são autorizações independentes. A escolha do cliente não substitui a permissão técnica do aparelho nem a configuração do provedor. Comunicações administrativas essenciais sobre acesso e segurança permanecem separadas das mensagens promocionais.

A central administrativa começa com rascunho, agendamento, histórico e cancelamento. Um disparo real somente é liberado depois que o respectivo provedor estiver configurado, o consentimento estiver válido e a campanha tiver passado por revisão.

## Indicadores iniciais

- clientes ativos;
- adesões e instalações na Wallet;
- compras e carimbos emitidos;
- ciclos completados;
- prêmios emitidos e resgatados;
- tempo médio entre prêmio e resgate;
- indicações iniciadas e convertidas;
- taxa de retorno por faixa de cartões completos;
- operações revertidas e ajustes manuais;
- atualização e visualização dos sabores do dia.

## Auditoria

Toda operação sensível registra:

- identificador único;
- tipo de operação;
- data e hora;
- conta, cartão e participante afetados;
- saldo ou estado anterior e posterior;
- funcionário, dispositivo ou serviço responsável;
- loja ou canal;
- justificativa e referência da operação original, quando aplicável.

Movimentações não são editadas nem apagadas. Correções produzem novos registros vinculados.
