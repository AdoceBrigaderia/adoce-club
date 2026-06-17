# Analise de Viabilidade - Adoce Club

Data: 2026-06-16

## 1. Diagnostico geral do projeto atual

O projeto atual e um MVP demonstrativo em React + TypeScript + Vite, com rotas em React Router, estado em Zustand persistido no `localStorage`, geracao de QR por `qrcode.react`, assets visuais em `public/assets`, testes Playwright e uma proposta futura de Supabase em `supabase/`.

O que ja esta bom:

- O produto ja entendeu que o app nao deve ser obrigatorio para o cliente.
- Ja existe separacao de papeis cliente, vendedor e gestor.
- O fluxo de venda presencial ja gera QR/token e evita carimbo antes de pagamento pendente do Mercado Pago mockado.
- Cortesia, permuta e fidelidade ja aparecem como saidas sem receita, sem QR e sem carimbo.
- Ha documentacao, portal offline, testes Playwright e prints de validacao.
- A preocupacao com logo limpa, identidade visual e assets ja esta parcialmente incorporada.
- O schema Supabase ja indica uma direcao correta: banco relacional, RLS, auditoria e funcoes transacionais.

Limites encontrados:

- O app ainda e prototipo local. `localStorage` nao serve para operacao real com mais de um aparelho, auditoria confiavel, autenticacao, pagamento ou estoque.
- O caixa atual vende por quantidade total, nao por sabor.
- A reserva online ainda e simples: um sabor por pedido, pagamento link cedo demais e poucos status.
- O modelo de banco atual ainda nao cobre todo o dominio necessario: estoque por sabor, itens de venda, itens de pedido, caldas por fatia, troco via Pix, credito do cliente, fechamento completo, remanescentes, impressao e auditoria operacional detalhada.
- O layout e mobile-first, mas ainda nao tem um verdadeiro Modo Balcao para tablet 10.4" deitado.
- O `AppShell` ainda exibe uma status bar falsa dentro do app, algo que deve sair da experiencia real.
- A bottom nav fixa pode cobrir conteudo e nao e adequada para tablet em modo caixa.
- Alguns assets visuais sao muito pesados para PWA mobile, com varios PNGs acima de 1 MB.
- Os testes visuais geram prints `fullPage`; isso ajuda documentacao, mas pode mascarar problemas de viewport real.

Diagnostico honesto: o Adoce Club e viavel, mas o escopo atual e grande demais para virar produto real de uma vez. A melhor estrategia e preservar o conceito amplo, porem implantar em fases muito claras, com um MVP operacional focado em caixa rapido, fidelidade, estoque por sabor e fechamento.

## 2. Viabilidade como PWA

O Adoce Club e viavel como PWA para:

- cliente consultar fidelidade, premios, indicacoes, reservas e localizacao;
- caixa rapido em tablet/celular quando ha internet estavel;
- gestor consultar vendas, caixa e relatorios;
- operacao offline limitada ou contingencia local;
- QR de fidelidade e comprovantes em tela.

PWA sozinho e fraco para:

- impressao termica Bluetooth confiavel;
- integracao direta com maquininha Mercado Pago;
- operacao offline multi-dispositivo com sincronizacao segura;
- notificacoes e canais nativos com confiabilidade total;
- controle de perifericos no Android.

Recomendacao: manter PWA como base principal, mas planejar um wrapper Capacitor para o terminal de caixa quando entrar impressora termica, Bluetooth, modo kiosk ou integracao nativa. O cliente pode continuar usando PWA pelo navegador.

## 3. PWA, app nativo, Capacitor ou hibrido

Recomendacao tecnica:

- Cliente: PWA responsivo.
- Caixa/gestor no tablet: PWA inicialmente; Capacitor quando impressao termica Bluetooth for prioridade real.
- Backend: obrigatorio antes de producao real.
- App nativo puro: nao recomendado agora. O custo sobe muito e o ganho inicial nao compensa.

Abordagem ideal:

1. MVP em PWA com backend.
2. Terminal de caixa rodando no Chrome Android.
3. Impressao inicialmente por HTML print, PDF/QR ou app auxiliar se necessario.
4. Capacitor apenas quando o fluxo de impressora exigir Bluetooth ESC/POS confiavel.

