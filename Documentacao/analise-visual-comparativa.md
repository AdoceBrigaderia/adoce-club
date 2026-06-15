# Análise Visual Comparativa

## Referências oficiais analisadas

- `referencias/imagens/conceito-cliente.jpeg`: composição da home do cliente, cartão, sabores, atalhos e navegação.
- `referencias/imagens/conceito-vendedor.jpeg`: composição do painel do vendedor, métricas, nova venda e vendas recentes.
- `referencias/imagens/conceito-fatia-premiada.jpeg`: linguagem de celebração, sucesso, brilho e recompensa.
- `referencias/imagens/conceito-familia-indicacao.jpeg`: cartão familiar, avatares, indicação e aniversário.
- `referencias/imagens/cartao-fidelidade-frente.jpeg`: textura rosa, ondas douradas, brilho e promessa de recompensa.
- `referencias/imagens/cartao-fidelidade-verso.jpeg`: grade de 14 espaços e linguagem das regras.
- `referencias/imagens/logo-adoce-original.jpeg`: marca original; único local onde cupcake é permitido.

## Prints antigos analisados

- `Documentacao/prints/01-cliente.png`
- `Documentacao/prints/02-venda-delivery.png`
- `Documentacao/prints/03-venda-qr.png`
- `Documentacao/prints/04-relatorios.png`
- `Documentacao/prints/05-portal-busca.png`

## Por que o visual anterior foi reprovado

O visual anterior validava os fluxos, mas parecia um protótipo simples. A repetição grosseira da logo no fundo substituía a textura delicada do conceito. O header era alto, fragmentado e sem a composição central da marca. Os cards tinham pouca profundidade, quase nenhum ornamento, brilho ou acabamento dourado. A hierarquia tipográfica e os espaçamentos eram muito maiores e mais pesados que no conceito, reduzindo a quantidade de conteúdo visível na tela.

O vendedor não recebia a composição única da referência: métricas, nova venda e vendas recentes estavam separados em telas. A tela de QR parecia técnica. Família e indicação não formavam um painel contínuo. O portal tinha estrutura funcional, mas parecia HTML simples, sem capa, navegação mobile adequada ou identidade editorial oficial.

## Diferenças objetivas

- Fundo anterior: padrão repetitivo de logo. Conceito: textura rosa aquarelada, luz difusa, ondas finas e sparkles.
- Header anterior: bloco horizontal com título quebrado. Conceito: logo pequena, título central grande, subtítulo e ornamentos.
- Cards anteriores: grandes, planos e com borda simples. Conceito: creme translúcido, borda rosada dupla, sombra suave e brilho interno.
- Tipografia anterior: pesada e pouco hierarquizada. Conceito: títulos caligráficos elegantes com textos compactos em marrom.
- Navegação anterior: ícones genéricos e barra reta. Conceito: barra creme arredondada, delicada e integrada.
- Vendedor anterior: operação fragmentada. Conceito: dashboard completo em uma única composição vertical.
- QR anterior: card técnico e vazio. Conceito: celebração premium com ornamentos e ações volumosas.
- Portal anterior: sem capa e sem menu mobile funcional. Conceito desejado: documentação oficial do mesmo produto.

## Plano de reconstrução

1. Criar um sistema visual local com textura CSS, ondas, brilhos, corações e ornamentos dourados.
2. Refazer `AppShell`, header e navegação para reproduzir as proporções dos conceitos.
3. Refazer o cartão de fidelidade, slots e carimbo de fatia em escala compacta.
4. Unificar o painel vendedor com caixa, métricas, venda rápida e vendas recentes.
5. Refazer QR, relatórios, família e indicação como painéis premium contínuos.
6. Reconstruir o gerador do portal com HTML semântico, capa, cards de acesso rápido, busca normalizada, menu recolhível e botão de topo.
7. Gerar prints novos em viewport mobile e comparar novamente com as referências.

## Componentes refeitos

- `AppShell`, `BrandHeader`, `DecorativeBackground`, `VisualOrnaments`
- `LoyaltyCard`, `StampSlot`, `ChocolateCakeSliceStamp`
- `PrimaryButton`, `SoftCard`, `SectionTitle`, `BottomNav`
- `MetricCard`, `SellerSalePanel`, `RecentSalesCard`
- `QRCard`, `FamilyReferralPanel`, `ReportCard`

## Telas refeitas

- Cliente/Home e cartão
- Vendedor/Home e Nova Venda
- QR/Venda registrada e delivery
- Relatórios
- Cartão Familiar e Indicação
- Portal offline desktop e mobile

## Regras preservadas

- Rosa claro, creme, marrom chocolate, rosa forte e dourado.
- Interface mobile-first e áreas de toque confortáveis.
- Quatorze carimbos e barra de progresso.
- Fluxos, rotas, estado local e regras de negócio existentes.
- Funcionamento sem CDN ou dependência visual externa.

## Exceções permitidas

- O carimbo é uma mini fatia de torta de chocolate, e não o símbolo circular do conceito.
- Cupcake aparece somente dentro da logo original.
- Conteúdos inexistentes no MVP real permanecem demonstrativos, sem criar backend ou autenticação.

## Resultado da reconstrução

O app foi reconstruído com composição compacta, cabeçalho centralizado, textura rosa suave, ondas douradas, cartões creme com borda dupla, tipografia caligráfica nos títulos e navegação inferior integrada. O painel do vendedor agora reúne caixa, métricas, venda rápida e histórico na mesma experiência. QR, relatórios, família e indicação receberam o mesmo acabamento visual.

Os prints finais estão em `Documentacao/prints/`:

- `01-cliente-home.png`
- `02-vendedor-home.png`
- `03-venda-qr.png`
- `04-relatorios.png`
- `05-familia-indicacao.png`
- `06-portal-documentacao.png`
- `07-portal-documentacao-mobile.png`

Diferenças residuais justificadas: os mockups usam uma moldura fotográfica de aparelho e fontes/ilustrações geradas que não fazem parte dos arquivos originais do projeto. A implementação mantém HTML responsivo e fontes locais do sistema para funcionar offline. A mini fatia de torta substitui deliberadamente o carimbo circular do conceito, conforme solicitado, e o cupcake permanece restrito à logo original.
