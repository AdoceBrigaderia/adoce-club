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

## 29/10/2026 — compactação da venda no Caixa

- Título reduzido para “Caixa”; busca do Clube, celular e nome alinhados ao lado e antes dos sabores.
- Removidos “Identificação do cliente”, os textos “(opcional)” e a seção duplicada “Pedidos online”.
- Teste específico: `src/cash-checkout-layout.test.tsx`.
- Estado: implementado localmente; publicação e atualização do tablet dependem de autorização específica do proprietário.
## Eventos e aluguel de decoracao - carrossel e galeria - 2026-08-05

- Alteracao restrita as telas Eventos e Aluguel de decoracao.
- Carrossel com as fotos reais da categoria posicionado antes dos cards de produtos.
- Galeria completa acessivel pelo botao Galeria de imagens.
- Cards de produtos mantidos somente com nome, valor e acao, sem fotografia.
- Secoes antigas duplicadas ocultadas nessas telas e nas demais telas comerciais de referencia.
- Tortas, Docinhos, Fatias e Adoce na Escola nao receberam esse novo formato de cards.

Resultado: passed

---

# Design QA — experiência pública Adoce 2026

Data: 25/10/2026

## Referências comparadas

- entrada principal aprovada;
- cardápio/pedido online aprovado;
- catálogo completo aprovado;
- painel Clube Adoce aprovado;
- cadastro do cartão fidelidade aprovado;
- pacotes originais de recursos visuais fornecidos pelo proprietário.

## Superfícies verificadas

- `/` em 390 × 844 e 1440 × 900;
- `/cardapio` em 390 × 844;
- `/sabores` em 390 × 844;
- `/catalogo` em 390 × 844;
- `/clube/cadastro` em 390 × 844;
- componentes do Clube preservados e reorganizados para o novo painel.

## Resultado visual e funcional

- identidade rosa, creme e chocolate preservada;
- recursos fornecidos usados diretamente, sem transformar as páginas em imagens únicas;
- fotos reais das tortas e dos docinhos usadas no catálogo;
- hierarquia, chamadas para ação, preços, medidas, revenda e instruções equivalentes ao mockup;
- responsividade sem rolagem horizontal indevida no cardápio e na entrada;
- `/sabores` não exibe disponibilidade, estoque, reservas ou “Avise quando voltar”;
- `/cardapio` não apresentou nenhum produto simultaneamente com zero em estoque e selo “Disponível hoje”;
- links canônicos apontam para as seis rotas aprovadas;
- console sem erro da aplicação nas rotas verificadas. A conexão de atualização automática do servidor local não é parte do pacote de produção e não afetou o carregamento.

## Adaptações deliberadas

- o cadastro mantém o campo de e-mail porque ele faz parte da confirmação segura já existente; removê-lo apenas para copiar o mockup quebraria o fluxo funcional;
- rotas antigas permanecem como aliases invisíveis para não quebrar links já distribuídos;
- o conteúdo se reorganiza verticalmente no celular, preservando ordem, textos e ações.

## Estado

Revisão reaberta após reprovação visual do proprietário em 25/10/2026. A entrada, o cardápio, o Clube e o cadastro precisam de nova comparação no mesmo enquadramento dos mockups antes de qualquer aceite.

final result: blocked

## Iteração de reconstrução visual — 25/10/2026

- `/cardapio` foi recomposto em 1024 px com cabeçalho de chocolate, logomarca original em alta resolução, navegação superior, saudação, faixa rosa ondulada, seletor semanal e navegação inferior separados.
- A comparação visual local confirmou que a composição deixou de herdar o cabeçalho fixo e o menu flutuante do layout anterior.
- No estado real verificado, domingo 25/10 está sem produção; por integridade, a validação não criou produtos fictícios. Por isso, a grade cheia do mockup permanece dependente de um dia real com produtos liberados.
- `/clube` sem sessão foi reconstruído no enquadramento do mockup, com cabeçalho de chocolate, logomarca central, hero e formulário lado a lado.
- O elemento fotográfico ausente no pacote foi criado como raster independente, sem texto, marca ou controles incorporados: `public/brand-2026/cadastro/adoce_cadastro_fidelidade_assets/referencias/hero-cartao-fidelidade.png`.
- O campo de e-mail foi preservado porque integra a confirmação segura funcional já existente.
- `/clube` autenticado recebeu o novo enquadramento visual e o link “Fazer pedido online” passou a apontar para `/cardapio`; a comparação com dados autenticados ainda depende de uma sessão real segura.
- Verificação automática: 159 arquivos de teste e 913 testes aprovados; compilação e geração da documentação aprovadas.
- Não houve publicação nem alteração em produção.

Resultado desta iteração: validado automaticamente e visualmente nos estados públicos disponíveis; aceite visual completo ainda depende da grade real do cardápio e do estado autenticado do Clube.


## 25/10/2026 — separação de sabores de tortas e fotos de docinhos

- Fonte visual e funcional: catálogo 2026 aprovado e correções indicadas nos prints do proprietário.
- `/catalogo`: mantém tamanhos, preços e regras; o link de tortas abre `/sabores`; a seção de docinhos ganhou link independente para `/docinhos`.
- `/sabores`: removidas a introdução antiga, os cartões repetidos de tamanhos/valores e toda navegação por abas; a página mostra somente busca, fotos e sabores de tortas.
- `/docinhos`: removida a navegação por abas; a página fica separada para fotos e opções de docinhos.
- Validação no navegador local: os dois links foram acionados a partir do catálogo e abriram os destinos corretos, sem a aba Fatias e sem os blocos apontados nos prints.
- Validação automática: testes focados e build concluídos.

final result: passed

