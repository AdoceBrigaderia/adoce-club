export type DirectorDecision = {
  id: string;
  area: string;
  question: string;
  recommendation: string;
  owner: string;
  priority: "Crítica" | "Alta" | "Média";
  phase: string;
};

export const DIRECTOR_PHASE_CONTEXT: Record<string, { title: string; purpose: string }> = {
  "Fase 0": {
    title: "Fundamentos do projeto",
    purpose: "Decisões que precisam estar claras antes de construir: objetivo, limites do primeiro lançamento, responsáveis e regras que não podem ser improvisadas no dia do festival.",
  },
  "Fase 1": {
    title: "Cadastros e regras internas",
    purpose: "Define como produtos, estoque, equipe, permissões e dados serão organizados com segurança.",
  },
  "Fase 2": {
    title: "Produção e movimentação de estoque",
    purpose: "Organiza a entrada da produção, a transferência para a barraca e os alertas de disponibilidade.",
  },
  "Fase 3": {
    title: "Pedido online e reserva",
    purpose: "Determina o que o cliente poderá comprar, quando o estoque será reservado e como tratar alterações, cancelamentos e delivery.",
  },
  "Fase 4": {
    title: "Caixa e operação no tablet",
    purpose: "Desenha o atendimento rápido no festival, as permissões do operador e a ligação entre venda, estoque e Clube Adoce.",
  },
  "Fase 5": {
    title: "Pagamento com Mercado Pago",
    purpose: "Define meios de pagamento, taxas, estornos e proteção das credenciais antes da integração financeira.",
  },
  "Fase 6": {
    title: "Comunicação pelo WhatsApp",
    purpose: "Define quais mensagens serão automáticas, de qual número sairão e como o cliente será informado se houver falha.",
  },
  "Fase 7": {
    title: "Impressão dos pedidos",
    purpose: "Valida a KP-1025, o momento da impressão e o conteúdo que acompanhará cada sacola.",
  },
  "Fase 8": {
    title: "Piloto e liberação definitiva",
    purpose: "Combina como testar em segurança, agir numa emergência e decidir se o sistema está pronto para uso diário.",
  },
  "Fase 9": {
    title: "Encomendas",
    purpose: "Amplia o sistema para tortas, docinhos e eventos somente depois que a venda imediata estiver estável.",
  },
};

export const DIRECTOR_AREA_CONTEXT: Record<string, string> = {
  Objetivo: "Esta escolha define o resultado que o primeiro piloto precisa provar. Sem isso, não existe um critério justo para dizer se a experiência funcionou.",
  Escopo: "Esta escolha protege vocês de lançar funções demais ao mesmo tempo e deixa claro o que o cliente poderá ou não fazer na primeira versão.",
  Catálogo: "Esta escolha define como os produtos aparecerão para o cliente e quanto trabalho será necessário para manter sabores, preços e disponibilidade atualizados.",
  Estoque: "Esta escolha afeta diretamente a confiança da quantidade mostrada no site e ajuda a evitar vender uma fatia que já saiu presencialmente.",
  Carrinho: "Esta escolha determina quando uma intenção de compra começa a afetar as unidades disponíveis para outras pessoas.",
  Reserva: "Esta escolha equilibra duas necessidades: dar tempo para separar e pagar sem deixar produtos presos por tempo demais.",
  Substituição: "Esta escolha define como resolver uma falta de produto sem frustrar o cliente nem tomar uma decisão por ele.",
  Pedido: "Esta escolha define o que ainda pode mudar depois que o pedido entra na rotina de separação da Adoce.",
  Delivery: "Esta escolha evita prometer uma entrega que não cabe no tempo, na distância ou no custo real da operação.",
  "Mercado Pago": "Esta escolha afeta recebimento, taxas, conciliação e o que acontece quando um pagamento precisa ser devolvido.",
  Caixa: "Esta escolha precisa tornar o atendimento no tablet rápido, seguro e fácil de usar mesmo no horário de maior movimento.",
  WhatsApp: "Esta escolha define quais informações o cliente receberá automaticamente e qual será o plano quando a mensagem não chegar.",
  Impressão: "Esta escolha define como o pedido será identificado na produção e na sacola, sem confundir o comprovante com uma nota fiscal.",
  Encomendas: "Esta escolha organiza produtos que dependem de prazo, agenda, sinal e confirmação, sem exigir estoque imediato.",
  Fidelidade: "Esta escolha protege os carimbos e recompensas para que sempre correspondam a vendas realmente concluídas.",
  Equipe: "Esta escolha define quem pode ver ou alterar cada parte da operação e reduz o risco de ações feitas pela pessoa errada.",
  Relatórios: "Esta escolha define quais números vocês precisam enxergar para conferir o festival e tomar decisões melhores no próximo.",
  Piloto: "Esta escolha prepara um teste real com responsáveis, plano de emergência e critérios objetivos para continuar ou parar.",
  Fiscal: "Esta escolha separa o comprovante operacional das obrigações fiscais e precisa ser confirmada com o contador.",
  Privacidade: "Esta escolha limita por quanto tempo dados do cliente serão guardados e quem poderá acessá-los.",
  Aprovação: "Esta escolha evita que uma fase avance sem a concordância de quem responde pela operação, pelo financeiro e pela segurança.",
};