## 4. Estrategia de implantacao por fases

O app deve ser implantado primeiro como ferramenta do Rubens no caixa, nao como sistema completo para toda a operacao. O criterio e: se a tela aumenta fila, ela nao entra no fluxo presencial obrigatorio.

Fase 1 deve resolver a operacao atual:

- abertura de caixa;
- estoque por sabor;
- caixa rapido;
- QR de fidelidade;
- historico completo de vendas;
- fechamento com sobras por sabor;
- relatorio basico;
- contingencia sem app do cliente via QR impresso ou codigo.

Fase 2 deve ampliar controle e cliente:

- pedidos online com carrinho;
- caldas pos-pagamento;
- troco via Pix;
- credito do cliente;
- premios, selos e fatia premiada;
- impressao termica operacional;
- Modo Balcao de tablet.

Fase 3 deve integrar canais e automacoes:

- Mercado Pago real;
- WhatsApp Cloud API;
- notificacoes;
- bot com IA;
- relatorios avancados;
- separador/vendedor em tela propria.

## 5. MVP real recomendado

O MVP real deve ser menor que o sonho completo, mas forte onde doi na operacao.

Escopo recomendado:

- Login simples de operador e gestor.
- Abertura de caixa Festival.
- Cadastro de sabores do dia.
- Estoque por sabor: tortas, fatias por torta, total automatico.
- Caixa Rapido em uma tela: botoes por sabor, carrinho, total, pagamento, finalizar.
- Dinheiro com valor recebido e troco em dinheiro.
- Pix e cartao como pagamentos manuais confirmados pelo operador.
- Cortesia, permuta e fidelidade com motivo obrigatorio.
- Fidelidade: QR para cliente escanear ou comprovante com codigo.
- Historico do dia com reemissao de QR.
- Cancelamento somente gestor, com motivo.
- Fechamento: dinheiro contado, sobra real por sabor, divergencias e observacao.
- Relatorio do dia.
- PWA cliente com cartao fidelidade, premios pendentes e localizacao.

O MVP real nao deve incluir ainda:

- Mercado Pago real;
- WhatsApp bot;
- IA;
- delivery completo;
- impressora Bluetooth nativa;
- tela obrigatoria para Beth lancar pedido presencial.

## 6. Fase 2 recomendada

- Pedido online com carrinho multi-sabor.
- Status completos de pedido.
- Conferencia manual de disponibilidade antes do link de pagamento.
- Caldas por fatia apos pagamento.
- Retirada por cliente ou motorista/app.
- Troco via Pix.
- Credito do cliente.
- Caixa Sobra/Remanescentes.
- Fatia premiada.
- Impressao termica com comprovantes.
- Modo Balcao para tablet deitado.
- Primeira camada de dashboard por sabor.

## 7. Fase 3 recomendada

- Mercado Pago Orders/Point real.
- Mercado Pago Link real para online.
- Webhooks e conciliacao.
- WhatsApp Business Platform / Cloud API.
- Bot com IA conectado ao mesmo backend.
- Notificacoes e lembretes.
- Separador/vendedor como fluxo operacional paralelo.
- Relatorios avancados, cohort de clientes, ranking de sabores e campanhas.
- Auditoria refinada e permissao por papel.

## 8. Riscos de complexidade operacional

O maior risco nao e tecnico; e operacional. Duas pessoas numa barraca pequena nao podem operar um ERP completo enquanto ha fila.

Riscos reais:

- Beth perder tempo lancando pedido presencial e atrasar atendimento.
- Rubens precisar abrir modais demais para uma venda simples.
- Controle de estoque por sabor virar tarefa pesada se a tela exigir muitos toques.
- Reserva online gerar pagamento antes de confirmar sabor e criar problema com cliente.
- Fechamento virar questionario longo demais no fim do dia.
- Tela mobile ficar extensa e cansativa.
- App exigir cadastro do cliente antes da compra e criar barreira.
- Impressora falhar e travar a finalizacao.
- Mercado Pago pendente gerar QR/carimbo antes da aprovacao.

Como reduzir:

- Caixa Rapido deve ser a tela principal do operador.
- Vendas presenciais devem exigir poucos toques.
- Campos obrigatorios so quando ha excecao: cortesia, permuta, venda acima do estoque, cancelamento, divergencia.
- Reserva online deve ser tratada em painel separado e nao misturada com fila presencial.
- Impressao deve ser opcional, com QR em tela sempre disponivel.

## 9. Como evitar que o app atrapalhe o presencial

Fluxo recomendado para hoje:

1. Cliente escolhe verbalmente.
2. Beth separa as fatias.
3. Rubens olha a bandeja.
4. Rubens toca nos botoes de sabor no Caixa Rapido.
5. Rubens escolhe pagamento.
6. Rubens recebe.
7. App so entao gera QR/carimbo.
8. Cliente escaneia no celular do caixa ou leva comprovante impresso/codigo.

Regras de UX:

- Uma venda presencial comum deve caber em 3 a 5 interacoes.
- O carrinho deve ser editavel sem trocar de tela.
- Os sabores mais vendidos devem ficar em primeiro.
- Botoes devem ser grandes e visuais.
- O app nao deve pedir calda no presencial.
- O app nao deve obrigar identificar cliente.
- QR deve aparecer grande e rapido.

## 10. Fluxo atual com Beth separando e Rubens no caixa

Tela principal: Caixa Rapido.

Beth:

- recebe pedido verbal;
- separa fisicamente;
- entrega bandeja aberta para Rubens.

Rubens:

- identifica sabores visualmente;
- registra no caixa por sabor;
- confirma pagamento;
- mostra QR ou imprime comprovante;
- em excecoes, informa motivo.

Esse fluxo respeita a operacao real e evita duplicar trabalho.

## 11. Fluxo futuro com separador/vendedor

A tela de separador deve existir apenas quando a operacao crescer.

Fluxo futuro:

1. Vendedor registra pedido ou pedido entra online.
2. Separador ve fila de pedidos.
3. Separador confirma sabores fisicos.
4. Caixa recebe pedido ja montado.
5. Pagamento e QR acontecem no caixa.

Essa tela deve ser usada para pedidos online, delivery, eventos maiores ou quando houver terceira pessoa. Nao deve ser requisito do fluxo atual.

## 12. Modelo de dados sugerido

Entidades centrais:

- `users`: operadores, gestor, cliente.
- `devices`: tablet/celular, modo de uso, impressora, terminal Mercado Pago padrao.
- `cash_sessions`: abertura, tipo Festival/Sobra, fundo, operador, status.
- `cash_session_flavors`: sabor, tortas, fatias por torta, fatias iniciais, esperadas e reais.
- `flavors`: nome, ativo, categoria, imagem, ordem de exibicao.
- `sales`: venda, canal, operador, status, total, pagamento, cliente opcional.
- `sale_items`: venda, sabor, quantidade, preco unitario, custo medio.
- `payments`: metodo, status, bruto, taxa, liquido, provider, referencia externa.
- `cash_movements`: dinheiro recebido, troco, troco via Pix, gastos, sangrias, creditos.
- `customer_credits`: valor, origem, validade, status, venda origem, venda uso.
- `loyalty_cards`: cliente ou familia, meta, saldo.
- `loyalty_events`: carimbo, resgate, ajuste, anulacao.
- `rewards`: premio pendente, usado, expirado, cancelado.
- `orders`: pedido online, cliente, status, canal app/WhatsApp.
- `order_items`: sabor e quantidade.
- `order_slice_syrups`: escolha de calda por fatia.
- `pickup_details`: cliente ou motorista/app, dados de coleta.
- `print_jobs`: tipo, payload, status, tentativas.
- `audit_logs`: evento imutavel com operador, entidade e payload.

Regras importantes:

- Venda por sabor deve ser itemizada.
- Estoque deve ser alterado por evento transacional.
- Carimbo deve nascer de venda paga, nao de intencao de pagamento.
- Cancelamento deve criar evento de reversao, nao apagar historico.
- Credito do cliente deve ser movimento financeiro rastreavel.

## 13. Arquitetura tecnica sugerida

Front-end:

- React + TypeScript + Vite.
- PWA com service worker.
- React Router.
- Zustand pode continuar para estado de UI, mas nao como banco de verdade.
- React Query ou camada equivalente para sincronizacao com backend.
- Design system local para componentes Adoce.

