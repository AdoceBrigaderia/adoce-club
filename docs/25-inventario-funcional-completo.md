# Inventário funcional completo — site público e Adoce Operação

**Objetivo:** mapear 100% das telas/funções existentes no código (público + operação), para orientar o rebranding/reformulação completa da marca. Levantamento feito em 22/10/2026 por revisão de código (grep de rotas/imports, `git log` por arquivo, leitura de cada componente) — não é dado de analytics de uso real, é uma estimativa de frequência baseada na natureza do fluxo de negócio e em evidência de que a tela está de fato acessível (roteada) ou não.

**Convenção das tabelas:**
- **Necessária?** — se a função resolve um problema real do negócio hoje.
- **Descartar/consolidar?** — recomendação prática pensando no rebranding: manter, redesenhar, religar (telas prontas mas nunca ligadas ao app), consolidar com outra tela equivalente, ou descartar (código morto, zero caminho de rota vivo).

---

## 1. Site público (não logado)

| Função/Tela | Arquivo(s) | Rota de acesso | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Home pública | AdoceHomeCatalog.tsx | `/` (default) | Landing principal, lista fatias do dia | Alta (toda visita) | Sim | Manter — core |
| Home legada | AdoceHome.tsx | rotas "retiradas" (`#prototipo` etc.) | Versão anterior da home, mantida como fallback de rotas demo | Baixíssima | Dúbia | Avaliar remoção junto das rotas retiradas |
| Fatias do dia / semana + carrinho | AdoceHoje.tsx | `#adoce-hoje`, `#carrinho` | Catálogo de fatias, grade semanal, carrinho | Alta — é o coração do produto, arquivo mais mexido do repo | Sim | Manter — core, mas 1444 linhas, candidato a decompor no redesign |
| Venda de fatia (rascunho de UX) | AdoceHojeVenda.tsx | **Nenhuma** — não roteada | Rascunho/spec de UX da venda de fatia | Zero | Não | Descartar (ou mover o texto para `docs/` como referência histórica) |
| Tortas por encomenda (dinâmico, lê preço do Supabase) | CakeCatalogPage.tsx | `#encomendas` | Catálogo de tortas, fonte de verdade de preço | Média-alta | Sim | Manter — é a fonte de verdade |
| Docinhos | CommercialCatalog.tsx (`initialSegment="sweets"`) | `#docinhos` | Catálogo comercial de docinhos | Média | Sim | Manter |
| Catálogo de Tortas e Docinhos 2026 (estático, tipo PDF) | CatalogPage2026.tsx | `#catalogo` | Peça de marketing para baixar/imprimir; preços e os 34 sabores **hardcoded** no arquivo | Baixa-média (uso em WhatsApp/impresso) | Sim, como peça de marketing | **Consolidar**: hoje duplica preço com CakeCatalogPage e já ficou desatualizado em produção uma vez (R$ 195 vs R$ 200 — corrigido em 22/10). Decidir: ou passa a ler do Supabase, ou formaliza-se como "PDF estático" com processo manual de atualização documentado |
| Encomendas (variante antiga) | CatalogoDeEncomendas.tsx | **Nenhuma** — não roteada | Tela alternativa de tortas+docinhos juntos | Zero | Não | **Descartar** — concorrente morto de CakeCatalogPage/CommercialCatalog |
| Catálogo de sabores (rota antiga) | CatalogoDeSabores.tsx + FlavorCatalogRoute.tsx | **Nenhuma** — substituídas por CatalogPage2026 | Catálogo de sabores dinâmico anterior | Zero | Não | **Descartar** os dois arquivos |
| Termos / Privacidade | LegalPage.tsx | `#termos`, `#privacidade` | Exigência legal | Baixa, mas obrigatória | Sim | Manter |
| Política de pedidos | OrderPolicyPage.tsx | `#politica-de-pedidos` | Regras de pedido/pagamento | Baixa | Sim | Manter |
| Fale com a Adoce | FeedbackPage.tsx | `#fale-com-a-adoce` | Canal de reclamação/sugestão | Baixa | Sim | Manter |
| Navegação/cabeçalho público | PublicHeader.tsx, PublicMobileNav.tsx, PublicCatalogNav.tsx, PublicContactDock.tsx | Global, em toda página pública | Navegação, status do clube, contato flutuante | Alta | Sim | Manter — estrutural, só precisa de re-tema visual |
| Landing de marketing (campanha) | MarketingLanding.tsx | **Nenhuma** — não roteada | Página de campanha alternativa | Zero | Não | Descartar (ou decidir reativar para campanha específica do rebranding) |
| Arte social (post Instagram) | SocialCampaign.tsx | **Nenhuma** no app; possível uso só via script gerador de imagem | Gerar arte de post para feed/stories | Zero no app | Investigar se é chamada por `scripts/generate-assets.mjs` antes de remover | Investigar antes de descartar |
| Campanha de lançamento | LaunchCampaign.tsx | **Nenhuma** — não roteada | Carrossel de slides de lançamento do site | Zero | Não | **Descartar** |
| Compartilhe a doçura | CompartilheDocura.tsx | via AdoceClube.tsx | Indicação/compartilhamento do Clube | Média | Sim | Manter |
| Visualizador de imagem (lightbox) | ProductImageViewer.tsx | Usado em telas vivas (AdoceHoje, CommercialCatalog, CommercialMediaCarousel) | Lightbox de foto de produto | Alta | Sim | Manter — estrutural |
| Input de imagem via clipboard | ClipboardImageInput.tsx | Usado só em telas de Operação | Colar imagem da área de transferência | Média (uso interno) | Sim | É ferramenta de Operação, mal classificada como "pública" na pasta |
| Arte "Pede Junto" | GroupOrderArtwork.tsx | **Nenhuma** — não roteada | Ilustração da campanha Pede Junto | Zero | Não | Descartar junto da feature morta (seção 10) |
| Finalizar reserva | FinalizarReserva.tsx | **Nenhuma** — não roteada | Último passo do fluxo de reserva de fatia (nome+WhatsApp) | Zero | Não, está morta | Descartar ou confirmar se AdoceHoje reimplementou esse passo internamente |
| Acompanhar pedido | AcompanharPedido.tsx | **Nenhuma** — não roteada | Status do pedido para o cliente que espera | Zero hoje | Resolve um problema real documentado (cliente sem saber status) mas está desligada | **Religar** — é a função "deveria existir mas não está no ar" mais clara do lote |
| Pedido na esteira (exibição de produção) | PedidoNaEsteira.tsx | Operação (OperationInstantOrders.tsx) | Exibição de pedido em produção | — | É peça de Operação, não pública | Reclassificar mentalmente |
| Ficha térmica (impressão) | FichaTermica.tsx | Operação (OperationCommercialAdmin.tsx) | Impressão térmica do pedido | — | É peça de Operação | Reclassificar mentalmente |

