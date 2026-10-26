# Kit de elementos visuais — Adoce Brigaderia

Arquivos individuais reconstruídos como vetores SVG, sem recortes do mockup. A logomarca foi obtida exclusivamente da imagem original enviada pelo cliente, **não do mockup**.

## Estrutura
- `logos/logo-adoce-original.png`: arquivo original recebido.
- `logos/logo-adoce-transparente.png`: versão para uso web com máscara circular transparente (não é vetorização).
- `icones/`: ícones independentes em SVG para pedidos, encomendas, clube, informações e navegação.
- `ornamentos/`: ondas, pingos de chocolate, selo manuscrito, coração e fundos decorativos.

## Implementação
- Use `<img src="/assets/ornamentos/pingos-chocolate.svg" alt="" aria-hidden="true">` para ornamentos.
- Ícones funcionais devem ter texto acessível no botão/link; SVG decorativo pode ter `aria-hidden=true`.
- Botões, cards, títulos, preços, textos, grid, bordas, sombras, cores de fundo e responsividade **devem ser HTML/CSS**, não arquivos de imagem.
- Fontes sugeridas: uma manuscrita arredondada (ex.: Google Fonts `Kalam` ou `Patrick Hand`) nos títulos, e `Nunito Sans` no corpo. As fontes não são incluídas.
- `pingos-chocolate.svg` e ondas são repetíveis/escaláveis: use `width:100%; display:block`.
- SVGs podem ser coloridos alterando os atributos `stroke`/`fill`; não dependem de bibliotecas externas.
- Para a logo, prefira `logo-adoce-transparente.png` em fundo rosa ou creme. A versão transparente preserva o conteúdo original dentro da área circular, mas a imagem fornecida contém arte raster e não equivale a um SVG oficial.
- O mockup é referência visual; o arquivo não inclui código da página nem funcionalidades.

## Paleta aproximada (referência do mockup)
- Chocolate `#512718`
- Rosa principal `#D95170`
- Rosa claro `#F8C8CD`
- Creme `#FFF5EB`

## Observação
Os desenhos SVG são recriações individuais aproximadas dos ícones do mockup, não cópias pixel a pixel. Os ícones devem ser ajustados pelo desenvolvedor em CSS conforme os tamanhos finais.
