---
title: Mapa funcional e estado real
description: Como localizar funcionalidades e registrar o grau de confirmação sem misturar histórico com evidência atual.
status: Documento vivo
---

# Mapa funcional e estado real

## Regra de leitura

Este capítulo indica onde cada função pertence. O estado atual deve ser confirmado novamente antes de uma entrega. Registros em `07-status-publicacao.md` são históricos e não garantem que uma regressão posterior não exista.

## Site público

| Área | Responsabilidade |
|---|---|
| Início | Descoberta, desejo, produtos, história, benefícios e contato |
| Fatias | Disponibilidade, sabores futuros, retirada, Cantinho Adoce e pedido imediato |
| Cardápio de Fatias | Sabores do dia e da semana, preços, horários e acesso à montagem do pedido |
| Tortas e docinhos | Tortas somente por encomenda, tamanhos com valores e referência de fatias, sabores com fotos e detalhes; docinhos com catálogo e pré-reserva |
| Clube Adoce | Cadastro, acesso, carimbos, prêmios e indicações |

## Adoce Operação

| Galho | Funções |
|---|---|
| Início | Alertas, atalhos e resumo operacional |
| Clientes e Clube | Busca, ficha, carimbos, prêmios, conta e histórico |
| Pedidos | Venda local, pedidos online, identificação do cliente, pagamento, separação e retirada |
| Compras e Estoque | Notas, insumos, preparações, fichas e planejamento; estoque físico de insumos ainda não controlado |
| Encomendas e agenda | Pré-reservas, solicitações, compromissos e bloqueios |
| Financeiro | Vendas, meios de pagamento, taxas e valor líquido |
| Produtos e serviços | Catálogo, preços, opções, categorias, fotos e galerias |
| Disponibilidade, horários e site | Sabores, estoque futuro, caldas, horários e conteúdos diários |
| Configurações globais | Prazos, checkout, pagamentos e imagens institucionais |
| Histórico e arquivados | Cancelados, excluídos, expirados e registros preservados, incluindo grupos antigos do Pede Junto |
| Equipe | Acessos e papéis |

## Fontes de verdade

- Produtos e serviços: tabelas `commercial_*`.
- Sabores e disponibilidade: `flavors`, `flavor_images`, `daily_availability` e agenda semanal.
- Clientes e fidelidade: perfis, contas, cartões, razão de carimbos e resgates.
- Pedidos imediatos: `instant_orders` e itens relacionados.
- Mídias institucionais: registro de imagens visuais e bucket `adoce-media`.

## Matriz de confirmação

Ao revisar uma função, registre:

| Campo | Preenchimento obrigatório |
|---|---|
| Superfície | URL ou tela da operação |
| Papel | público, cliente, atendente, gerente ou proprietário |
| Estado de dados | vazio, normal, limite, erro e histórico |
| Evidência automática | teste e comando |
| Evidência visual | aparelho, tamanho e captura |
| Evidência funcional | ação e persistência observada |
| Produção | data, domínio e resultado |
| Pendência | descrição objetiva ou “nenhuma encontrada neste escopo” |

## Atualização

Uma função muda de estado somente quando existe nova evidência. A ausência de erro durante uma inspeção rápida não equivale a validação completa.