## 2. Clube Adoce / área do cliente logado

| Função/Tela | Arquivo(s) | Rota de acesso | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Autenticação do clube (login, cadastro, magic link) | AccessApp.tsx (`surface="client"`) | `#entrar`, `#cadastro`, `#minha-conta`, `#acesso-direto`, domínio `clube.*` | Login, registro, gestão de sessão do cliente | Alta — portão de entrada do Clube | Sim | Manter — core, estrutural |
| Cadastro rápido | CadastroRapido.tsx | dentro do AccessApp | Registro com fricção mínima | Alta | Sim | Manter |
| Login por WhatsApp ("nova" tela) | AdoceEntrar.tsx | `#entrar-novo` | Login por WhatsApp — **incompleto**: envio de código ainda não ligado à Cloud API da Meta (comentário no próprio App.tsx) | Zero/baixa, rota alternativa | Não funciona de verdade hoje | Decidir: completar a integração Meta ou remover a rota até estar pronta |
| Painel do Clube (cartão, carimbos, indicação) | AdoceClube.tsx | `#clube`, `#indicar` | Tela principal do Clube Adoce (fidelidade) | Alta | Sim | Manter — core |
| Resumo do clube conectado (hook de status) | ConnectedClubSummary.tsx | AdoceHome, PublicHeader | Detecta cliente logado e mostra progresso | Alta | Sim | Manter — estrutural |
| "Experiência do clube" (porta de decisão alternativa) | ClubExperience.tsx | **Nenhuma** — não roteada | Decidia entre convite/painel do membro, substituída pela lógica já embutida em AdoceClube/AccessApp | Zero | Não | **Descartar** |

## 3. Operação — Caixa e vendas presenciais

