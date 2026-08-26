---
title: Roadmap e decisões
description: Sequência de implementação, critérios de entrega e pontos pendentes de aprovação.
status: Em validação
---

# Roadmap e decisões

## Estratégia

A base precisa nascer preparada para grupos, duas trilhas de fidelidade e prêmios acumuláveis, mesmo que algumas interfaces sejam liberadas em etapas. Isso evita reconstruir o modelo de saldo depois.

## Etapa 0 — Aprovação do produto

- Revisar esta documentação.
- Confirmar regras marcadas como recomendação.
- Definir identidade nominal e comunicação final.
- Priorizar escopo da primeira operação real.
- Validar termos do clube, privacidade e indicação.

## Etapa 1 — Fundação operacional

- Banco central, API e autenticação.
- Cliente individual e Cartão em Grupo.
- Livro imutável de movimentações.
- Progresso, prêmios acumuláveis e cartões completados.
- Área de atendimento com QR real, busca, compra e resgate.
- Administração de funcionários e auditoria.

**Critério de saída:** dois dispositivos diferentes enxergam o mesmo saldo e uma operação concorrente nunca duplica carimbos.

## Etapa 2 — Wallet primeiro

- Emissão real de Apple Wallet e Google Wallet.
- Onboarding que recomenda a carteira compatível.
- Passe individual para cada participante.
- Atualização automática após compras, prêmios e resgates.
- Revogação e recuperação de passe.

**Critério de saída:** o cliente entra no clube, instala o passe e acompanha uma atualização real sem depender do navegador usado no cadastro.

## Etapa 3 — Espalhe Doçura

- Código e link pessoal.
- Associação antes ou durante a primeira compra.
- Crédito atômico para indicado e indicador.
- Cartão separado, prêmios e histórico.
- Proteções, análise e reversões.

**Critério de saída:** a mesma primeira compra não pode premiar duas vezes e um cancelamento reverte os dois lados.

## Etapa 4 — Clube vivo

- Adoce Hoje.
- Status independentes dos canais.
- Sabores e disponibilidade.
- Promoções e comunicados.
- Segmentação por cartões completados, prêmios e recorrência.

**Critério de saída:** a equipe atualiza a informação em poucos segundos e o cliente vê horário e origem da última atualização.

## Etapa 5 — Aprendizado e expansão

- Relatórios de adesão, retorno, resgate e indicação.
- Campanhas segmentadas.
- Integração com vendas ou pedidos, se disponível.
- Notificações com consentimento.
- Avaliação de app nativo somente se a PWA e as Wallets não atenderem às necessidades futuras.

## Decisões já definidas pelo proprietário

- O produto se chama **Clube Adoce**.
- Wallet deve ser sugerida imediatamente e ser a opção principal.
- App/web é alternativa ou complemento.
- O cartão principal pode ser compartilhado por diferentes composições de pessoas.
- Completar 14 não obriga o resgate; novos ciclos continuam normalmente.
- A quantidade histórica de cartões completados deve permanecer disponível.
- Indicação confirmada na primeira compra premia indicado e indicador.
- O indicador recebe no segundo cartão exclusivo de indicações.
- O Clube Adoce também exibirá sabores, status da loja, atendimento e promoções.
- O backend começará no Supabase Free, com meta de migração ao Pro em 6 meses e limite máximo de 12 meses.
- O Clube Adoce evoluirá para um CRM de relacionamento com histórico, segmentação, campanhas, tarefas e visão completa do cliente.

## Pendências que ainda exigem decisão

O checklist privado foi revisado em 23/07/2026. Das 70 perguntas do planejamento
inicial, 46 já foram definidas, implementadas ou deixaram de exigir validação.
As 24 pendências ativas estão concentradas nestes temas:

| Tema | O que ainda precisa ser confirmado |
| --- | --- |
| Estoque e Cantinho da Adoce | Responsáveis pela contagem e forma de conferir a transferência da produção |
| Carrinho e reserva | Limite temporário, extensão de prazo e tratamento de substituições |
| Delivery | Existência de entrega própria, regiões, responsável, taxa e prazo |
| Mercado Pago | Parcelamento, política de estorno e modelo da maquininha presencial |
| Caixa | Troco, autorização para descontos e procedimento sem internet |
| WhatsApp | Número que poderá usar a API oficial da Meta |
| Impressão | Teste físico da KP-1025 no Galaxy Tab A7 Lite, momento da impressão e mensagens do rodapé |
| Encomendas | Percentual de sinal e validade de orçamento/reserva de data |
| Equipe e contingência | Pessoas por perfil e procedimento quando uma parte da operação falhar |
| Fiscal e privacidade | Tratamento contábil e prazo de retenção de dados |

As respostas históricas das decisões retiradas continuam preservadas. A lista
online mostra somente essas pendências atuais para Rubens e Beth.

## Fora da primeira entrega operacional

- Integração automática com sistema de caixa ainda não escolhido.
- Aplicativos nativos completos para iOS e Android.
- Samsung Wallet.
- Níveis pagos, assinatura ou marketplace.
- Gamificação sem relação direta com compra, indicação ou relacionamento aprovado.

## Controle de alterações

| Data | Versão | Mudança |
| --- | --- | --- |
| 25/08/2026 | 1.2 | Checklist interno de decisões removido da operação para simplificar o produto. |
| 23/07/2026 | 1.1 | Checklist interno reduzido às 24 decisões que ainda exigiam confirmação. |
| 16/07/2026 | 1.0 | Fundação Supabase criada e piloto funcional do festival publicado para cadastro, carimbos, cartão do cliente e resgate. |
| 14/07/2026 | 0.1 | Consolidação inicial da visão, regras, jornadas, arquitetura e roadmap |

## Evolução para CRM

A arquitetura deve permitir que o Clube Adoce evolua de fidelidade para uma plataforma de relacionamento, incluindo:

- linha do tempo completa de compras, carimbos, prêmios, indicações e contatos;
- segmentos dinâmicos por frequência, recorrência, cartões concluídos e inatividade;
- campanhas com consentimento e medição de resultado;
- tarefas e lembretes de relacionamento para a equipe;
- registro de preferências e observações com controle de acesso;
- indicadores de retenção, retorno, valor e engajamento;
- exportação, correção e anonimização em conformidade com a LGPD.

Essa evolução não deve alterar a fonte de verdade dos carimbos nem permitir que dados de CRM modifiquem o livro imutável de movimentações.
