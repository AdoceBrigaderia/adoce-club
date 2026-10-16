# Operação Integrada — Design

## Objetivo

Corrigir e evoluir os 14 itens do prompt mestre sem criar motores paralelos para clientes, pedidos, estoque, fidelidade, pagamentos, WhatsApp, produção ou compras.

## Decisões confirmadas

- A implantação será feita diretamente em produção, sem ambiente separado de homologação, após todas as validações obrigatórias.
- Uma venda parcialmente paga pode ser concluída operacionalmente.
- Todas as fatias pagas ou com saldo a receber concedem seus carimbos imediatamente na conclusão operacional.
- Cancelamento e estorno revertem os carimbos por lançamento compensatório auditável; movimentos históricos não são apagados.
- Operações financeiras, de fidelidade, estoque e reserva são atômicas e idempotentes.
- Perfis excluídos ou inativos não aparecem em buscas ou seletores operacionais.

## Arquitetura

### Identidade do cliente

Um diretório paginado no banco será a fonte das listagens e buscas operacionais. Nome e telefone terão normalização compartilhada. Edição preservará o `profile_id`, conta, fidelidade, pedidos e histórico. Conflitos devolverão códigos próprios para duplicidade, validação, permissão, concorrência e persistência.

### Pedido, rascunho e estoque

O rascunho do caixa passa a ser recuperável pelo operador e sessão. Carrinho e reserva serão persistidos juntos no servidor. A disponibilidade continuará definida como estoque físico menos reservas, mostrando separadamente estoque, reservado e livre. Expiração de reserva não apagará pedidos online; pedido e bloqueio físico terão ciclos independentes.

### Financeiro e fidelidade

Um fechamento transacional calculará subtotal, descontos comerciais, crédito de fidelidade, pagamentos recebidos e saldo a receber. Desconto em folha exigirá funcionário em cada alocação. Pagamentos posteriores e estornos serão lançamentos, nunca sobrescrita do passado. Carimbos serão concedidos na conclusão operacional mesmo com saldo pendente e revertidos em cancelamento/estorno.

### WhatsApp

Listagens e mensagens serão paginadas. Conversas serão ordenadas pela última atividade. Exclusão operacional será arquivamento lógico em lote, sem apagar clientes, pedidos ou registros financeiros. Antes de abrir nova compra, o bot consultará pedidos do telefone no dia e oferecerá falar sobre o existente ou iniciar outro.

### Produção e compras

Sobras continuarão vinculadas ao lote físico original, com janela comercial do dia seguinte às 08:00 em `America/Fortaleza`. Transferências serão idempotentes e excluirão lotes vencidos, descartados ou impróprios. A margem de 20% será aplicada uma vez apenas na necessidade de compras, depois descontando estoque utilizável e antes do arredondamento comercial.

### Interface

Clientes terão filtros combináveis, ordenação, paginação e edição completa. O seletor no pedido será uma busca acessível com teclado, mouse e toque. Cards de sabores mostrarão estoque, reservado e livre. Os cards Avisos de fatias e Cardápio e atendimento serão removidos de Produção de hoje sem excluir dados ou regras compartilhadas.

## Segurança e compatibilidade

RPCs privilegiadas validarão usuário e função internamente, terão concessões mínimas e chaves idempotentes. Tabelas públicas manterão RLS. Nenhum erro mostrará telefone completo, segredo ou detalhe SQL. Migrações serão aditivas e terão rollback documentado.

## Validação

Cada comportamento terá teste de regressão RED-GREEN. A entrega final exige suíte completa, TypeScript, build, `npm run release:check`, verificação visual em computador/celular/tablet, console limpo, aplicação e consulta das migrações, deploy web, atualização Android do tablet e conferência do domínio oficial.