| Função/Tela | Arquivo(s) | Rota/aba de acesso | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Balcão (porta de entrada do atendimento) | BalcaoAtendimento.tsx | Entrada padrão de caixa/atendimento | Achar cliente, abrir venda em um toque, acesso a cadastro/suporte | Diária, contínua | Sim — core | Manter |
| Venda manual / PDV | OperationManualSale.tsx | dentro de OperationCommercialAdmin | PDV: carrinho, totais, checkout, cadastro, ajustes, pedidos instantâneos | Diária, contínua | Sim — core | Manter |
| Checkout do caixa (split de pagamento) | CashCheckoutDialog.tsx | dentro de OperationManualSale | Forma de pagamento, split, troco, folha de pagamento | Diária, toda venda | Sim | Manter |
| Seletor de cliente no caixa | CashCustomerSelector.tsx | dentro de OperationManualSale | Busca cliente por nome/telefone na venda | Diária | Sim | Manter |
| Cadastro rápido pós-venda | CashCustomerRegistration.tsx | dentro de OperationManualSale | Cadastra cliente novo com carimbos/boas-vindas do Clube | Diária | Sim | Manter |
| Ajustes de caixa (sangria/suprimento/perda) | CashAdjustments.tsx | dentro de OperationManualSale | Retirar/colocar dinheiro, registrar perda de fatias | Diária-semanal | Sim — auditoria financeira | Manter |
| Pagamentos pendentes / fechar caixa | CashSessionActions.tsx | dentro de OperationManualSale | Recebimento diferido e fechamento diário com contagem | Diária (fechamento 1x/dia) | Sim | Manter |
| Reimpressão de venda | CashReprintDialog.tsx | dentro de OperationManualSale | 2ª via de comprovante | Ocasional | Sim | Manter |
| Ciclo diário automático do caixa | CashDayGuard.tsx | montado direto em AccessApp.tsx | Pede fechamento às 23h, fecha sozinho à meia-noite | Diária, automática | Sim — crítico | Manter |
| Paginação de texto para impressão | CashPagedText.tsx | usado por CashLedger/CashSessionActions | Pagina relatório longo em tela pequena | Toda exibição de relatório | Sim (trivial) | Manter |
| Livro-caixa / extrato | CashLedger.tsx | usado por CashSessionActions | Extrato de movimentos e relatório de fechamento | Diária-semanal | Sim | Manter |
| Painel de pedidos instantâneos (carrinho do cliente) | InstantOrderPanel.tsx | montado em AdoceHoje.tsx | Carrinho/checkout do cliente final para fatias | Diária, contínua | Sim | Manter (é função pública, não de operação — reclassificar) |
| Config. de impressora térmica nativa (tablet) | NativePrinterSettings.tsx | AccessApp.tsx (app Capacitor) | Configurar/testar impressora Bluetooth | Rara (setup) | Sim | Manter — poderia virar sub-aba de "Configurações" |
| Gatilho remoto de impressão | RemotePrintTrigger.tsx | montado em OperationDashboard.tsx | Plano B: manda o tablet imprimir pendências de qualquer navegador | Ocasional (falha de impressora) | Sim | Manter |
| Ficha térmica 58mm (recibo físico) | FichaTermica.tsx | usado por OperationCommercialAdmin | Monta o impresso entregue ao cliente (logo + pedido) | Toda venda com impressão | Sim | Manter — **prioridade alta no rebranding**, é o "cartão de visita" físico da marca |
| Preview térmico da lista de compras | ThermalShoppingPreview.tsx | usado por CostShoppingPlanner | Molda a lista de compras no formato de recibo | Semanal | Sim (trivial) | Manter |
| Documento de orçamento para cliente | RequestQuoteDocument.tsx | usado por FichaTermica/OperationCommercialAdmin | Orçamento limpo, sem expor campos internos ao cliente | Ocasional (encomendas grandes) | Sim | Manter |

## 4. Operação — Encomendas, agenda e disponibilidade