const ALL_DIRECTOR_DECISIONS: DirectorDecision[] = [
  ["D01", "Objetivo", "Qual é a principal meta do primeiro lançamento?", "Reduzir divergências de estoque e agilizar o caixa antes de buscar crescimento online.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D02", "Objetivo", "Qual festival ou data será usado como piloto real?", "Escolher um festival com movimento médio, nunca o dia mais cheio.", "Rubens e Beth", "Alta", "Fase 0"],
  ["D03", "Escopo", "O primeiro lançamento venderá somente fatias prontas?", "Sim. Encomendas permanecem no fluxo atual até o estoque e o caixa estabilizarem.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D04", "Escopo", "Clientes poderão comprar sem entrar no Clube Adoce?", "Sim, usando nome e celular; membros logados terão o pedido ligado ao perfil.", "Rubens e Beth", "Alta", "Fase 0"],
  ["D05", "Escopo", "Pedidos online funcionarão todos os dias ou somente quando a operação abrir?", "Somente em horários configurados e com botão para pausar imediatamente.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D06", "Catálogo", "Quais categorias terão estoque controlado no início?", "Fatias tradicionais e premium; ampliar somente após o piloto.", "Beth", "Crítica", "Fase 1"],
  ["D07", "Catálogo", "Cada sabor terá preço próprio ou preço por categoria?", "Permitir preço por sabor, com atalho para atualizar toda a categoria.", "Rubens e Beth", "Alta", "Fase 1"],
  ["D08", "Catálogo", "O cliente verá o número exato de unidades?", "Mostrar quantidade exata e destacar as últimas 3 unidades.", "Rubens e Beth", "Alta", "Fase 2"],
  ["D09", "Catálogo", "Produtos esgotados continuarão visíveis?", "Sim, com selo Esgotado hoje e sugestão de sabores semelhantes.", "Rubens e Beth", "Média", "Fase 3"],
  ["D10", "Estoque", "Quais locais de estoque precisam existir?", "Fábrica/casa, barraca, reservado para retirada e reservado para delivery.", "Beth", "Crítica", "Fase 1"],
  ["D11", "Estoque", "Quem fará a contagem de abertura?", "Definir responsável principal e substituto.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D12", "Estoque", "Como a produção será lançada?", "Tela rápida com sabor e botões +1, +5, +10 e quantidade personalizada.", "Beth", "Alta", "Fase 2"],
  ["D13", "Estoque", "Como os produtos serão transferidos para a barraca?", "Uma transferência em lote antes do festival, com conferência final.", "Beth", "Alta", "Fase 2"],
  ["D14", "Estoque", "Qual quantidade define estoque baixo?", "Padrão de 3 unidades, editável por produto.", "Beth", "Média", "Fase 2"],
  ["D15", "Estoque", "Quais motivos de ajuste serão obrigatórios?", "Venda não lançada, perda, avaria, brinde, consumo interno, contagem incorreta e outro.", "Rubens e Beth", "Crítica", "Fase 1"],
  ["D16", "Estoque", "Brindes e consumo interno baixam estoque?", "Sim, em movimentos próprios e sem entrar como faturamento.", "Rubens", "Alta", "Fase 1"],
  ["D17", "Estoque", "Será permitido estoque negativo?", "Não. Apenas administrador poderá registrar ajuste após justificar.", "Rubens e Beth", "Crítica", "Fase 1"],
  ["D18", "Carrinho", "Adicionar ao carrinho reserva uma unidade?", "Não. A reserva acontece somente quando o pedido é enviado.", "Rubens e Beth", "Crítica", "Fase 3"],
  ["D19", "Carrinho", "Haverá quantidade máxima por item ou pedido?", "Definir limite durante o festival ou permitir configuração temporária.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D20", "Carrinho", "Existe valor ou quantidade mínima para pedido online?", "Começar sem mínimo para retirada; delivery segue regra própria.", "Rubens", "Alta", "Fase 3"],
  ["D21", "Reserva", "Quanto tempo a operação terá para assumir um pedido?", "7 minutos, configurável e com alerta crescente.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D22", "Reserva", "Quanto tempo o cliente terá para pagar após a separação?", "10 minutos, configurável, com aviso antes de expirar.", "Rubens e Beth", "Crítica", "Fase 0"],
  ["D23", "Reserva", "A operação poderá estender uma reserva?", "Sim, uma vez, com motivo e novo prazo visível ao cliente.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D24", "Reserva", "O que acontece se ninguém assumir o pedido?", "Liberar estoque, cancelar o pedido e enviar uma mensagem respeitosa.", "Rubens e Beth", "Crítica", "Fase 3"],
  ["D25", "Substituição", "O cliente poderá autorizar troca de sabor?", "Oferecer: aceito semelhantes, quero ser consultado ou cancele o item.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D26", "Substituição", "Quem poderá remover um item reservado?", "Gerente ou proprietário; operador solicita autorização.", "Rubens", "Alta", "Fase 4"],
  ["D27", "Pedido", "Retirada terá horário estimado?", "Sim, com janela curta escolhida ou informada pela operação.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D28", "Pedido", "O cliente poderá alterar o pedido depois de enviar?", "Somente antes da separação, cancelando e recriando a reserva.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D29", "Pedido", "O cliente poderá cancelar sozinho?", "Sim, antes da separação; depois disso deverá solicitar atendimento.", "Rubens e Beth", "Alta", "Fase 3"],
  ["D30", "Delivery", "Quais bairros e áreas serão atendidos?", "Criar lista configurável com taxa e prazo por região.", "Rubens", "Crítica", "Fase 3"],
  ["D31", "Delivery", "Quem realizará as entregas?", "Definir entrega própria, parceiro fixo ou serviço solicitado manualmente.", "Rubens", "Crítica", "Fase 0"],
  ["D32", "Delivery", "Como será calculada a taxa?", "Taxa fixa por região no MVP; distância automática somente depois.", "Rubens", "Alta", "Fase 3"],
  ["D33", "Mercado Pago", "Quais meios online serão oferecidos?", "Checkout Pro com Pix e cartão; excluir boleto para produtos imediatos.", "Rubens e Beth", "Crítica", "Fase 5"],
  ["D34", "Mercado Pago", "Cartão online terá parcelamento?", "Definir número máximo e eventual valor mínimo por parcela.", "Rubens", "Alta", "Fase 5"],
  ["D35", "Mercado Pago", "Quem absorverá as taxas do cartão?", "Adoce absorve no preço ou aplica regra transparente previamente validada.", "Rubens", "Crítica", "Fase 5"],
  ["D36", "Mercado Pago", "Qual será a política de estorno?", "Estorno integral para indisponibilidade da Adoce; demais casos seguem regra aprovada.", "Rubens e Beth", "Crítica", "Fase 5"],
  ["D37", "Mercado Pago", "A maquininha presencial é Mercado Pago Point? Qual modelo?", "Registrar modelo exato e decidir integração somente após o MVP.", "Rubens", "Média", "Fase 5"],
  ["D38", "Mercado Pago", "Quem terá acesso às credenciais de produção?", "Somente Rubens; segredos cadastrados diretamente no servidor.", "Rubens", "Crítica", "Fase 5"],
  ["D39", "Caixa", "Quais pagamentos presenciais serão aceitos?", "Pix, cartão, dinheiro e pagamento manual confirmado.", "Rubens e Beth", "Crítica", "Fase 4"],
  ["D40", "Caixa", "Haverá abertura com valor de troco?", "Sim, com valor inicial e fechamento por forma de pagamento.", "Rubens", "Alta", "Fase 4"],
  ["D41", "Caixa", "Quem pode aplicar desconto?", "Somente gerente/proprietário, com motivo obrigatório.", "Rubens", "Alta", "Fase 4"],
  ["D42", "Caixa", "Quem pode cancelar ou reabrir venda?", "Gerente/proprietário; operador solicita autorização.", "Rubens", "Crítica", "Fase 4"],
  ["D43", "Caixa", "A venda rápida exige identificar cliente?", "Não; oferecer busca opcional e lembrar dos benefícios do Clube.", "Rubens e Beth", "Alta", "Fase 4"],
  ["D44", "Caixa", "Quais botões rápidos de quantidade serão usados?", "1, 2, 3, 4 e quantidade livre; produção usa atalhos maiores.", "Beth", "Alta", "Fase 4"],
  ["D45", "Caixa", "O que o sistema fará quando a internet cair?", "Mostrar contingência, salvar vendas locais e pausar pedidos online.", "Rubens e Beth", "Crítica", "Fase 4"],
  ["D46", "WhatsApp", "Qual número enviará mensagens automáticas?", "Usar o número oficial da Adoce, após verificar disponibilidade na API da Meta.", "Rubens", "Crítica", "Fase 6"],
  ["D47", "WhatsApp", "Quais mensagens precisam ser automáticas no MVP?", "Começar assistido: pedido separado, pagamento e pedido pronto.", "Rubens e Beth", "Alta", "Fase 6"],
  ["D48", "WhatsApp", "Qual tom das mensagens?", "Afetuoso, claro, curto e sem prometer disponibilidade antes da separação.", "Rubens e Beth", "Alta", "Fase 6"],
  ["D49", "WhatsApp", "Se a mensagem falhar, qual será o plano B?", "Status no site sempre disponível e botão de reenvio manual.", "Rubens e Beth", "Alta", "Fase 6"],
  ["D50", "Impressão", "A KP-1025 já poderá ser testada com o VAIO TL10?", "Sim, testar fisicamente antes de definir a integração final.", "Rubens", "Crítica", "Fase 7"],
  ["D51", "Impressão", "Em qual momento o pedido online será impresso?", "Após pagamento aprovado; impressão antecipada apenas sob comando.", "Rubens e Beth", "Crítica", "Fase 7"],
  ["D52", "Impressão", "Quantas vias serão impressas?", "Uma via para a sacola; reimpressão manual marcada como 2ª VIA.", "Rubens e Beth", "Alta", "Fase 7"],
  ["D53", "Impressão", "Qual mensagem original irá no rodapé?", "Escolher 3 a 5 mensagens curtas para alternar.", "Rubens e Beth", "Média", "Fase 7"],
  ["D54", "Impressão", "O comprovante terá preço ou apenas itens?", "Mostrar itens, quantidades, valores, total e status do pagamento.", "Rubens e Beth", "Alta", "Fase 7"],
  ["D55", "Impressão", "Quem poderá reimprimir?", "Operador pode reimprimir, sempre com registro e marca de 2ª VIA.", "Rubens", "Média", "Fase 7"],
  ["D56", "Encomendas", "Quais linhas entram primeiro no novo fluxo de encomendas?", "Manter tortas e docinhos; eventos e escola entram após validar agenda e orçamento.", "Rubens e Beth", "Alta", "Fase 9"],
  ["D57", "Encomendas", "Qual percentual de sinal será exigido?", "Definir por categoria; sugestão inicial de 50% quando aplicável.", "Rubens e Beth", "Crítica", "Fase 9"],
  ["D58", "Encomendas", "Quanto tempo um orçamento ficará válido?", "Definir validade visível e sem reservar data indefinidamente.", "Rubens", "Alta", "Fase 9"],
  ["D59", "Fidelidade", "Quando os carimbos serão concedidos?", "Somente após pagamento aprovado e venda concluída.", "Rubens e Beth", "Crítica", "Fase 4"],
  ["D60", "Fidelidade", "Cancelamento ou estorno remove carimbos?", "Sim, por movimento reverso auditado; nunca editar saldo silenciosamente.", "Rubens e Beth", "Alta", "Fase 4"],
  ["D61", "Equipe", "Quais pessoas serão operadores, gerentes e proprietários?", "Listar nomes e aplicar o menor acesso necessário.", "Rubens", "Crítica", "Fase 1"],
  ["D62", "Equipe", "Quem recebe alertas de pedido novo?", "Tablet principal e celulares autorizados, com opção de silenciar secundários.", "Rubens e Beth", "Alta", "Fase 4"],
  ["D63", "Relatórios", "Qual resumo será necessário ao fechar o festival?", "Vendas, formas de pagamento, estoque, perdas, divergências e ticket médio.", "Rubens", "Alta", "Fase 4"],
  ["D64", "Relatórios", "Os relatórios serão enviados ou apenas consultados?", "Painel e exportação; envio automático pode entrar depois.", "Rubens", "Média", "Fase 8"],
  ["D65", "Piloto", "Quem operará o tablet no primeiro piloto?", "Definir operador principal e uma pessoa acompanhando erros.", "Rubens e Beth", "Crítica", "Fase 8"],
  ["D66", "Piloto", "Qual será o procedimento de emergência?", "Planilha/papel de contingência, pausa online e reconciliação posterior.", "Rubens e Beth", "Crítica", "Fase 8"],
  ["D67", "Piloto", "Quais critérios autorizam o lançamento definitivo?", "Estoque sem duplicidade, caixa rápido, pagamento conciliado e impressão recuperável.", "Rubens e Beth", "Crítica", "Fase 8"],
  ["D68", "Fiscal", "Como as vendas serão tratadas contabilmente e fiscalmente?", "Validar com o contador; o comprovante térmico será identificado como não fiscal.", "Rubens e contador", "Crítica", "Fase 0"],
  ["D69", "Privacidade", "Por quanto tempo dados e endereços de pedidos serão guardados?", "Definir prazo necessário para atendimento, auditoria e obrigações legais.", "Rubens", "Alta", "Fase 1"],
  ["D70", "Aprovação", "Quem dará a aprovação final de cada fase?", "Rubens e Beth aprovam juntos; segurança e financeiro exigem Rubens.", "Rubens e Beth", "Crítica", "Fase 0"],
].map(([id, area, question, recommendation, owner, priority, phase]) => ({
  id,
  area,
  question,
  recommendation,
  owner,
  priority: priority as DirectorDecision["priority"],
  phase,
}));

