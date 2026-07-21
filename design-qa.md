# Design QA — famílias comerciais da Adoce

- **Fonte visual aprovada:** `C:\Users\RubensBezerra\.codex\generated_images\019f7c41-149b-7a00-9682-6629a07a60d5\exec-8c66c9bb-0b61-42fc-9ced-ba87a981c4dc.png`
- **Implementação principal:** `D:\Clube Adoce\outputs\opcao-3-tortas-desktop.png`
- **Implementação no celular:** `D:\Clube Adoce\outputs\opcao-3-tortas-mobile.png`
- **Clube corrigido no celular:** `D:\Clube Adoce\outputs\clube-mobile-corrigido.png`
- **Telas adaptadas:** `opcao-3-docinhos-desktop.png`, `opcao-3-eventos-desktop.png`, `opcao-3-mini-festas-desktop.png`, `opcao-3-escola-desktop.png` e `opcao-3-decoracao-desktop.png`, todas em `D:\Clube Adoce\outputs`.
- **Rota principal:** `http://127.0.0.1:5173/#encomendas`
- **Viewports:** 1440 × 1024 e 390 × 844.
- **Estado:** catálogo público carregado com valores reais do Supabase; formulário de pré-reserva aberto separadamente para teste.

## Evidência da comparação completa

A referência aprovada e a captura renderizada foram abertas juntas, em resolução original, depois de cada passe. A implementação preserva o cabeçalho e hero em textura chocolate, a divisão em três áreas, o título editorial, a fotografia real central, a comparação em superfície creme e a continuação clara da próxima seção.

## Evidência focada

O hero foi comparado em detalhe porque concentra os elementos de maior fidelidade: logotipo, título, CTA, fotografia, nomes, faixas de público e valores. O bloco seguinte foi conferido no mesmo viewport para validar continuidade, ritmo e visibilidade das três escolhas. No celular, foram conferidos título, CTA, fotografia, ausência de sobreposição e largura da página. Uma comparação focada adicional foi feita no Clube Adoce para confirmar que texto, botões e imagem não se sobrepõem mais.

## Superfícies obrigatórias

- **Fontes e tipografia:** Georgia preserva a personalidade editorial; corpo e controles usam a família já adotada pelo site. Hierarquia, pesos, line-height e quebras foram conferidos em desktop e celular.
- **Espaçamento e ritmo:** o desktop usa três colunas e o celular empilha conteúdo, fotografia e comparação. Não existe overflow horizontal nem colisão entre controles.
- **Cores e tokens:** chocolate, creme, coral e rosa seguem os tokens existentes. O cabeçalho passou a continuar o fundo escuro da referência.
- **Qualidade e fidelidade das imagens:** todas as famílias usam fotografias reais cadastradas pela Adoce, sem esticar. A diferença do bolo conceitual da referência é intencional: a implementação honra a exigência de não inventar produto e mantém a foto substituível pelo cadastro administrativo.
- **Conteúdo:** Tortas, Docinhos, Tabuleiro, Mini Festas, Adoce na Escola e Aluguel de Decoração têm promessa, CTA, comparação e prova próprios. Linguagem interna de operação/equipe foi removida da experiência pública.
- **Ícones e controles:** ícones permanecem na biblioteca visual já usada; CTAs têm alvo confortável e estado de foco nativo preservado.
- **Responsividade e acessibilidade:** 1440 × 1024 e 390 × 844 foram renderizados sem sobreposição. No Clube, ações terminam antes da imagem começar. Textos alternativos descrevem fotografias reais.

## Histórico de comparação

### Passe 1

- **[P1] Cabeçalho claro quebrava a continuidade do hero aprovado.**
  - Correção: cabeçalho passou a usar a mesma textura chocolate e contraste branco do hero.
- **[P2] Bloco de escolhas se afastava da composição horizontal da referência.**
  - Correção: conteúdo foi reorganizado em duas linhas, com três escolhas horizontais e fotografia lateral.
- **[P2] CTA e título comparativo divergiam da cópia aprovada.**
  - Correção: Tortas agora usa “Ver qual tamanho combina” e “Escolha com clareza”.

### Passe 2

- Cabeçalho, primeiro viewport, CTA, comparação e continuidade visual ficaram alinhados à direção aprovada.
- Não restaram problemas P0, P1 ou P2.

## Diferenças intencionais

- A fotografia de produto é real e editável no cadastro, em vez do bolo conceitual gerado na referência.
- A seção seguinte acrescenta uma frase de prova específica por família, para atender ao objetivo de marketing honesto sem inventar depoimentos, prêmios ou promessas.
- Os valores e descrições vêm dos produtos publicados, não ficam presos ao desenho estático.

## Verificação do navegador

- Renderização feita no navegador integrado.
- Console verificado sem erros.
- Caminho principal testado: escolher Torta P no comparativo, abrir a solicitação e confirmar a presença do formulário “Solicitar pré-reserva”.
- Abas testadas: Docinhos, Eventos, Tabuleiro, Mini Festas, Adoce na Escola e Aluguel de Decoração.
- Diferença de cópia acima da dobra: somente adaptações aprovadas por família e uso de foto real; nenhum texto interno foi acrescentado.

## Resultado

**final result: passed**