| Função/Tela | Arquivo(s) | Rota/aba de acesso | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Hub de pedidos/encomendas | OperationInstantOrders.tsx | OperationCommercialAdmin / OperationManualSale | Gestão de pedidos (tortas/docinhos), notificação, impressão, comunicação | Diária | Sim — hub de pedidos | Manter |
| Alerta de fatia esgotada (lado do cliente) | SliceAvailabilityAlert.tsx | montado em AdoceHoje.tsx | Cliente pede para ser avisado quando um sabor voltar | Diária (uso do cliente) | Sim, viva | Manter — mas depende da tela abaixo para fechar o ciclo |
| Painel de gestão dos alertas de fatia | OperationSliceAlerts.tsx | **Nenhuma** — não montado | Ver/gerenciar quem pediu aviso de sabor disponível | Zero | A lógica de negócio existe e é usada pelo lado público, mas sem tela de gestão | **Religar** — sem ela a operação não tem onde ver os pedidos de aviso |
| Agenda de encomendas (capacidade por dia) | AgendaDeEncomendas.tsx | **Nenhuma** — não montada | Responder na hora se cabe um pedido grande em um dia, com alternativa | Zero | Resolve um caso real já documentado no código | **Religar** — bom candidato a ponto de partida do redesenho de agenda |
| Gestão do cardápio semanal | WeeklyMenuAdmin.tsx | **Nenhuma** — removida deliberadamente (confirmado por teste de regressão) | Administração do cardápio/disponibilidade semanal por sabor | Zero | Função foi substituída por outro fluxo (CostShoppingPlanner/TabletShoppingList) | Confirmar que a substituição cobre 100% do caso de uso antes de descartar o arquivo |
| Diálogo de agenda semanal (cliente) | WeeklyScheduleDialog.tsx | montado em AdoceHoje.tsx | Mostra disponibilidade da semana ao cliente | Diária (cliente) | Sim, viva mesmo sem admin | Manter |
| Painel do dia (redesign mobile-first) | PainelDoDia.tsx | **Nenhuma** — não montado | Dashboard "o que precisa de mim agora" → estoque → pedidos, 195 linhas, bem documentado | Zero | Projeto de UX completo nunca ligado | **Religar / usar como ponto de partida do rebranding** — já é um rascunho de redesenho pronto |

## 5. Operação — Compras, estoque e custeio

Cadeia de negócio: cadastro de insumo/embalagem → ficha técnica de receita → planejamento semanal de compras → lista de compras no tablet → nota fiscal de compra → relatório "comprado por semana" → arquivamento.

| Função/Tela | Arquivo(s) | Rota/aba de acesso | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Entrada do módulo de compras | OperationPurchasingInventory.tsx | `/operacao/compras` | Wrapper que monta OperationCosts | Estrutural | Sim | Poderia ser inlined, sem dano manter |
| Casca com as 5 abas de custeio | OperationCosts.tsx | abas Notas de compra/Insumos/Preparações/Fichas/Planejar | Orquestra estado global (margens, preço ideal) | Diária (quem usa fichas/preços) | Sim — núcleo do motor de custos | Manter |
| Notas de compra | CostPurchaseInvoice.tsx | aba "Notas de compra" | Lança nota fiscal (fornecedor, itens, preço) | Semanal/a cada compra | Sim — sem isso não há preço de insumo | Manter |
| Insumos e embalagens (cadastro/listagem) | CostItemsPanel.tsx | aba "Insumos e embalagens" | Cadastra/edita/arquiva insumos, histórico de preço, uso em receitas | Esporádico (cadastro) / diário (consulta) | Sim | Extração recente de OperationCosts.tsx — separação limpa, não é duplicação |
| Criar insumo inline | CostItemCreator.tsx | modal, dentro da ficha | Cadastrar item sem perder o rascunho em edição | Esporádico | Sim | Manter |
| Editar cadastro de insumo | CostItemEditor.tsx | modal, a partir de CostItemsPanel | Edita nome/código/tipo/categoria/marca | Esporádico | Sim | Manter |
| Editar fornecedores/embalagens/unidades | CostPurchaseCatalogEditor.tsx | modal, a partir de CostPurchaseInvoice | Corrige catálogo auxiliar já cadastrado | Raro | Sim, baixo uso | Candidata a fundir com a tela de Insumos no redesenho |
| Excluir/restaurar com motivo (soft-delete) | CostRecordArchiveDialog.tsx | modal | Arquivamento com motivo obrigatório e auditoria | Raro | Sim — mecanismo de auditoria exigido pelo projeto | Manter |
| Scroll horizontal de tabela de custo | CostSheetTable.tsx | aba "Fichas por sabor" | UX para tabela larga no mobile | Toda vez que a tela de fichas é usada | Sim, mas é layout | Consolidar com o scroll equivalente de ShoppingWeekTable num componente/hook único |
| Preparações e fichas por sabor (motor de custo) | dentro de OperationCosts.tsx | aba "Preparações"/"Fichas" | Composição, custo via CostEngine, preço ideal, margem | Diária/semanal | Sim — coração do pricing | Manter |
| Planejador semanal de compras | CostShoppingPlanner.tsx | aba "Planejar compras" | Quantidade por sabor/dia, demanda de insumos, sincroniza com o site | Semanal, fluxo central | Sim — altíssimo valor | Manter — área mais viva do sistema hoje |
| Tabela semanal (dias × sabores) | ShoppingWeekTable.tsx | dentro do planejador | Grade de seleção, ordenação por massa, avisos de regra | Semanal | Sim | Manter |
| Lista de compras no tablet | TabletShoppingList.tsx | botão "Modo compras no tablet" | Marcar comprado, cotações de fornecedores, importar/exportar | A cada ida às compras | Sim | Manter — uso de "chão de loja" |
| Relatório "comprado por semana" | PurchaseWeeklyReport.tsx | botão correspondente | Soma real do comprado por semana, auditoria financeira | Esporádico/mensal | Sim | Manter |
| Converter planejamento em lotes de venda do dia | ShoppingBatchSuggestions.tsx | **fica em OperationContentAdmin.tsx**, não no módulo de compras | Liga Compras → Catálogo/Produção do dia | Diária | Sim | **Atenção**: acoplamento escondido — fácil perder essa ponte ao reorganizar a navegação |
| Motor de cálculo de demanda | src/lib/purchase-planner.ts | lógica pura | Demanda de insumos, conversão de unidades, margem de segurança, cor de massa | A cada render | Sim, testado e crítico | Manter |
| Formatação de moeda/quantidade/data (custos) | src/lib/cost-format.ts | lib compartilhada | Helpers de formatação | A cada render | Sim, trivial | Poderia entrar num `lib/format.ts` genérico do projeto |

