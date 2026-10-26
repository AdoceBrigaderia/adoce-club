# Assets visuais — página de Cardápio Adoce Brigaderia

Este pacote é EXCLUSIVO da simulação de cardápio aprovada na conversa.

## Estrutura
- `logo/`: logomarca original fornecida pelo cliente, preservada sem redesenho.
- `svg/decoracoes/`: ornamentos, ondas e fundos vetoriais independentes.
- `svg/icones/`: ícones individuais em SVG, compatíveis com browsers modernos.
- `css/assets.css`: exemplo de integração e tokens visuais.
- `manifesto.json`: inventário de arquivos.

## Atenção à fidelidade
Os SVGs são **recriações vetoriais aproximadas** baseadas no mockup, e não extrações nem reproduções pixel-perfect. Compare cada elemento em navegador e ajuste antes de produção. A logomarca é o arquivo original fornecido, sem edição.

## O que não deve virar imagem
Cabeçalho funcional, saudação, calendário de dias, textos, cards de sabores, preço, disponibilidade, estoque, botões, menus e layout responsivo. Construa-os em HTML/CSS com dados reais.

## Fotos dos sabores
As fotografias individuais originais dos produtos NÃO estão incluídas; não foram recortadas do print nem inventadas. Use os arquivos originais do catálogo/site existente.

## Integração
Use `<img src="/assets/svg/icones/cardapio.svg" alt="">` para ícones decorativos, ou SVG inline para mudar `stroke` via CSS. As ondas funcionam como background-image e podem ser escaladas conforme viewport.
