---
title: Operação e administração
description: Escopo enxuto da operação, organizado em cinco áreas.
status: Homologação local em validação
---

# Operação e administração

## Escopo aprovado

A operação deve ser simples, prática e mobile first. A navegação oficial contém somente **Hoje, Pedidos, Produtos, Clientes e Configurações**.

## Papéis

| Papel | Responsabilidades |
|---|---|
| Atendente | identificar cliente, registrar compra, validar indicação, resgatar prêmio e operar pedidos permitidos |
| Gerente | funções de atendimento, ajustes, conteúdo e gestão operacional |
| Proprietário | configurações, equipe, permissões e governança |

Cada funcionário usa conta individual e precisa de vínculo ativo em `staff_members`. Metadados do provedor de login não concedem acesso operacional automaticamente.

## Hoje

É a porta de entrada, com pendências, números do dia e atalhos para pedidos, clientes e estoque baixo. Cada cartão deve levar diretamente à ação correspondente.

## Pedidos

Reúne:

- pedidos imediatos e vendas manuais;
- pagamento, separação, retirada e entrega;
- pedidos futuros e pré-reservas em lista;
- notas, lembretes, histórico e cancelamento dentro do pedido;
- encerrados consultáveis no mesmo fluxo, fora da fila ativa.

Não existe Agenda nem painel separado de relacionamento.

## Produtos

Reúne:

- sabores, disponibilidade e estoque;
- conteúdo exibido hoje;
- produtos, categorias, preços e opções;
- fotos e galerias.

Na ausência de confirmação atual do banco, um produto não pode ser apresentado como disponível.

## Clientes

Reúne busca, QR, lista, perfil, conta, carimbos, prêmios, correções auditadas e o histórico completo do cliente. Movimentações não são editadas ou apagadas; correções produzem registros vinculados.

## Configurações

Reúne loja, meios de pagamento, horários recorrentes, exceções de funcionamento e equipe. A ficha completa da equipe é exclusiva do proprietário.

## Auditoria

Toda operação sensível registra identificador, tipo, data e hora, registro afetado, estado anterior e posterior, responsável e justificativa. A simplificação da interface não remove trilhas de auditoria, migrations ou backups.