## 6. Operação — Gestão, financeiro e administração

| Função/Tela | Arquivo(s) | Rota/aba | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Painel financeiro (vendas, margem, caixas, DRE, histórico) | OperationManagement.tsx | `/operacao/gestao`, `/operacao/financeiro` | Visão consolidada de dinheiro | Diária/semanal | Sim — núcleo do controle financeiro | Manter |
| Financeiro (sub-tela dentro do comercial) | OperationFinance.tsx (49 linhas) | dentro de OperationCommercialAdmin, aba Financeiro | Parece duplicar parte do que OperationManagement já mostra | Baixa-média | A confirmar | **Candidato a consolidar** com OperationManagement/Resultado |
| Dashboard inicial da operação | OperationDashboard.tsx | `/operacao` (home) | Primeira tela ao entrar + "outras tarefas" | Diária, várias vezes | Sim | Manter — ótimo ponto de partida visual do rebranding |
| Histórico e arquivados | OperationArchive.tsx | `/operacao/historico` | Consulta de pedidos/sessões antigas | Esporádica | Sim, por auditoria | Manter |
| Configurações de atendimento/pagamento/taxas | OperationCommerceSettings.tsx | `/operacao/configuracoes` | Prazo de reserva, taxas, formas de pagamento | Rara | Sim | Manter |
| Gestão de fotos do site | OperationVisualSettings.tsx | **Nenhuma** — importado só em testes, nunca montado | Painel para gerenciar onde cada foto aparece | Zero | Função pode já estar coberta por `site-visual-assets.ts` sem UI própria | **Decidir**: religar como parte do rebranding (fará sentido trocar fotos) ou descartar |
| Overrides visuais globais do site | SiteVisualOverrides.tsx | provider global, montado no app inteiro | Aplica customizações visuais em runtime (prováveis: cores/assets) vindas do banco, sem novo deploy | Contínua | Sim, crítico | **Ponto-chave do rebranding** — provável canal mais barato para aplicar a nova marca |
| Cadastro da equipe | StaffProfileAdmin.tsx | dentro de `/operacao/gestao` | Cadastrar/editar pessoas da equipe | Rara | Sim | Manter |
| Checklist do Plano Diretor | DirectorPlanChecklist.tsx | **Nenhuma** — importado mas nunca renderizado em JSX | Checklist de decisões pendentes de produto | Zero | A confirmar | **Órfã** — decidir se foi desligada de propósito ou esquecida antes de descartar (pode ter decisões registradas) |
| Painel de rollback de produção | ProductionRollbackPanel.tsx | **Nenhuma em produção** — só se renderiza dentro do próprio arquivo (preview local) | Botão de emergência para reverter deploy ruim | Zero em produção | Se a intenção era real, é um recurso de segurança perdido | **Verificar com prioridade** antes de descartar — pode ser um gap de segurança operacional |
| Menu da conta (header da operação) | OperationAccountMenu.tsx | fixo no cabeçalho de toda tela de operação | Troca rápida de operador no tablet compartilhado | Várias vezes por turno | Sim | Manter |