Backend:

- Supabase inicialmente e uma boa escolha: Postgres, Auth, RLS, Edge Functions, Storage e Realtime.
- Funcoes server-side para operacoes criticas: vender, cancelar, resgatar carimbo, fechar caixa, gerar link, confirmar webhook.
- Nunca gravar regras financeiras sensiveis apenas no front.

Camadas:

- Front PWA.
- API/Edge Functions.
- Banco Postgres.
- Integracoes externas: Mercado Pago, WhatsApp, impressao.
- Jobs/eventos para webhooks, notificacoes e relatorios.

## 14. Backend recomendado

Recomendacao: Supabase como backend principal na primeira versao real.

Motivos:

- Postgres combina muito bem com caixa, estoque, auditoria e relatorios.
- RLS ajuda a proteger dados por papel.
- Edge Functions podem guardar tokens e chamar Mercado Pago.
- Realtime pode ajudar em pedidos online e painel de separacao no futuro.

Cuidados:

- Operacoes criticas devem ser RPC/funcoes transacionais.
- O front nao deve fazer varias escritas soltas para uma venda.
- Webhooks devem ser idempotentes.
- Auditoria deve ser append-only.

## 15. Banco recomendado

PostgreSQL via Supabase e a recomendacao.

SQLite/local-first pode ser considerado para contingencia offline no tablet, mas nao deve ser a fonte principal se houver cliente, WhatsApp, Mercado Pago e varios dispositivos.

Para MVP real:

- Postgres online como fonte da verdade.
- Cache local para UI e contingencia.
- Fila local para eventos offline simples, com reconciliacao cuidadosa.

## 16. Estrategia Mercado Pago

Mercado Pago real exige backend.

O que nunca deve ficar no front:

- Access Token.
- Credenciais.
- Webhook secret.
- Logica de confianca de pagamento.
- Confirmacao definitiva de pagamento.

Caminho recomendado:

- Fase 1: Pix/cartao/dinheiro manuais; Mercado Pago mockado.
- Fase 2: preparar tabelas de pagamento, status e auditoria.
- Fase 3: integrar Mercado Pago com backend.

Point/maquininha:

- Login/dispositivo define terminal padrao.
- Venda cria ordem no backend.
- Backend chama API do Mercado Pago.
- Maquininha recebe cobranca.
- Webhook confirma pagamento.
- So apos confirmacao: liberar QR/carimbo e baixar estoque definitivo se ainda nao baixado.

Link para online:

- Pedido entra como recebido/em separacao.
- Equipe confirma disponibilidade.
- Backend cria link.
- Cliente paga.
- Webhook marca pago.
- App libera escolha de caldas.

## 17. Estrategia WhatsApp bot

E viavel, mas deve ser fase futura.

Melhor caminho:

- WhatsApp Business Platform / Cloud API.
- Um backend unico para app e WhatsApp.
- Bot conversa com os mesmos pedidos, clientes, premios e fidelidade.
- IA apenas depois de fluxos estruturados estarem claros.

Evitar:

- Automacao por WhatsApp Web.
- Scripts dependentes de sessao aberta.
- Enviar pagamento automatico antes de confirmar estoque.

Riscos:

- Custo por conversa.
- Aprovacao e templates.
- Atendimento humano em excecoes.
- Mensagens duplicadas se app e bot nao compartilharem estado.

Recomendacao: primeiro construir pedido online estruturado no app/backend; depois expor pelo WhatsApp.

## 18. Estrategia impressora termica

PWA puro tem limitacoes reais com Bluetooth. Web Bluetooth pode funcionar em Chrome Android em alguns aparelhos, mas nao e garantia operacional.

Opcoes:

1. HTML print:
   - simples para comecar;
   - bom para PDF/impressora do sistema;
   - fraco para Bluetooth ESC/POS direto.

2. ESC/POS via Capacitor:
   - melhor para tablet Android;
   - exige plugin nativo e testes com a impressora real;
   - mais confiavel para 58mm/80mm.

3. App auxiliar:
   - pode ser plano B;
   - aumenta complexidade de suporte.

Recomendacao:

