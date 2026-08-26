---
title: Guia de marca e interface
description: Princípios visuais, linguagem, imagens e padrões de experiência para todas as superfícies da Adoce.
status: Norma oficial
---

# Guia de marca e interface

## Essência

A Adoce é artesanal, próxima, cuidadosa e verdadeira. A comunicação deve despertar vontade e confiança por meio dos detalhes, sem exageros, promessas artificiais ou repetição de palavras que tentem impor uma percepção ao cliente.

O cuidado deve ser percebido na escolha das fotos, na clareza das informações, na fluidez da compra e na forma humana de explicar limites ou imprevistos.

## Hierarquia da marca

- A matriz oficial é `adoce-logo-oficial-original.jpeg`.
- A aplicação digital principal é `public/site/logo.webp`.
- A logo não deve ser redesenhada, distorcida, recortada internamente ou substituída por imagens genéricas.
- Derivações podem remover apenas o fundo externo e otimizar formato e peso.

## Cores principais

| Papel | Referência |
|---|---|
| Chocolate escuro | `#1a0c08` |
| Chocolate principal | `#2b130d` |
| Coral Adoce | `#f06a5f` |
| Creme | `#fff7ed` |
| Papel claro | `#fffaf4` |
| Dourado de apoio | `#d6aa57` |

Contraste e legibilidade têm prioridade sobre fidelidade decorativa. Texto pequeno nunca deve usar uma tonalidade clara demais sobre fundo creme.

## Tipografia e composição

- Títulos editoriais usam serifada de aparência acolhedora, com Georgia como fallback.
- Textos, formulários e controles usam Manrope, Inter ou Segoe UI.
- Títulos devem formar uma leitura clara no primeiro enquadramento do celular.
- Evite blocos longos antes do produto ou da ação principal.
- O site é uma vitrine de venda, não uma apresentação institucional.

## Linguagem

- Fale como uma pessoa cuidadosa, não como um sistema.
- Use frases curtas e concretas.
- Explique o próximo passo antes que o cliente precise perguntar.
- Não repita “honesto”, “real”, “perfeito” ou “feito com amor” como prova de qualidade.
- Substitua linguagem técnica por consequências compreensíveis.
- Erros e indisponibilidades devem explicar motivo, alternativa e próximo passo.

## Fotografia

- Priorize fotos reais da produção, produtos e serviços da Adoce.
- Não estique, achate nem force uma foto para preencher um espaço.
- Use `object-fit: contain` quando o produto completo precisa aparecer e corte editorial somente com enquadramento aprovado.
- Melhorias podem ajustar corte, luz, contraste, saturação e nitidez sem inventar partes do produto.
- Toda troca ou colagem de foto abre uma moldura com a proporção final exata daquele espaço. O editor começa em **Preencher**, mostra o que será cortado e permite escolher **Foto inteira** quando margens forem aceitáveis. A publicação só usa a área visível dentro da moldura.
- Cada item da Central de Imagens informa, com URL completa e clicável, todas as páginas públicas em que aquela imagem pode ser conferida.
- Imagens ilustrativas devem ser identificadas de forma clara e discreta.
- Fotos sem fundo devem ser armazenadas em PNG ou WebP com transparência.

## Interface por superfície

### Site público

Produto, disponibilidade, benefício e ação aparecem cedo. Não exibir métricas, ferramentas ou linguagem da equipe.

### Clube Adoce

Priorizar progresso, recompensa, pertencimento e clareza das regras. No primeiro enquadramento autenticado, o cartão e os carimbos aparecem antes de textos explicativos, configurações ou recursos secundários. A Home reconhece a sessão persistida e apresenta um resumo do cartão; preferências e dados pessoais ficam em uma área própria.

### Fatias

Priorizar sabores disponíveis, quantidade, modalidade e ação de pedido. Em celular, o produto vem antes de explicações institucionais.

Na listagem móvel, cada cartão divide a largura útil entre fotografia e informações, sem tocar as bordas da tela. Preço, descrição e disponibilidade detalhada aparecem ao tocar na foto; a grade mantém apenas nome, situação e ação principal para reduzir ruído e conservar cartões de altura uniforme.

### Adoce Operação

Priorizar velocidade, legibilidade, confirmação de ações e prevenção de erros. Controles destrutivos exigem motivo e resultado visível.

## Responsividade

- Celular é a prioridade do site público.
- Galaxy Tab A7 Lite é a referência inicial da operação em tablet compacto.
- Nenhum modal pode ultrapassar a largura útil, esconder ações ou criar rolagem horizontal.
- Barras fixas não podem encobrir conteúdo ou botões.

## Norma obrigatória Mobile First

Todas as telas do site público, Clube Adoce, Adoce Hoje e Adoce Operação devem ser planejadas e implementadas primeiro para a menor tela suportada. A adaptação para tablet e computador acontece progressivamente, sem criar uma versão de computador que depois seja comprimida para o celular.