## 7. Operação — Conteúdo, marketing e comercial

| Função/Tela | Arquivo(s) | Rota/aba | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Produção de hoje / horários / sabores e preços | OperationContentAdmin.tsx | `/operacao/pedidos?tipo=catalogo`, `/operacao/caixa` | Cadastro de sabores, preços, horários, exceções — alimenta Adoce Hoje/Catálogo | Diária a semanal | Sim — motor de dados da vitrine pública | Manter — é aqui que entra o catálogo pós-rebranding |
| Agenda operacional / encomendas comerciais | OperationCommercialAdmin.tsx | `/operacao/pedidos?tipo=catalogo` | Gerencia encomendas, bloqueio de horário, solicitações | Diária | Sim | Manter |
| Galeria de mídia por produto | CommercialMediaAdmin.tsx | dentro de OperationCommercialAdmin | Upload/gestão de fotos reais por categoria | Esporádica | Sim | Manter — relevante para fotos com a nova marca |
| Carrossel de mídia (exibição ao cliente) | CommercialMediaCarousel.tsx | **Público** — usado em CommercialCatalog (`/docinhos`) | Exibição do carrossel de fotos ao cliente | Toda visita à página de docinhos | Sim | Manter — reclassificar como componente público |
| Catálogo da Meta (Instagram/Facebook Shopping) | MetaCatalogAdmin.tsx | dentro de OperationCommercialAdmin | Sincroniza produtos com catálogo Meta | Depende de uso real da integração | Condicional | Verificar se a integração Meta está ativa hoje antes de decidir |
| Campanha de lançamento (operação) | LaunchCampaign.tsx | **Nenhuma** | Configuração de campanha de lançamento | Zero | Não | Descartar (já listado na seção 1) |
| Campanha social (operação) | SocialCampaign.tsx | **Nenhuma** | Gestão de campanha social/redes | Zero | Não | Descartar (já listado na seção 1) |

## 8. Operação — Comunicação e notificações

| Função/Tela | Arquivo(s) | Rota/aba | Para que existe | Frequência estimada | Necessária? | Descartar/consolidar? |
|---|---|---|---|---|---|---|
| Central de notificações/alertas | OperationNotificationCenter.tsx | sempre montada (AccessApp), abre via URL "alertas" | Avisos operacionais (estoque, pedidos pendentes) | Alta, segundo plano contínuo | Sim | Manter |
| Chat/registro de comunicação por pedido | OrderCommunication.tsx | dentro de OperationInstantOrders | Histórico de mensagens/observações por pedido | Média | Sim | Manter |
| Caixa de entrada do WhatsApp oficial | WhatsAppSupportInbox.tsx | dentro de OperationManualSale, canal "official" | Atendimento via WhatsApp integrado ao caixa | Média-alta | Sim — canal oficial de vendas | Manter |
| Piloto de login via WhatsApp (OTP) | WhatsAppAuthPilot.tsx | **Nenhuma** — lazy-importado mas nunca renderizado | Protótipo de login por código via WhatsApp, pausado por falta da Cloud API da Meta | Zero | Não, no estado atual | Finalizar a integração Meta ou descartar — hoje é peso morto |

## 9. Código morto confirmado (zero caminho de rota vivo)

Feature completa **"Pede Junto" (pedido em grupo/compra coletiva)** — **~3.008 linhas** de componentes, lógica, CSS e testes, nenhum alcançável por rota viva:

| Arquivo | Linhas aprox. | Função |
|---|---|---|
| GroupOrderPage.tsx | 601 | Página pública de pedido em grupo |
| OperationPedeJunto.tsx | 122 | Painel operacional de gestão das "salas" |
| PedeJuntoPagamento.tsx | 230 | Rateio/pagamento da compra em grupo |
| PedeJuntoPrazo.tsx | 81 | Prazo/janela de fechamento do pedido |
| GroupOrderArtwork.tsx | — | Ilustração da campanha |
| src/pede-junto.ts, pede-junto-prazo.ts | 177+158 | Regras de negócio |
| pede-junto.css, operation-pede-junto.css | 1113+1 | Estilo |
| pede-junto*.test.ts (4 arquivos) | — | Testes de código já morto |
| scripts/generate-pede-junto-design-qa.mjs, generate-pede-junto-marketing.mjs | — | Scripts dedicados à feature morta |

**Decisão de produto necessária**: a ideia (cobrança dividida em pedido coletivo) é relevante e não trivial — ou se retoma formalmente no rebranding, ou se remove tudo de uma vez (código+CSS+testes+scripts), sem deixar resíduo.

**Outros arquivos 100% mortos** (sem o volume do Pede Junto, mas mesma recomendação — remover):
AdoceHojeVenda.tsx · CatalogoDeEncomendas.tsx · CatalogoDeSabores.tsx · FlavorCatalogRoute.tsx · MarketingLanding.tsx · LaunchCampaign.tsx (ambas as cópias, pública e operação) · SocialCampaign.tsx (confirmar antes se é chamada por script) · FinalizarReserva.tsx · ClubExperience.tsx · WhatsAppAuthPilot.tsx.

**Telas "fantasma"** — existem, compilam, mas nunca são renderizadas no app real (diferente de dead code simples: sugerem trabalho de produto interrompido, decidir religar ou descartar explicitamente, não por omissão):
PainelDoDia.tsx · AgendaDeEncomendas.tsx · WeeklyMenuAdmin.tsx (removida deliberadamente, confirmada por teste) · OperationSliceAlerts.tsx · OperationVisualSettings.tsx · DirectorPlanChecklist.tsx · ProductionRollbackPanel.tsx (atenção: possível gap de segurança operacional).

## 10. Scripts, integrações e automações

**Scripts no pipeline (rodam automaticamente via `package.json`):**

| Script | Função | Quando roda |
|---|---|---|
| verify-primary-workspace.mjs | Trava a regra de fonte única do AGENTS.md (só uma pasta de projeto) | predev, pretest, prelint, prebuild, build, release:check |
| generate-seo-pages.mjs | Gera páginas estáticas de SEO | build |
| verify-operation-release.mjs | Checagem de release da área de Operação | build |
| generate-pwa-icons.mjs | Ícones do PWA | prebuild |
| generate-docs.mjs | Consolida os `.md` do manifesto em `docs/clube-adoce-documentacao.html` | docs:build, prebuild |
| verify-twilio-template-policy.mjs | Valida templates de WhatsApp/Twilio | release:check |
| release-check.mjs | Checklist final antes de publicar | release:check |
| generate-launch-page-v3.mjs / verify-launch-v3.cjs | Gera/valida a landing page de lançamento atual | launch:build / launch:verify |

**Scripts manuais/ad-hoc (não travam build nem deploy):** export-site-images.mjs · generate-launch-page.mjs e v2 (superadas pela v3) · generate-pede-junto-design-qa.mjs e generate-pede-junto-marketing.mjs (ligados à feature morta — remover junto) · prepare-shopping-tablet-migration.mjs · process-hero-cake.mjs · process-today-catalog.mjs · publish-docs.mjs · qa-cash-fast-checkout.cjs · qa-cash-print-opt-in.cjs · qa-homologation.cjs (contém referência à rota morta `#cardapio-fatias` e não cobre `/catalogo` — achado de revisão anterior) · qa-shopping-batches.cjs · qa-shopping-planner.cjs · render-shopping-receipt-preview.mjs · test-thermal-logo.mjs · verify-cash-fast-production.mjs · verify-cash-print-production.mjs · verify-desktop-publication.mjs · verify-launch-v2.cjs · remover-copias-adoce.ps1.

**Funções Netlify (back-end real, produção):** autenticação (auth-whatsapp-*, customer-phone-login, staff-phone-login, request/confirm-password-reset, request/verify-email-code, admin-reset-user-password), integração Meta/Instagram (meta-catalog-* ×7, meta-instagram-webhook, meta-whatsapp-webhook), WhatsApp/Twilio (twilio-whatsapp-order, whatsapp-support, whatsapp-scheduled-messages, loyalty-stamp-message), notificações de pedido (order-notification-*, order-receipts, alerta-pedidos, customer-order-notify, customer-order-status), administrativo de cliente (customer-account-action, customer-profile-update, customer-security-upgrade, staff-create-customer, staff-enroll-sale-customer, staff-redeem-reward-slice), site-feedback.ts, production-rollback.ts, supabase-send-sms-hook.ts. Nenhuma função Netlify é descartável sem mapear antes qual fluxo de negócio ela atende.

