# Cotação, compra e conferência da nota

Data: 13/10/2026  
Estado: aprovado pelo proprietário para implementação e publicação

## Objetivo

Transformar a lista semanal existente em um fluxo único: planejar, pedir orçamento, comparar até três fornecedores, registrar as embalagens realmente compradas e conferir a nota fiscal contra o combinado.

## Decisões

- Permanecer exclusivamente em `D:\AdoceOnLine` e reutilizar o cadastro de fornecedores das notas fiscais.
- Mostrar primeiro `Falta comprar` e depois `Comprados`, sem misturar os dois grupos.
- Cada item aceita fornecedor opcional e até três cotações. Cada cotação guarda fornecedor, quantidade de embalagens, conteúdo de cada embalagem e valor total; preço por embalagem e por unidade de medida são calculados.
- A recomendação escolhe o menor custo comparável que cubra a necessidade. Um orçamento pode dividir os itens entre fornecedores diferentes.
- Uma compra realizada pode ter várias linhas de embalagem para o mesmo produto e fornecedores distintos. A soma normalizada é comparada ao necessário e informa falta, atendimento exato ou sobra.
- O planejamento semanal continua sendo a fonte da verdade. Os novos dados ficam no mesmo documento semanal, sob `procurement`, e são alterados pelo mesmo RPC protegido de gestão.
- A nota fiscal consulta a semana vigente. Para cada item, compara quantidade e preço com as compras registradas e mostra alerta antes de salvar; divergência exige ciência explícita, não bloqueio cego.
- O pedido de orçamento terá português correto e exportação em CSV (planilha), TXT e impressão A4/salvar PDF.
- A importação aceita o próprio CSV/TXT exportado com colunas de fornecedor e valor. Linhas inválidas são apresentadas para correção e nunca gravadas silenciosamente.

## Segurança e consistência

- Somente proprietário/gerente usa os RPCs atuais.
- IDs de item e fornecedor são validados no servidor; valores são finitos, não negativos e limitados.
- Alterações são confirmadas pelo banco antes de serem consideradas sincronizadas.
- A migração é aditiva e mantém semanas antigas compatíveis.
- Testes cobrem pluralização, ordenação, suficiência, melhor fornecedor, exportação/importação e comparação com nota.

## Publicação

Aplicar a migração, executar testes, TypeScript, build e `npm run release:check`; depois publicar pelo fluxo oficial do workspace principal e validar a tela autenticada em computador e celular/tablet.
