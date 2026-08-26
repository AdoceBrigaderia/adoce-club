# Arquitetura de informação da Adoce Operação

## Objetivo

A Adoce Operação deve organizar o trabalho pela intenção da equipe, e não pela tabela do banco de dados ou pela ordem em que as funções foram construídas. A pessoa deve saber onde entrar antes de pensar no nome técnico da função.

## Árvore oficial

```text
Central Adoce
├── Início da operação
│   ├── Pendências prioritárias
│   ├── Vendas em andamento
│   ├── Pagamentos aguardados
│   ├── Pedidos prontos para retirada
│   ├── Encomendas ativas
│   ├── Clientes cadastrados
│   ├── Estoque baixo
│   └── Atalhos para as tarefas mais usadas
├── Clientes e fidelidade
│   ├── Clientes & Clube Adoce
│   │   ├── Pesquisa por nome, telefone, e-mail ou código
│   │   ├── Leitura do QR do membro
│   │   ├── Lista completa de clientes
│   │   ├── Perfil, dados e situação da conta
│   │   ├── Carimbos, prêmio e correções auditadas
│   │   └── Edição administrativa do nome
│   └── Histórico do Clube
│       └── Compras, indicações, prêmios e ajustes
├── Vendas
│   ├── Caixa e pedidos de fatias
│   │   ├── Lançar venda presencial ou recebida por mensagem
│   │   ├── Pedidos enviados pelo site
│   │   ├── Pagamento, separação, retirada e entrega
│   │   ├── Baixa de estoque
│   │   ├── Identificação e pontuação do Clube
│   │   └── Impressão ou PDF
│   ├── Encomendas e agenda
│   │   ├── Agenda operacional
│   │   ├── Pré-reservas e encomendas
│   │   ├── Bloqueios de horário e recursos
│   │   ├── Histórico e notas do atendimento
│   │   └── Reclamações e sugestões
│   ├── Pede Junto Adoce
│   │   ├── Grupos e participantes
│   │   ├── Pagamentos individuais
│   │   ├── Separação e entrega
│   │   └── Cancelamento e histórico
│   └── Financeiro
│       ├── Faturamento bruto
│       ├── Taxas por meio de pagamento
│       ├── Valor líquido
│       ├── Visões diária, mensal e por período
│       └── Impressão ou PDF
├── Produtos e disponibilidade
│   ├── Produtos, preços e opções
│   ├── Sabores e disponibilidade
│   ├── Estoque de fatias e caldas
│   ├── Fotos, carrosséis e vídeos
│   ├── Horários e modalidades de atendimento
│   ├── Promoções e notificações
│   └── Conteúdo exibido no site
└── Administração
    ├── Configurações globais
    │   ├── Prazo de reserva
    │   ├── Pagamento automático
    │   ├── Meios de pagamento
    │   └── Taxas percentuais e fixas
    ├── Histórico e arquivados
    │   ├── Pedidos concluídos, cancelados ou expirados
    │   ├── Encomendas canceladas ou expiradas
    │   ├── Grupos encerrados
    │   ├── Clientes excluídos ou desativados
    │   └── Auditoria preservada fora das filas ativas
    ├── Equipe e permissões
    ├── Site e atendimento
    └── Restauração de produção
```

## Correções de arquitetura aplicadas

