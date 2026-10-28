# Confiabilidade do caixa e checklist de compras

## Intenção

Eliminar bloqueios indevidos de venda causados por reservas de carrinhos e por cadastro opcional de cliente, preservar pedidos em andamento ao navegar e tornar a lista de compras um checklist rápido, sem tratá-la como controle de estoque.

## Decisões aprovadas

- Reservas de pedidos reais nunca são liberadas pelo novo comando operacional.
- O comando libera somente reservas de outros carrinhos do caixa e preserva o carrinho atualmente aberto.
- Cada aba mantém seu próprio rascunho e renova sua reserva enquanto estiver ativa.
- Dados incompletos de cliente não impedem finalizar a venda; cadastro no Clube ocorre somente quando nome e telefone são válidos e continua desacoplado da baixa da venda.
- Na lista de compras, um toque no checkbox conclui o item sem exigir detalhes.
- Quantidade, fornecedor e valor são opcionais. Se uma quantidade parcial for registrada, o item permanece pendente e mostra o restante.
- Não haverá publicação alternativa, preview online ou homologação online. Validação anterior à produção será local.

## Abordagens consideradas

1. Correção mínima apenas na interface: rejeitada porque não resolve reservas concorrentes e rascunhos de várias abas.
2. Rascunho por aba, renovação ativa e liberação segura de carrinhos: escolhida por corrigir a causa sem remover a proteção contra venda concorrente da última fatia.
3. Reservar somente ao finalizar: rejeitada porque permitiria duas vendas simultâneas da última unidade.

## Segurança e auditoria

O banco autoriza a liberação apenas para colaborador com acesso à loja do caixa. A função recebe a sessão e a chave do carrinho preservado, bloqueia as linhas, remove somente outros `cash_draft_reservations`, recalcula `quantity_reserved` e registra quantidades liberadas em `audit_events`.

## Validação

Testes devem cobrir: checklist sem detalhes, compra parcial, cadastro incompleto, cliente existente sem telefone, rascunhos por aba, renovação, preservação do carrinho atual e impossibilidade de atingir reservas de pedidos. A interface deve ser conferida localmente em computador, celular e tablet, seguida de `npm run release:check`. A publicação e a verificação no domínio oficial estão autorizadas nesta rodada.
