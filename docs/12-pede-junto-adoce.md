---
title: Pede Junto Adoce
description: Regras, experiência, estoque, pagamento individual, operação e materiais de divulgação do pedido compartilhado de fatias.
status: Publicado e validado no domínio principal
---

# Pede Junto Adoce

## Proposta

Pede Junto Adoce substitui a experiência anterior de compra em grupo. Uma pessoa abre uma sala para um único endereço e compartilha o convite. Cada participante entra com o próprio nome e WhatsApp, escolhe seus sabores e quantidades e, depois da separação, recebe o próprio link de pagamento.

A promessa central é: **cada um escolhe, cada um paga o seu e todo mundo recebe junto**.

## Entrega grátis e crescimento do grupo

- A entrega grátis é liberada quando o grupo soma cinco fatias no mesmo endereço.
- A quinta fatia libera o benefício, mas não fecha o grupo.
- A sexta, a décima e todas as fatias seguintes continuam entrando normalmente.
- Não existe limite máximo do grupo; o limite técnico de 50 fatias por participante protege a interface contra erro sem limitar o total coletivo.
- Somente o organizador encerra a sala e envia o pedido para conferência da Adoce.

## Jornada do cliente

1. O organizador informa nome do grupo, nome, WhatsApp e endereço único da entrega.
2. Escolhe uma ou mais fatias e compartilha o link pelo WhatsApp.
3. Cada convidado entra na mesma sala, identifica-se e escolhe seus sabores.
4. A sala mostra a quantidade coletiva e celebra quando a entrega grátis é liberada.
5. O grupo permanece aberto para receber mais participantes e fatias.
6. O organizador encerra e envia o grupo para a Adoce.
7. A equipe confere e reserva o estoque disponível.
8. Cada participante recebe seu link individual de pagamento.
9. A operação acompanha pagamentos, preparação, retirada ou entrega e conclusão.
10. Quando o pedido fica **Entregue**, a sala deixa de oferecer convite ou entrada de novas pessoas.
11. O histórico do pedido permanece visível e a ação principal passa a ser **Abrir novo grupo para outro pedido**.

O novo grupo reutiliza apenas nome do organizador e endereço como conveniência. Ele recebe código próprio e começa sem participantes, fatias ou pagamentos do pedido anterior.

## Estoque e divergências

A operação informa a quantidade física de cada sabor disponível no dia. Enquanto o grupo está aberto, as escolhas são visíveis na sala, mas a reserva definitiva acontece no envio para conferência. O servidor bloqueia as quantidades durante a conferência para impedir duas reservas simultâneas.

Se houver divergência, o grupo permanece salvo e a equipe pode remover apenas a seleção indisponível. O cliente deve receber uma mensagem amigável explicando a diferença e convidando-o a escolher outro sabor.

## Pagamento individual

Na primeira versão, a equipe gera links individuais no Mercado Pago e os cola na área operacional. O participante só enxerga o próprio link. O WhatsApp informa que a fatia foi separada e que o link tem prazo de pagamento.

Uma integração automática com o Mercado Pago deve ser adicionada em etapa posterior, depois da configuração segura das credenciais, dos webhooks e da conciliação de pagamentos.

## Operação

A área interna apresenta:

- grupos ativos e quantidade total de fatias;
- indicador de entrega grátis liberada;
- endereço, organizador e prazo da sala;
- participantes, itens e valor individual;
- campo para o link individual do Mercado Pago;
- envio da cobrança por WhatsApp;
- confirmação de pagamento;
- remoção de participante ou reserva divergente;
- avanço do grupo por conferência, pagamento, preparação, pronto e concluído.

Essas informações permanecem restritas à equipe e não aparecem na página pública.

## Comunicação e divulgação

O nome **Pede Junto Adoce** deve ser usado em todas as páginas e materiais. A antiga expressão pode aparecer apenas na frase de lançamento “a compra em grupo evoluiu”, nunca como nome atual do produto.

O kit de divulgação contém carrossel de feed, Stories, Status do WhatsApp, arte quadrada, legenda e mensagem curta. Os materiais enfatizam a mudança mais importante: ninguém precisa mais pagar ou cobrar pelo grupo inteiro.

## Validação obrigatória

Antes de publicar:

1. testar criação, convite e entrada em dois aparelhos;
2. testar 4, 5, 6, 10 e mais fatias;
3. confirmar que a quinta libera a entrega e não encerra a sala;
4. testar alteração e remoção das próprias escolhas;
5. conferir reserva de estoque e mensagem de divergência;
6. validar que cada pessoa vê somente o próprio link de pagamento;
7. conferir a operação em computador e tablet de 10 a 12 polegadas;
8. revisar a página pública em computador e celular;
9. confirmar que a nomenclatura antiga não aparece como nome do produto;
10. confirmar que grupos entregues não exibem ações de convite nem mensagens de grupo aberto;
11. testar que “Abrir novo grupo para outro pedido” cria uma sala independente;
12. executar testes automatizados, análise do código e build de produção.
