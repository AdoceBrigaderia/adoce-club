# Reorganização do painel Hoje

**Objetivo:** implementar a organização aprovada pelo proprietário no chat: situação dos pedidos, atenção, resumo do dia, atalhos e configurações recolhidas.

**Abordagem:** manter os componentes e suas consultas/ações existentes. Reorganizar o JSX e os estilos; eliminar a grade externa de desktop que cria áreas implícitas. Sem migrações ou alterações no motor de estoque. Fonte exclusiva: D:\AdoceOnLine. Publicação exige nova autorização.

## Tarefas

- [x] Organizar OperationDashboard.tsx e operation-dashboard.css: resumo dos pedidos no topo, alertas juntos, métricas uniformes, atalhos próprios e impressão separada.
- [x] Organizar OnlineOrdersControl.tsx e online-orders-control.css: resumo salvo sempre visível, editor recolhido, indicação de alterações pendentes, campos acessíveis e adaptação para telas pequenas.
- [x] Documentar a organização no capítulo 03, atualizar manifesto e regenerar HTML.
- [x] Executar release:check, revisar diff e conferir localmente computador, celular e tablet, abertura/fechamento das configurações, edição sem salvar e estados de carregamento/erro. Não acionar produção ou impressão real.

## Critérios de revisão

Preservar destinos dos atalhos, consultas e gravações existentes; nenhuma configuração é salva ao abrir/fechar o editor. O resumo público usa apenas os valores salvos. Não cortar texto, controles, horários ou ações em telas estreitas. Indicadores numéricos e atalhos textuais têm hierarquia própria.

## Verificação

Revisão independente sem achados críticos ou importantes. Comentários antigos da grade atualizados. Validação visual local usa os componentes reais com consultas/gravações simuladas, sem autenticação ou dados pessoais reais. Nenhum deploy, alteração no banco ou comando de impressão real.

## Publicação autorizada

Proprietário autorizou publicação e commit no chat. Commit de implementação `12dec32`, enviado à branch oficial. Deploy de produção `6ae938cc0a4c48538e87959f` publicado em 02/11/2026 às 22h29 de São Paulo. Domínio oficial e arquivos do pacote da Operação conferidos por HTTP e igualdade de conteúdo; painel autenticado ainda requer conferência visual em produção.