Esta norma é obrigatória para telas novas e para qualquer tela existente que seja refeita ou alterada.

### Base técnica

- O documento deve usar `width=device-width, initial-scale=1, viewport-fit=cover`.
- O CSS base representa o celular e as adaptações usam apenas media queries com `min-width`.
- Todo elemento usa `box-sizing: border-box`.
- A página deve ter largura mínima suportada de 320 px e não pode criar rolagem horizontal.
- O conteúdo principal usa largura fluida, margem lateral segura e limite máximo de 1200 px.
- Barras inferiores móveis devem reservar espaço no conteúdo e respeitar `env(safe-area-inset-bottom)`.
- Imagens usam a proporção e o enquadramento adequados à moldura. É proibido usar `object-fit: fill` ou qualquer solução que distorça o produto ou a logomarca.
- Listas horizontais no celular usam `scroll-snap-type: x mandatory` quando funcionarem como carrossel.

### Larguras mínimas de validação

Cada tela deve ser conferida, no mínimo, em 320, 360, 375, 390, 412, 430, 768, 1024 e 1280 px. A validação deve verificar conteúdo, imagens, botões, menus, modais, rolagem, teclado, estados vazios, carregamento, erro e sucesso.

### Cabeçalho e navegação

- No celular, o cabeçalho é compacto, claro e respeita a área segura do aparelho.
- Quando a tela usar o cabeçalho público principal, o menu fica à esquerda, a logomarca original centralizada e notificações à direita.
- A logomarca original nunca pode ser redesenhada, adaptada, esticada ou substituída.
- A navegação inferior pública contém **Início**, **Fatias**, **Cardápio**, **Carrinho** e **Clube**.
- **Cardápio** abre a página exclusiva do cardápio de fatias; **Fatias** abre a disponibilidade e a montagem do pedido.
- A navegação inferior é fixa somente em telas pequenas, não cobre conteúdo e pode virar navegação convencional em telas maiores.
- A operação pode usar destinos diferentes, mas deve preservar o mesmo sistema visual, tamanho confortável dos controles e prioridade para tablet e celular.

### Regra obrigatória para a Home pública

A Home pública deve reproduzir a referência visual aprovada e conter:

1. título “Bem-vindo à Adoce Brigaderia”;
2. diferenciais “Ingredientes selecionados” e “Feito com carinho”, sem subtextos repetidos;
3. ação principal “Fazer meu pedido”, com WhatsApp;
4. ação secundária “Ver fatias disponíveis”;
5. foto real fornecida como destaque, preservando o produto e permitindo somente corte, reposicionamento e ajustes leves de luz e contraste;
6. benefícios “Tortas incríveis”, “Fatias generosas”, “Feito com amor” e “Retirada fácil”, somente com ícone e título;
7. seção “Fatias”, com fotografia, nome, preço e favorito;
8. carrossel móvel com aproximadamente 1,2 a 1,5 cartão visível e quatro cartões lado a lado no computador;
9. convite gráfico do Clube com a regra dos 14 carimbos e a ação “Quero fazer parte”.

No celular, a fotografia do destaque ocupa o lado direito das informações do hero, sem cortes ruins, distorção ou ocultação do produto. O endereço de retirada não aparece sobre essa fotografia.

Quando houver sessão persistida do Clube, a Home não repete o cartão completo. A barra superior reúne somente menu, saudação com o primeiro nome, logomarca original, atalho do QR Code e progresso “x de 14”.

### Regra obrigatória para o Catálogo Adoce

- O mesmo menu apresenta **Fatias**, **Tortas**, **Docinhos**, **Eventos**, **Adoce na Escola** e **Aluguel de decoração**.
- Na tela de Fatias, esse menu compacto vem antes do título do catálogo.
- Cada tela usa o identificador **Catálogo Adoce** e, logo abaixo, somente o nome da categoria ativa.
- Adoce na Escola e Aluguel de decoração podem ocupar duas linhas nos botões para preservar o enquadramento uniforme.
- Tortas não repetem fotografias nos cartões de tamanho; uma ação **Galeria de imagens** abre as fotos organizadas por tamanho.

### Coerência entre todas as telas

- Todas as superfícies compartilham cores, tipografia, raios, ícones, espaçamento, tratamento fotográfico e comportamento de componentes.
- A quantidade de texto deve ser reduzida ao necessário para decidir e agir. Subtextos repetidos devem ser removidos.
- As ações principais aparecem cedo, usam rótulos diretos e funcionam de forma consistente.
- Site público, Clube, Adoce Hoje e Operação permanecem separados em dados, permissões, linguagem e objetivos, mesmo compartilhando a mesma identidade visual.

## Critério de aceite

Uma tela só está visualmente aprovada quando:

1. o objetivo fica claro no primeiro enquadramento;
2. a principal ação está visível e funciona;
3. imagens não estão distorcidas, cortadas sem intenção ou repetidas;
4. textos não estão sobrepostos, truncados ou técnicos;
5. o resultado foi conferido em celular e computador.