- Fase 1: QR em tela e comprovante opcional.
- Fase 2: testar impressao HTML.
- Fase 2/3: Capacitor + plugin ESC/POS se a impressora for essencial.

Layouts impressos:

- 58mm: texto curto, 32 colunas, QR central, sem arte pesada.
- 80mm: permite mais detalhe e resumo de itens.
- QR deve ser gerado no backend ou front e impresso em alta legibilidade.

## 19. Tablet Android 10.4" em Modo Balcao

O tablet descrito e adequado para PWA, caixa e modo balcao:

- Android 13 e Chrome moderno sao suficientes.
- 8 GB RAM e armazenamento folgado ajudam.
- Tela 10.4" permite layout em duas colunas.
- 4G + Wi-Fi e bateria grande sao positivos.
- Teclado externo pode acelerar operacao.

Pontos de atencao:

- Testar brilho de tela em ambiente externo.
- Testar toque com maos ocupadas.
- Testar estabilidade do Bluetooth com a impressora real.
- Usar suporte fisico firme no caixa.
- Ter plano B se internet cair.

## 20. Teclado externo e atalhos

Atalhos sao viaveis e muito bons para Rubens no caixa, desde que opcionais.

Atalhos recomendados:

- `F1`: Caixa Rapido.
- `F2`: Pedidos Online.
- `F3`: Relatorios.
- `F4`: Impressao.
- Numeros: sabores fixados.
- `Enter`: finalizar/avancar.
- `Esc`: voltar/cancelar.
- `D`: dinheiro.
- `P`: Pix.
- `C`: cartao.
- `M`: Mercado Pago Point.
- `L`: Mercado Pago Link.
- `R`: gerar credito.
- `I`: imprimir.

Cuidados:

- Nao depender de atalhos para operar.
- Mostrar atalhos discretamente apenas no Modo Balcao.
- Impedir finalizacao acidental com confirmacao quando houver excecao.

## 21. Responsividade celular/tablet/desktop

Celular cliente:

- Bottom nav.
- Layout vertical.
- Cartao, premios, reservas e localizacao.
- Textos curtos e visuais.

Celular operador:

- Operacao possivel, mas nao ideal para festival cheio.
- Caixa rapido compacto.

Tablet deitado:

- Sem bottom nav fixa.
- Topbar ou sidebar.
- Duas colunas.
- Esquerda: sabores e carrinho.
- Direita: pagamento, troco, credito e finalizar.

Desktop:

- Gestao, documentacao, relatorios e auditoria.
- Nao precisa parecer app mobile esticado.

## 22. Estrategia visual para ficar proximo dos conceitos

Recomendacao: modo hibrido.

Usar imagens inteiras como fundo de tela da fidelidade visual maxima, mas e ruim para app real. HTML puro responsivo e bom para manutencao, mas tende a perder a magia visual. A melhor opcao e:

- fundos, ornamentos, cards, logo, wordmark, carimbos e icones como assets individuais;
- textos, botoes, inputs, totais, status e dados como HTML real;
- componentes React/CSS com medidas e tokens documentados;
- Playwright para comparar screenshots com baselines.

Regras para evitar interpretacao errada:

- Criar `DesignTokens.md` com cores, fontes, raios, sombras, espacamentos e estados.
- Criar `AssetManifest.md` com nome, uso permitido, dimensao e exemplos.
- Proibir status bar fake em app real.
- Proibir cupcake fora da logo.
- Definir que carimbo e mini fatia de torta/bolo de chocolate.
- Definir que Mercado Pago Link nao menciona maquininha.
- Usar componentes oficiais em vez de recriar botao/card em cada tela.

## 23. Kit visual v2

Sim, recomendo gerar um kit visual v2.

Motivos:

- Os assets atuais existem, mas alguns sao pesados.
- Ha mistura de fundo, botao, card, icone e decoracao com nomes bons, mas ainda falta contrato de uso.
- Para aproximar dos conceitos, Codex precisa de pecas atomicas e instrucoes explicitas.

O kit v2 deve ter:

- logo limpa transparente e creme;
- wordmark Adoce Club;
- fundos mobile e tablet;
- molduras de card;
- botoes vazios em estados normal/pressed/disabled;
- icones individuais sem recorte preto;
- carimbo de fatia em PNG/WebP otimizado;
- ornamentos e divisores dourados;
- texturas leves exportadas em WebP/AVIF.

