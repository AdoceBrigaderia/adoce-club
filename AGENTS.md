# Instruções do projeto Clube Adoce

Os arquivos Markdown listados em `docs/documentation-manifest.json` são a fonte oficial da documentação.

## Motor de reservas e baixa de estoque — zona de tripla confirmação (decisão do proprietário em 02/11/2026)

As tabelas/funções a seguir controlam se um sabor pode ser vendido e se uma fatia é
reservada de verdade: `flavor_availability` (e o trigger
`normalize_flavor_availability_status`), `cash_draft_reservations`, as funções
`staff_set_cash_draft_reservation`, `staff_release_cash_draft_reservation`,
`recalcular_reserva_de_fatias`, e o carregamento de sabores do caixa em
`OperationManualSale.tsx` (`load()`, `setQuantity`). Já regrediu mais de uma vez.

- Antes de alterar qualquer parte deste motor — função SQL, trigger, RPC, ou o código
  de carregamento/filtro de sabores do caixa — é obrigatório **pedir confirmação
  explícita ao proprietário três vezes**: (1) ao propor o diagnóstico da causa raiz,
  (2) ao propor a mudança específica antes de editar qualquer arquivo ou aplicar
  qualquer migração, e (3) imediatamente antes de aplicar em produção. Nunca pular
  nem combinar essas três confirmações numa só pergunta.
- Vale também para ajustes manuais de dado (ex.: UPDATE direto em
  `flavor_availability` para desbloquear uma venda): são permitidos para destravar um
  caso pontual, mas não substituem a revisão e as três confirmações antes de mudar o
  código/trigger que causou o problema.
- Antes de propor qualquer mudança neste motor, ler o histórico de regressões: `git
  log --oneline -- src/OperationManualSale.tsx` e as migrações
  `20261028090659_release_other_cash_drafts.sql`,
  `20261025053000_enforce_zero_stock_unavailable.sql`, e qualquer migração mais nova
  que toque `flavor_availability`, `cash_draft_reservations` ou `cash_sessions`.

## Fonte única obrigatória — decisão do proprietário em 08/10/2026

- Toda atualização deste site deve acontecer exclusivamente em `D:\AdoceOnLine`.
- Nunca criar outra pasta de projeto, cópia de release, réplica, checkout ou worktree para atualizar, testar, revisar, homologar ou publicar este site.
- Trabalhar diretamente na pasta principal e preservar suas alterações existentes. Diretórios internos normais, como `src`, `supabase`, `public` e `android`, são componentes do mesmo projeto; não podem conter outro aplicativo completo.
- Não usar cópias antigas como fonte independente. Histórico e recuperação usam o Git da pasta principal.
- Antes de desenvolvimento, testes, compilação ou publicação, executar a verificação de fonte única prevista nos comandos do projeto.
- Não contornar os bloqueios de fonte única e de recursos operacionais. Publicação em produção continua exigindo autorização explícita.

## Ambiente online único e autorização de produção — decisão do proprietário em 24/10/2026

- O único ambiente online permitido é a produção do mesmo projeto Netlify. O endereço principal é `https://www.cantinhodaadoce.com.br`, após migração autorizada expressamente pelo proprietário e publicada/validada em 02/11/2026. O domínio anterior permanece vinculado exclusivamente para redirecionar páginas e manter callbacks de serviços já configurados.
- O antigo site de homologação online está definitivamente desativado e não pode ser recriado, reutilizado, referenciado ou receber deploy.
- São proibidos Deploy Previews, branch deploys, aliases públicos de revisão e qualquer site online de teste conectado aos dados ou credenciais deste produto.
- Desenvolvimento, testes e validações anteriores à produção acontecem somente na pasta principal e em ambiente local. Dados reais não podem ser expostos em uma URL alternativa.
- Toda e qualquer modificação futura exige perguntar explicitamente ao proprietário se pode ser aplicada em produção. Autorização para desenvolver, testar ou revisar não autoriza publicar.
- Só apresente uma solução como concluída depois de comprovar a causa, validar a correção e, quando autorizada, confirmar o comportamento no domínio oficial após a publicação.

## Antes de alterar qualquer coisa

1. Leia este arquivo e `docs/documentation-manifest.json`.
2. Consulte os capítulos oficiais relacionados à tarefa.
3. Compare a documentação com o código, as migrações e o comportamento real. Texto documental não é evidência de funcionamento.
4. Preserve alterações locais existentes e dados reais. Não reverta trabalho que não pertence à tarefa.

## Limites obrigatórios do produto