const PENDING_DECISION_IDS = new Set([
  "D11", "D13", "D19", "D23", "D25", "D30", "D31", "D32",
  "D34", "D36", "D37", "D40", "D41", "D45", "D46", "D50",
  "D51", "D53", "D57", "D58", "D61", "D66", "D68", "D69",
]);

const CURRENT_DECISION_COPY: Record<string, Pick<DirectorDecision, "question" | "recommendation">> = {
  D11: {
    question: "Quem confirma a contagem de abertura da produção e quem substitui essa pessoa quando necessário?",
    recommendation: "Beth confirma a produção; Rubens atua como substituto. Ajustem os nomes se a rotina real for diferente.",
  },
  D13: {
    question: "Como será feita a conferência das fatias levadas da produção para a barraquinha?",
    recommendation: "Usar transferência em lote, com quantidade por sabor e confirmação de quem enviou e de quem recebeu.",
  },
  D19: {
    question: "Precisamos limitar temporariamente a quantidade de fatias por cliente ou por pedido?",
    recommendation: "Começar sem limite fixo e permitir que o proprietário configure um limite em dias de alta procura.",
  },
  D23: {
    question: "A equipe poderá estender o prazo de uma reserva que ainda está em atendimento?",
    recommendation: "Permitir uma extensão por vez, sempre com motivo, novo horário e aviso claro ao cliente.",
  },
  D25: {
    question: "Como o cliente deve escolher o que fazer quando uma fatia reservada fica indisponível?",
    recommendation: "Perguntar se aceita um sabor semelhante, prefere ser consultado ou deseja cancelar somente aquele item.",
  },
  D30: {
    question: "Além de retirada e Pede Junto, a Adoce oferecerá delivery próprio? Em quais regiões?",
    recommendation: "No início, manter retirada e coleta solicitada pelo cliente. Só publicar delivery próprio depois de definir regiões e capacidade.",
  },
  D31: {
    question: "Se houver delivery próprio, quem realizará as entregas?",
    recommendation: "Escolher entre entregador próprio, parceiro fixo ou serviço solicitado pela Adoce e definir quem acompanhará cada entrega.",
  },
  D32: {
    question: "Se houver delivery próprio, como a taxa e o prazo serão calculados?",
    recommendation: "Começar com taxa e prazo fixos por região; cálculo automático por distância pode vir depois.",
  },
  D34: {
    question: "Compras online no cartão poderão ser parceladas? A partir de qual valor?",
    recommendation: "Não parcelar fatias de retirada imediata. Definir parcelamento e valor mínimo somente para encomendas e eventos.",
  },
  D36: {
    question: "Qual política de cancelamento e estorno será mostrada antes do pagamento?",
    recommendation: "Estorno integral quando a Adoce não puder atender. Definir os demais prazos e condições por tipo de pedido.",
  },
  D37: {
    question: "Qual é o modelo exato da maquininha Mercado Pago usada no atendimento presencial?",
    recommendation: "Registrar o modelo e testar a integração depois que o fluxo de pagamento online estiver estável.",
  },
  D40: {
    question: "O caixa presencial terá abertura e fechamento de dinheiro para troco?",
    recommendation: "Registrar o valor inicial, as retiradas e o fechamento separado por forma de pagamento.",
  },
  D41: {
    question: "Quem poderá conceder desconto e quais motivos serão aceitos?",
    recommendation: "Restringir a proprietário ou gerente e exigir motivo em toda alteração de preço.",
  },
  D45: {
    question: "Qual será o procedimento quando a internet cair durante o atendimento?",
    recommendation: "Pausar pedidos online, registrar vendas numa contingência simples e reconciliar estoque e caixa quando a conexão voltar.",
  },
  D46: {
    question: "Qual número oficial será usado na futura automação do WhatsApp e ele pode ser conectado à API da Meta?",
    recommendation: "Validar o número do WhatsApp Business, custos, consentimentos e modelos de mensagem antes de automatizar envios.",
  },
  D50: {
    question: "A impressora KP-1025 funciona corretamente com o Galaxy Tab A7 Lite no atendimento real?",
    recommendation: "Fazer um teste físico de conexão, impressão, reconexão e autonomia antes de ativar impressão automática.",
  },
  D51: {
    question: "Em qual etapa cada tipo de pedido deve ser impresso automaticamente?",
    recommendation: "Pedido online após pagamento confirmado; venda feita pelo WhatsApp ou operador somente ao finalizar ou por comando manual.",
  },
  D53: {
    question: "Quais mensagens curtas da Adoce devem aparecer no rodapé dos pedidos?",
    recommendation: "Escolher de 3 a 5 mensagens alegres e originais para alternar nas impressões.",
  },
  D57: {
    question: "Qual sinal será exigido para tortas, docinhos, escola, eventos e decoração?",
    recommendation: "Definir o percentual por categoria; usar 50% apenas onde fizer sentido para cobrir materiais e reservar agenda.",
  },
  D58: {
    question: "Por quantos dias cada orçamento ficará válido e por quanto tempo a data ficará reservada?",
    recommendation: "Mostrar validade e prazo de reserva no orçamento, sem bloquear a agenda indefinidamente.",
  },
  D61: {
    question: "Quem terá acesso como proprietário, gerente e operador?",
    recommendation: "Listar cada pessoa e conceder somente as funções necessárias para o trabalho dela.",
  },
  D66: {
    question: "Qual procedimento a equipe seguirá se estoque, pagamento ou impressão falhar durante o atendimento?",
    recommendation: "Manter uma folha simples de contingência, pausar o canal afetado e reconciliar tudo antes de retomar.",
  },
  D68: {
    question: "Como as vendas, taxas, comprovantes e eventuais estornos devem ser tratados na contabilidade?",
    recommendation: "Validar com o contador. O comprovante da impressora deve continuar identificado como não fiscal.",
  },
  D69: {
    question: "Por quanto tempo dados de clientes, pedidos, endereços e históricos cancelados devem ser guardados?",
    recommendation: "Definir com orientação jurídica e contábil o prazo necessário para atendimento, auditoria e obrigações legais.",
  },
};

export const DIRECTOR_DECISIONS = ALL_DIRECTOR_DECISIONS
  .filter((decision) => PENDING_DECISION_IDS.has(decision.id))
  .map((decision) => ({ ...decision, ...CURRENT_DECISION_COPY[decision.id] }));

export const DIRECTOR_ARCHIVED_DECISION_COUNT =
  ALL_DIRECTOR_DECISIONS.length - DIRECTOR_DECISIONS.length;
