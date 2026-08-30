---
title: Mapa funcional e estado real
description: Mapa vigente da homologação local simplificada e regra de comprovação.
status: Documento vivo
---

# Mapa funcional e estado real

## Limite desta versão

O estado vigente da Adoce Operação é a estrutura enxuta de cinco áreas. Documentos históricos podem relatar funcionalidades antigas, mas não autorizam sua presença na interface ou no código executável atual.

## Adoce Operação

| Área | Funções mantidas |
|---|---|
| Hoje | alertas, indicadores e atalhos para tarefas reais |
| Pedidos | pedido imediato, venda manual, pagamento, separação, retirada, pedidos futuros, pré-reservas, histórico, notas, lembretes e cancelamento |
| Produtos | sabores, disponibilidade, estoque, caldas, conteúdo do dia, catálogo, preços, opções, fotos e galerias |
| Clientes | busca, QR, ficha, conta, carimbos, prêmios, correções e histórico individual |
| Configurações | loja, pagamentos, funcionamento, exceções e equipe para proprietário |

## Recursos removidos desta homologação

Não fazem parte desta versão: Agenda, Pede Junto, Financeiro como área independente, arquivo independente, central avançada de notificações, promoções públicas, campanhas, configuração visual duplicada, integrações Meta/Instagram, piloto de autenticação por WhatsApp e restauração de produção pela interface.

## Fontes de verdade mantidas

- Produtos e serviços: tabelas `commercial_*`.
- Sabores e disponibilidade: `flavors`, `flavor_images` e `daily_availability`.
- Clientes e fidelidade: perfis, contas, cartões, carimbos e resgates.
- Pedidos imediatos: `instant_orders` e itens relacionados.
- Pedidos futuros: `service_requests`, com notas, tarefas e auditoria ligadas ao pedido.
- Horários de funcionamento: `business_hours` e exceções, apresentados em Configurações.

## Matriz de confirmação

| Campo | Preenchimento obrigatório |
|---|---|
| Superfície | URL ou tela da operação |
| Papel | cliente, atendente, gerente ou proprietário |
| Estado de dados | vazio, normal, limite, erro e histórico |
| Evidência automática | teste e comando |
| Evidência visual | aparelho, tamanho e captura |
| Evidência funcional | ação e persistência observada |
| Produção | data, domínio e resultado, somente após autorização |
| Pendência | descrição objetiva ou “nenhuma encontrada neste escopo” |

Uma função só muda de estado quando existe nova evidência. Build, HTTP 200 ou inspeção rápida não provam publicação nem funcionamento ponta a ponta.