**Libs compartilhadas (`src/lib/*.ts`) com uso ativo confirmado:** supabase.ts · cost-engine.ts/cost-sheet.ts/cost-purchase-reference.ts/ideal-sale-price.ts (motor de custo/precificação) · purchase-invoice.ts/purchase-report.ts/supplier-invoices.ts · shopping-week.ts/shopping-offer.ts/shopping-procurement.ts/shopping-plan-sync.ts · management-reports.ts · cake-required-preparations.ts · thermal-printer.ts/impressora-termica.ts/cash-sale-print.ts/operation-print.ts · native-api.ts/native-operation.ts/conexao-bluetooth.ts · operation-feedback.ts/operation-navigation.ts · client-id.ts/contato.ts/datas.ts/fresh-fetch.ts.

---

## Resumo executivo e recomendações para o rebranding

**1. Limpeza de maior impacto e menor risco:** remover de vez a feature "Pede Junto" completa (~3.000 linhas de componentes+CSS+testes+scripts) e os demais arquivos 100% mortos listados na seção 9. Nenhum tem caminho de rota vivo — risco de remoção é zero.

**2. Decisões de produto pendentes antes de desenhar telas novas:** quatro telas de Operação foram construídas, bem documentadas, e nunca ligadas ao app — `PainelDoDia.tsx` (redesign de dashboard mobile-first, "o que precisa de mim agora"), `AgendaDeEncomendas.tsx` (capacidade por dia, motivada por caso real), `OperationSliceAlerts.tsx` (fila de espera de sabor) e `AcompanharPedido.tsx` (status do pedido pro cliente). É trabalho de design já pago — vale decidir explicitamente "religar" ou "descartar" para cada uma antes de desenhar do zero algo que já existe pronto.

**3. Catálogo de tortas triplicado em intenção:** `CakeCatalogPage` (dinâmico, lê do Supabase, é a fonte de verdade), `CatalogoDeEncomendas` (morto) e `CatalogPage2026` (estático, hardcoded, usado como peça de marketing). A reformulação é a oportunidade de unificar — ou o catálogo 2026 passa a ler do mesmo dado, ou formaliza-se como PDF gerado a partir da mesma fonte, nunca mais editado "à mão" em paralelo.

**4. Ponto de entrada mais barato para aplicar a nova marca:** `SiteVisualOverrides.tsx` é um provider global que já aplica customizações visuais em runtime (prováveis cores/assets) sem precisar de novo deploy — vale investigar exatamente o que ele cobre hoje, porque é provavelmente o canal mais eficiente para rodar a nova identidade sem reescrever componente por componente. Junto dele, `OperationDashboard.tsx` (porta de entrada da operação) e `FichaTermica.tsx` (o "cartão de visita" físico entregue ao cliente) são as telas de maior prioridade visual.

**5. Verificar antes de qualquer decisão:** `ProductionRollbackPanel.tsx` parece ser um botão de emergência de rollback de deploy que hoje não é acessível em produção — se a intenção original era real, isso é um gap de segurança operacional, não um dead code trivial. Mesma cautela para `DirectorPlanChecklist.tsx` (pode conter decisões de produto registradas e esquecidas).

**6. Estrutural, sobrevive ao rebranding só trocando a casca visual:** fluxo de caixa completo (Balcão → Venda manual → Checkout → Ajustes → Fechamento), fluxo de autenticação do Clube, navegação pública (`PublicHeader`/`PublicMobileNav`/`PublicCatalogNav`), módulo de custeio/compras inteiro (é o mais ativo do sistema hoje, sem dívida relevante), e os scripts estruturais `verify-primary-workspace.mjs`, `generate-seo-pages.mjs` e `release-check.mjs` — qualquer novo setup precisa manter equivalentes a esses três.

**7. Específico demais, deve ser redesenhado do zero no novo visual:** `AdoceHoje.tsx` (1444 linhas de UI muito acoplada ao layout atual) e `CatalogPage2026.tsx` (peça de marketing pontual, não base de código reutilizável).
