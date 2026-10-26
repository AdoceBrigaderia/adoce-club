# Assets visuais — Minha Conta / Clube Adoce

Pacote novo, exclusivo do mockup da página Minha Conta / Clube Adoce.

## Organização
- `logo/`: arquivo original enviado pelo cliente (sem redesenho).
- `decoracoes/`: chocolate do cabeçalho, ondas rosas, rabiscos, círculos e divisor.
- `icones/`: ícones de navegação e ações em SVG.
- `fidelidade/`: coração preenchido/vazio e carimbo ativo/inativo.
- `css/`: tokens de cor e exemplos de uso.

## Fidelidade
Renderize 14 instâncias do componente de carimbo pelo código, usando o arquivo
`carimbo-ativo.svg` para carimbos obtidos e `carimbo-inativo.svg` para os demais.
Não use uma imagem única com 14 carimbos. A quantidade é dinâmica e vem do sistema.

## Integração
Cards, botões, textos, barras de progresso, contadores e estrutura responsiva
devem ser HTML/CSS acessível, não imagens. Ícones são SVGs independentes e podem
ser carregados com `<img src="/assets/icones/usuario.svg" alt="">`.
Use aria-label nos botões que contêm somente ícones.

## Fidelidade ao mockup
Os ornamentos e ícones foram desenhados novamente como vetores aproximados.
Não são recortes nem correspondências pixel a pixel do mockup.
A logomarca é o arquivo fornecido pelo usuário, preservado sem modificação.
O fundo quadriculado visível na imagem original pode fazer parte dos pixels
do arquivo e não foi alterado.

## Observação
Este ZIP contém somente recursos visuais; não contém a aplicação funcional,
dados do cliente, APIs, fotos de produtos ou lógica de resgate de recompensas.
