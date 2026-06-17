# Roadmap Sugerido - Adoce Club

Data: 2026-06-16

## Principio do roadmap

O Adoce Club deve crescer de dentro da operacao real para fora. Primeiro ele precisa ajudar a barraca a vender melhor, controlar estoque e fechar caixa. Depois deve encantar o cliente no app. Por ultimo deve automatizar pagamentos, WhatsApp e perifericos.

## Fase 0 - Preparacao

Objetivo: congelar decisoes antes de implementar.

Entregas:

- Definir escopo do MVP real.
- Aprovar modelo de dados por sabor.
- Aprovar estrategia Supabase.
- Aprovar kit visual v2.
- Definir telas prioritarias.
- Remover do fluxo obrigatorio tudo que aumenta fila.

Criterio de saida:

- Checklist de MVP aprovado.
- Baselines visuais aprovadas.
- Schema revisado para venda itemizada e estoque por sabor.

## Fase 1 - MVP operacional

Objetivo: funcionar no festival com duas pessoas.

Entregas:

- Backend Supabase minimo.
- Login de operador/gestor.
- Abertura de Caixa Festival.
- Sabores do dia e estoque por sabor.
- Caixa Rapido por sabor.
- Carrinho presencial.
- Pagamentos manuais: dinheiro, Pix e cartao.
- Cortesia, permuta e fidelidade com motivo.
- QR/token de fidelidade.
- Historico de vendas do dia.
- Cancelamento com permissao e auditoria.
- Fechamento com dinheiro contado e sobra real por sabor.
- Relatorio do dia.
- PWA cliente com cartao fidelidade e premios.

Fica fora:

- Mercado Pago real.
- WhatsApp bot.
- Impressora Bluetooth direta obrigatoria.
- Impressao 58mm em modo inicial via Android/RawBT ou compartilhamento externo.
- Pedidos online complexos.

Dificuldade: media/alta.

## Fase 2 - Operacao completa do festival

Objetivo: cobrir excecoes reais e reduzir trabalho manual.

Entregas:

- Troco via Pix.
- Credito do cliente.
- Caixa Sobra/Remanescentes.
- Relatorios por sabor.
- Fatia premiada.
- Comprovantes imprimiveis em bobina 58mm.
- Templates de impressao para pedido, venda, credito e fechamento.
- Modo Balcao tablet 10.4".
- Atalhos de teclado.
- Ajustes finos de responsividade.
- Kit visual v2 aplicado.
- Regressao visual Playwright.

Dificuldade: alta.

## Fase 3 - Pedidos online

Objetivo: permitir reserva/pedido sem vender sabor indisponivel.

Entregas:

- Carrinho multi-sabor.
- Pedido recebido/em separacao.
- Conferencia de sabores pela equipe.
- Suspensao para ajuste do cliente.
- Link de pagamento so apos confirmacao.
- Caldas por fatia apos pagamento.
- Retirada por cliente.
- Coleta por motorista/app.
- Painel Pedidos Online.
- Lembretes e pendencias no fechamento.

Dificuldade: alta.

## Fase 4 - Integracoes externas

Objetivo: automatizar pagamento e impressao sem comprometer seguranca.

Entregas:

- Mercado Pago Link real pelo backend.
- Mercado Pago Point/Orders real pelo backend.
- Webhooks idempotentes.
- Conciliacao de pagamentos.
- Impressao termica testada na Iget 58mm.
- Fluxo Android/RawBT validado.
- Fluxo iOS/POS-Printer validado ou classificado como contingencia.
- Possivel wrapper Capacitor.
- Jobs de impressao.

Dificuldade: alta e com dependencia de testes em hardware real.

## Fase 5 - WhatsApp e IA

Objetivo: atender clientes que nao querem instalar app.

Entregas:

- WhatsApp Business Platform / Cloud API.
- Cadastro e consulta de fidelidade.
- Pedido pelo WhatsApp usando o mesmo backend.
- Status de pedido.
- Link de pagamento.
- Escolha de caldas.
- Indicacoes e premios.
- Bot com IA supervisionado por fluxos estruturados.

Dificuldade: alta.

## Ordem recomendada das proximas tarefas

1. Revisar schema para estoque por sabor, sale_items e fechamento.
2. Desenhar Caixa Rapido tablet/mobile antes de codar.
3. Criar kit visual v2 otimizado.
4. Implementar backend de venda transacional.
5. Implementar Caixa Rapido por sabor.
6. Implementar historico completo e reemissao de QR.
7. Implementar fechamento completo.
8. Validar em tablet Android real.
9. Rodar um festival piloto sem Mercado Pago real.
10. So depois conectar Mercado Pago, impressora e WhatsApp.

## Recomendacao de decisao

O proximo marco nao deve ser "app completo". Deve ser: vender presencialmente no festival inteiro sem atrapalhar Beth e Rubens, com estoque por sabor e fechamento confiavel. Se esse marco funcionar, o restante do Adoce Club tem base solida para crescer.
