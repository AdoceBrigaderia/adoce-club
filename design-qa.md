# Design QA — ajustes públicos Adoce

## Fontes visuais comparadas

- Hero comentado: `C:\Users\RUBENS~1\AppData\Local\Temp\codex-clipboard-e79e2723-b70f-40f2-b622-fec93d8c9ed9.png`.
- Hierarquia de Fatias comentada: `C:\Users\RUBENS~1\AppData\Local\Temp\codex-clipboard-903b435c-9664-4f02-8b70-90fe3d111a6e.png`.
- Barra do cliente conectado: `C:\Users\RUBENS~1\AppData\Local\Temp\codex-clipboard-879cea70-1d9b-4e17-991b-ea994226cd4f.png`.
- Foto real do hero: `C:\Users\RubensBezerra\AppData\Local\Temp\codex-clipboard-0951d905-9ee6-4229-bd39-87010d22ab7a.png`.

## Comparação e correções confirmadas

- O hero móvel foi reorganizado em duas áreas: texto e ações alinhados à esquerda, fotografia real à direita.
- Os textos auxiliares dos diferenciais e o cartão de retirada foram removidos.
- O bloco de benefícios preserva apenas ícones e títulos, usando “Tortas incríveis”.
- O convite do Clube ganhou logomarca, destaque de 14 carimbos, prévia gráfica do cartão e ação principal.
- Em Fatias, o menu compacto com as seis categorias aparece antes de “Catálogo Adoce / Fatias”.
- Abaixo do título ficam apenas os três filtros “Hoje”, “Tradicionais” e “Premium”, a busca e os produtos.
- O banner grande e o segundo conjunto de filtros foram removidos.
- A barra compacta do cliente conectado continua limitada a menu, saudação, logomarca, QR e progresso.
- Não há ocorrência visível de “bolo” ou “bolos” no código público; a nomenclatura foi padronizada para torta.

## Validação executada

- Testes responsivos nas larguras 320, 360, 375, 390, 412, 430, 768, 1024 e 1280 px.
- Sem rolagem horizontal indevida nas páginas Início e Fatias.
- Menu de catálogo com seis categorias e filtros com três opções presentes em todas as larguras.
- Navegação, textos, imagens, carregamento e console verificados localmente.
- `npm run release:check`: 136 arquivos e 522 testes aprovados, tipagem, compilação e documentação aprovadas.

## Resultado final

passed

## Validacao adicional - catalogo e avisos de disponibilidade - 2026-08-04

- Fatias verificadas em 390 x 844 e 1280 x 800, sem rolagem horizontal indevida.
- Catalogo comercial verificado em 390 x 844 e 768 x 1024, com o mesmo menu de seis categorias.
- Tortas verificadas sem fotos nos cards e com galeria separada por tamanho.
- Docinhos verificados com fotos nos cards e sem galeria separada.
- Visualizador de imagens verificado no celular e no computador, preservando a proporcao sem corte ou distorcao.
- Estado indisponivel verificado sem o circulo sobre a foto; acao para solicitar aviso abre o formulario de nome, sobrenome e WhatsApp.
- Fila operacional de avisos e cancelamento confirmados no banco de homologacao.
- Console das rotas publicas verificadas sem erros ou avisos.

Resultado: passed

## Minha conta com prioridade para o Clube - 2026-08-15

- Fonte visual: `C:\Users\RUBENS~1\AppData\Local\Temp\codex-clipboard-492d9758-0227-40c7-8b42-f316d9aae246.png` (312 x 222 px, recorte do cartão).
- Implementação móvel: `C:\Users\RubensBezerra\.codex\visualizations\2026\08\15\01a00500-5444-7223-8a28-19363f425c65\minha-conta-mobile.png` (captura 375 x 812 px; viewport solicitado 390 x 844 CSS px; densidade 1).
- Implementação desktop: `C:\Users\RubensBezerra\.codex\visualizations\2026\08\15\01a00500-5444-7223-8a28-19363f425c65\minha-conta-desktop.png` (captura 1265 x 889 px; viewport solicitado 1280 x 900 CSS px; densidade 1).
- Estado comparado: cliente autenticado na tela Minha conta, com 8 de 14 carimbos, 1 fatia grátis disponível e preferências recolhidas.
- Comparação completa: o cartão do Clube é o primeiro conteúdo, seguido por dois atalhos de largura equivalente e pelos quatro recursos secundários.
- Comparação focada: cartão confrontado diretamente com o recorte de referência no mesmo passe visual; foram preservados tipografia serifada, rosa principal, grade 7 x 2, borda clara, cantos arredondados e botão preenchido.
- Tipografia: Playfair Display no título e Inter nos controles, mantendo a hierarquia da referência.
- Espaçamento: cartão, grade de carimbos e botão mantêm ritmo equivalente; os dois novos atalhos usam a mesma coluna, altura e área de toque.
- Cores: tokens existentes de fundo creme, texto marrom e rosa foram preservados.
- Imagens e ícones: logomarca oficial e ícones existentes da interface foram reutilizados; nenhuma aproximação foi criada.
- Conteúdo: o bloco de nome, e-mail e telefone foi removido do início; os dados continuam em Preferências e configurações.
- Recompensa: saldo real de prêmios maior que zero exibe a quantidade de fatias grátis disponíveis e orienta o resgate pelo QR Code; o estado sem prêmio não mostra um benefício indevido.
- Interações: Gerar QR Code abriu o QR e exibiu Pronto para apresentar; Fazer pedido online abriu o Adoce Hoje com produtos e ação Adicionar ao pedido.
- Console: sem erros ou avisos relevantes no celular e no computador.
- Histórico de comparação P0/P1/P2: nenhuma divergência acionável encontrada na primeira comparação; não foi necessária nova iteração visual.

final result: passed

## Eventos e aluguel de decoracao - carrossel e galeria - 2026-08-05

- Alteracao restrita as telas Eventos e Aluguel de decoracao.
- Carrossel com as fotos reais da categoria posicionado antes dos cards de produtos.
- Galeria completa acessivel pelo botao Galeria de imagens.
- Cards de produtos mantidos somente com nome, valor e acao, sem fotografia.
- Secoes antigas duplicadas ocultadas nessas telas e nas demais telas comerciais de referencia.
- Tortas, Docinhos, Fatias e Adoce na Escola nao receberam esse novo formato de cards.

Resultado: passed