## 24. Assets que deveriam existir

- `branding/logo-adoce-brigaderia-clean-transparent.png`
- `branding/logo-adoce-brigaderia-clean-cream.png`
- `branding/wordmark-adoce-club.png`
- `backgrounds/mobile-client.webp`
- `backgrounds/mobile-staff.webp`
- `backgrounds/tablet-counter.webp`
- `cards/card-cream-plain.9.png` ou equivalente fatiavel
- `cards/card-cream-decorated.webp`
- `buttons/button-primary-normal.png`
- `buttons/button-primary-pressed.png`
- `buttons/button-secondary-normal.png`
- `stamps/stamp-slice-chocolate.png`
- `slices/slice-placeholder-chocolate.png`
- `decor/gold-divider.png`
- `decor/sparkles-small.png`
- `icons/nav-home.png`
- `icons/nav-card.png`
- `icons/nav-family.png`
- `icons/nav-orders.png`
- `icons/nav-cash.png`
- `icons/nav-reports.png`
- `icons/payment-cash.png`
- `icons/payment-pix.png`
- `icons/payment-card.png`
- `icons/payment-mercado-pago.png`
- `print/logo-mono.png`

Preferir WebP/AVIF para fundos e PNG transparente para logo/carimbos/icones. Manter SVG apenas para formas simples ou icones do sistema.

## 25. Componentes React que deveriam existir

- `AdoceAppShell`
- `ClientShell`
- `CounterShell`
- `AdminShell`
- `AdoceTopBar`
- `AdoceBottomNav`
- `CounterSidebar`
- `AdoceCard`
- `AdoceButton`
- `AdoceModal`
- `AdoceToast`
- `FlavorSliceButton`
- `FlavorStockBadge`
- `QuickCart`
- `PaymentSelector`
- `CashReceivedPanel`
- `ChangePanel`
- `CustomerCreditPanel`
- `LoyaltyQrPanel`
- `ThermalReceiptPreview`
- `OrderStatusBadge`
- `OnlineOrderCard`
- `SyrupPickerBySlice`
- `DailySummary`
- `FlavorStockOpeningForm`
- `FlavorClosingCountForm`
- `AuditTimeline`
- `VisualRegressionFrame`

## 26. Estrategia de testes

Testes de produto:

- venda comum em dinheiro/Pix/cartao;
- Mercado Pago pendente nao gera carimbo;
- cortesia/permuta/fidelidade nao geram QR;
- estoque por sabor baixa corretamente;
- bloqueio/override de estoque negativo;
- cancelamento repoe estoque e anula carimbos;
- fechamento compara esperado x real;
- reserva online nao gera pagamento antes da conferencia;
- caldas so aparecem apos pagamento;
- credito do cliente gera e abate corretamente.

Testes tecnicos:

- unitarios para calculos financeiros;
- integracao para RPCs de venda/cancelamento/resgate;
- E2E Playwright nos fluxos principais;
- testes de permissao/RLS;
- testes de webhook idempotente;
- testes de acessibilidade basica;
- testes offline/contingencia.

## 27. Estrategia de prints e validacao visual

Recomendacao:

- Manter prints Playwright, mas separar documentacao de regressao visual.
- Criar baselines por viewport: 390x844, 430x932, 768x1024, 1024x768, 1280x850.
- Evitar `fullPage` para regressao de app; usar viewport real.
- Usar `fullPage` apenas para documentacao.
- Validar que bottom nav nao cobre botoes.
- Validar que nao ha status bar fake no app real.
- Validar que logo nao mostra borda preta.
- Validar que labels estao em portugues.
- Validar que textos nao estouram botoes.
- Validar que assets carregam e nao ficam recortados.

Ferramentas:

- Playwright screenshots.
- Comparacao visual com tolerancia baixa/moderada.
- Checklist manual contra imagens conceituais.
- Baseline aprovado por tela antes de Codex modificar CSS.

## 28. Principais mudancas recomendadas nas telas

Cliente:

- Remover status bar fake.
- Manter experiencia divertida, mas reduzir dependencia de PNG pesado.
- Reserva deve virar carrinho multi-sabor.
- Cartao fidelidade deve continuar central e premiado.