- **“Atender membro” e “Membros” deixam de competir:** pesquisa, QR, lista, contagem e perfil passam a pertencer à mesma área **Clientes & Clube Adoce**.
- **A lista de clientes não pode ter corte silencioso:** todos os perfis ativos, desativados, unificados ou aguardando decisão ficam acessíveis, com busca e quantidade exibida. Cadastros já anonimizados após exclusão deixam de ser tratados como clientes cadastrados. A leitura do banco é paginada para não depender do limite padrão da API.
- **As contagens levam à ação correspondente:** os totais de clientes cadastrados, ativos, desativados e aguardando análise funcionam como filtros. Ao selecionar uma contagem, a operação vai diretamente à lista correspondente e oferece retorno à lista completa.
- **Painel e lista usam a mesma contagem:** perfis da equipe e cadastros anonimizados não entram no total de clientes em nenhuma das duas telas.
- **O perfil prioriza o atendimento:** depois do resumo do cartão aparecem **Registrar compra**, **Resgatar fatia grátis** e, para o proprietário, **Corrigir carimbos**. Em seguida vem o histórico completo daquele cartão; ajuda de acesso, segurança e privacidade ficam por último.
- **“Pedidos” deixa de significar tudo:** venda imediata de fatias, encomenda agendada e Pede Junto são fluxos separados.
- **Financeiro deixa de ficar escondido entre telas de atendimento:** passa a ser um destino próprio em Vendas.
- **Configurações deixam de se misturar ao trabalho diário:** regras que alteram toda a operação ficam em Administração.
- **Registros encerrados deixam as filas ativas:** cancelados, expirados e excluídos ficam em Histórico e arquivados, preservando auditoria sem poluir o trabalho atual.
- **A operação ganha uma porta de entrada:** o painel inicial apresenta urgências, números do dia e atalhos orientados por tarefa.
- **Alertas de estoque chegam ao problema:** o cartão de estoque baixo da Central abre a disponibilidade do dia já filtrada para itens com até três unidades livres, permitindo ajustar o saldo no mesmo lugar. O retorno à lista completa permanece visível.

## Inventário das funções existentes e destino correto

| Função existente | Destino oficial | Decisão |
|---|---|---|
| Pesquisar cliente/membro | Clientes & Clube Adoce | Mantida e reunida à lista |
| Listar membros e mostrar totais | Clientes & Clube Adoce | Fundida com a pesquisa |
| Ler QR do membro | Clientes & Clube Adoce | Mantida como atalho principal |
| Lançar ou corrigir carimbos | Perfil do cliente | Mantida com confirmação e auditoria |
| Histórico de carimbos | Histórico do Clube | Mantido separado da busca diária |
| Pedido imediato de fatias | Caixa e pedidos de fatias | Mantido |
| Venda digitada pela equipe | Caixa e pedidos de fatias | Criada para balcão, telefone e WhatsApp |
| Pré-reserva e encomenda | Encomendas | Mantida com etapas próprias |
| Agenda e bloqueio de horário | Agenda operacional | Mantidos |
| Notas e lembretes do CRM | Cliente da encomenda | Mantidos ligados ao pedido correspondente |
| Pede Junto | Pede Junto Adoce | Mantido como fluxo especializado |
| Cadastro comercial de produtos | Produtos e disponibilidade | Mantido |
| Disponibilidade, estoque e caldas | Produtos e disponibilidade | Reunidos |
| Fotos, vídeos e conteúdo | Produtos e disponibilidade | Reunidos |
| Faturamento e taxas | Financeiro | Criado como visão própria |
| Prazo de expiração e taxas | Configurações globais | Criado como regra editável |
| Cancelados, expirados e excluídos | Histórico e arquivados | Retirados das filas ativas |
| Equipe, plano e restauração | Administração | Mantidos com acesso por permissão |

## Referências de produto utilizadas

A organização segue princípios encontrados em sistemas maduros de ponto de venda e operação: painel orientado a exceções, pedidos separados por etapa, inventário conectado à venda, relatórios por período e método de pagamento, e arquivamento fora da rotina ativa. Foram aproveitados apenas os padrões compatíveis com o tamanho e o modo real de trabalho da Adoce.

## Regra para novas funções

Antes de adicionar um novo botão ou menu, responder:

1. Qual tarefa real da Beth ou do Rubens começa aqui?
2. A função pertence ao trabalho do dia, à gestão ou à administração?
3. Já existe outro lugar que resolve a mesma intenção?
4. O registro está ativo ou deveria estar no histórico?
5. A ação precisa aparecer no celular e no tablet?

Se duas funções respondem à mesma intenção, elas devem ficar na mesma área ou ser fundidas.
