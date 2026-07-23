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
| Adoce Hoje | Disponibilidade, sabores futuros, retirada, barraquinha e pedido imediato |
| Tortas e docinhos | Catálogo, imagens, valores e pré-reserva |
| Eventos | Tabuleiro de doces e Mini Festas |
| Adoce na Escola | Produtos destinados à escola |
| Aluguel de decoração | Peças e propostas de locação |
| Pede Junto Adoce | Grupo, participantes, entrega grátis e evolução |
| Clube Adoce | Cadastro, acesso, carimbos, prêmios e indicações |

## Adoce Operação

| Galho | Funções |
|---|---|
| Início | Alertas, atalhos e resumo operacional |
| Clientes e Clube | Busca, ficha, carimbos, prêmios, conta e histórico |
| Caixa e pedidos | Pedido imediato, venda manual, pagamento, separação e retirada |
| Encomendas e agenda | Pré-reservas, solicitações, compromissos e bloqueios |
| Pede Junto | Grupos, participantes, pagamento, estoque, conclusão e arquivo |
| Financeiro | Vendas, meios de pagamento, taxas e valor líquido |
| Produtos e serviços | Catálogo, preços, opções, categorias, fotos e galerias |
| Disponibilidade, horários e site | Sabores, estoque futuro, caldas, horários e conteúdos diários |
| Configurações globais | Prazos, checkout, pagamentos e imagens institucionais |
| Histórico e arquivados | Cancelados, excluídos, expirados e registros preservados |
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