Caixa/Vendedor:

- Trocar `Quantidade de fatias` por carrinho por sabor.
- Criar tela `Caixa Rapido`.
- Separar venda presencial de pedido online.
- Adicionar dinheiro recebido, troco, troco via Pix e credito.
- Mostrar estoque por sabor no botao.

Admin:

- Criar `Vendas do Dia`.
- Criar `Pedidos Online`.
- Melhorar `Fechamento`.
- Configurar sabores, estoque, operadores, dispositivos e impressora.

Tablet:

- Criar `CounterShell` sem bottom nav.
- Duas colunas.
- Botoes grandes.
- Atalhos opcionais.

## 29. Ordem de implementacao recomendada

1. Congelar regras do MVP real.
2. Ajustar modelo de dados para estoque por sabor e venda itemizada.
3. Criar backend Supabase com RPCs transacionais.
4. Criar Caixa Rapido por sabor no front.
5. Criar abertura/fechamento com sobras por sabor.
6. Criar historico completo de vendas.
7. Criar fidelidade real com QR/token.
8. Criar Modo Balcao tablet.
9. Criar testes E2E e visuais de baseline.
10. Otimizar kit visual v2.
11. Criar pedidos online completos.
12. Adicionar credito/troco via Pix.
13. Testar impressao termica.
14. Integrar Mercado Pago real.
15. Integrar WhatsApp.

## 30. Dificuldade por modulo

- Caixa Rapido por sabor: media.
- Estoque por sabor com divergencia: media/alta.
- Fidelidade QR segura: media.
- Historico e cancelamento com auditoria: media/alta.
- Fechamento completo: alta.
- Pedido online multi-sabor: alta.
- Caldas por fatia: media.
- Troco via Pix e credito: media/alta.
- Impressora termica PWA: alta incerteza.
- Capacitor ESC/POS: alta.
- Mercado Pago Point real: alta.
- Mercado Pago Link real: media/alta.
- WhatsApp Cloud API: alta.
- Bot com IA: alta e fase futura.
- Visual proximo dos conceitos: media se houver kit v2; alta sem kit.
- Modo Balcao tablet: media.

## 31. Pontos que devem ser evitados

- Implementar tudo de uma vez.
- Obrigar cliente a instalar app.
- Obrigar Beth a lancar venda presencial no fluxo atual.
- Guardar Access Token do Mercado Pago no front.
- Confiar em `localStorage` para producao.
- Gerar QR/carimbo antes de pagamento aprovado.
- Enviar link de pagamento online antes de conferir sabores.
- Usar WhatsApp Web como backend.
- Fazer impressao Bluetooth como premissa antes de testar no tablet real.
- Usar imagem inteira de tela como app funcional.
- Manter status bar fake dentro do app real.
- Usar bottom nav no Modo Balcao.
- Deixar cancelamento sem motivo e sem auditoria.
- Permitir estoque negativo sem permissao e observacao.
- Usar cupcake fora da logo.

## 32. Recomendacao final de rumo

Rumo de produto: transformar o Adoce Club primeiro em uma ferramenta de caixa rapido e fidelidade que ajuda Rubens sem atrasar Beth. O app do cliente e o WhatsApp devem ser canais de relacionamento, nao barreiras para comprar.

Rumo tecnico: manter React/PWA, sair de `localStorage` para Supabase antes de uso real, usar RPCs transacionais para venda/estoque/fidelidade/fechamento e deixar Mercado Pago/WhatsApp para fases futuras com backend seguro.

Rumo operacional: o fluxo presencial deve continuar simples: Beth separa, Rubens registra olhando a bandeja. A tela de separador e otima, mas para depois.

Rumo visual: adotar o modo hibrido com kit visual v2, componentes React oficiais e regressao visual por Playwright. Nao usar screenshots inteiras como interface funcional. Remover elementos de mockup de celular da aplicacao real, especialmente status bar falsa.

Conclusao: o Adoce Club e viavel e tem um conceito forte. A condicao para dar certo e fasear com disciplina. O MVP real deve ser caixa rapido por sabor + fidelidade + fechamento confiavel. Depois entram pedidos online, impressao, Mercado Pago e WhatsApp.