- O site público, o Clube Adoce, o Adoce Hoje e a Adoce Operação são superfícies diferentes.
- Clientes nunca devem ver painéis, métricas, linguagem, rotinas ou dados internos da operação.
- Informações pessoais, segredos, credenciais e chaves administrativas nunca podem ser expostos no navegador.
- Mudanças em tabelas públicas do Supabase exigem RLS, permissões mínimas e validação das políticas.
- Exclusões operacionais devem respeitar as regras de histórico e auditoria documentadas.

## Fonte única de dados por produto — decisão do proprietário em 22/10/2026

Todo dado que descreve um produto (preço, nome, foto, disponibilidade, descrição — qualquer informação sobre aquele
produto) mora em **uma única tabela, uma única coluna**, nunca duplicado nem copiado para outro lugar do banco.

- Proibido copiar um valor de uma tabela para outra "para facilitar a leitura". Se uma tela precisa do preço de
  outra tabela, ela faz um `select`/join naquela tabela na hora de exibir — nunca grava uma cópia.
- Proibido um mesmo fato de negócio (ex: "preço da Torta G") existir em duas colunas de duas tabelas diferentes,
  mesmo que uma seja escrita a partir da outra no código da aplicação. Isso é exatamente o padrão que já causou um
  incidente real em produção: `flavors.whole_cake_price` era gravado a cada salvamento como cópia de
  `commercial_products.base_price` (slug `torta-g`) — quando um preço mudou só na tabela de origem, o Catálogo 2026
  (`commercial_products`) e o Adoce Hoje (`flavors`) passaram a mostrar valores diferentes para o mesmo produto,
  sem ninguém perceber até o cliente comparar as duas páginas. Corrigido em 22/10/2026
  (`supabase/migrations/20261022130000_remove_duplicated_whole_cake_price_single_source.sql`): a coluna duplicada
  foi removida do banco e o código passou a ler direto da fonte.
- Antes de criar qualquer coluna nova que repita um dado que já existe em outra tabela, pare e pergunte: "esse valor
  já existe em algum outro lugar do banco?" Se sim, a solução é um `select`/join na hora de ler, nunca uma coluna
  nova com uma cópia.
- Ao encontrar uma duplicação já existente no banco (coluna que é cópia de outra tabela), isso é sempre um defeito a
  corrigir, mesmo que os valores estejam batendo no momento em que for encontrado — "bater agora" não significa
  "está certo", significa apenas que a divergência ainda não aconteceu.
- Toda tabela de produto (tortas, docinhos, fatias/sabores, etc.) precisa ter um identificador único e estável
  (`id`/`slug`) e deve ser a única fonte consultada por qualquer tela, pública ou de Operação, para qualquer dado
  daquele produto. Catálogos estáticos/impressos (ex: `CatalogPage2026.tsx`) são a exceção documentada: quando por
  decisão de produto um catálogo precisar ser uma peça de marketing estática (não ligada ao banco), isso precisa
  estar escrito explicitamente no código e na documentação do capítulo correspondente, com o processo manual de
  atualização descrito — nunca por omissão.
- O inventário completo de telas/funções do sistema, usado como base para a reformulação da marca, está em
  `docs/25-inventario-funcional-completo.md` e na tela `/operacao/auditoria` (tabela `product_audit_items` no
  Supabase). Qualquer IA que continuar este trabalho deve ler esse documento antes de propor remoção, fusão ou
  redesenho de qualquer tela, e deve procurar ativamente por outras duplicações de fonte de dados (não só preço de
  torta) seguindo o mesmo critério acima — essa varredura completa ainda não foi concluída.

## Regra de validação

Não declare uma correção como concluída apenas porque o código compilou ou um teste isolado passou.

Classifique o resultado como:

- implementado, ainda não testado;
- validado automaticamente;
- validado visualmente;
- validado em produção;
- parcialmente implementado;
- bloqueado ou dependente de configuração externa.

Para mudanças de interface, valide pelo menos:

- computador;
- celular, prioridade principal do site público;
- tablet quando a mudança afetar a operação;
- carregamento, textos, imagens, botões, modais, rolagem, estados vazios e mensagens de erro;
- console do navegador e interação real do fluxo alterado.

Antes de publicar, execute `npm run release:check`. Produção só pode ser atualizada após autorização explícita. Depois da publicação, confira o domínio oficial sem iniciar outro deploy.

## Documentação oficial

Sempre que qualquer documentação oficial `.md` for criada ou alterada:

1. Atualize o manifesto quando houver novo documento, ordem, versão ou data.
2. Execute `node scripts/generate-docs.mjs`.
3. Confirme que `docs/clube-adoce-documentacao.html` foi regenerado.
4. Preserve o HTML como arquivo único e autocontido.

Não edite manualmente o conteúdo consolidado do HTML.
