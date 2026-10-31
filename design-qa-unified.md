# Design QA — proposta pública unificada Adoce

Data: 28/10/2026

Estado: implementação e validação exclusivamente locais em `D:\AdoceOnLine`. Produção não alterada e nenhuma hospedagem adicional criada.

## Fonte de verdade consultada

- domínio oficial `https://www.adocebrigaderia.com.br`;
- rotas oficiais `/`, `/cardapio`, `/catalogo`, `/sabores` e `/clube`;
- documentação oficial do manifesto;
- conteúdo real carregado pela aplicação local.

O domínio oficial confirmou que a página pública ainda exibia oferta e valores de revenda. A decisão atual do proprietário remove esse conteúdo da proposta local e atualiza a documentação oficial correspondente.

## Sistema visual

- fundo creme e papel claro;
- chocolate para estrutura e títulos;
- rosa reservado às ações e estados selecionados;
- títulos editoriais serifados e texto funcional sem serifa;
- cabeçalho, navegação, raios, cartões, botões e rodapé compartilhados;
- fotografias reais sem distorção;
- barra inferior somente no celular e navegação horizontal no computador.

## Rotas verificadas

- `/`: Home nova, com produto e ações no primeiro enquadramento;
- `/cardapio`: datas e sabores reais carregados, com preço e ação de pedido;
- `/catalogo`: tortas, docinhos e regras de encomenda, sem revenda;
- `/sabores`: vitrine real de tortas sem estoque ou promessa de disponibilidade;
- `/clube`: criação do cartão e acesso no mesmo sistema visual.

## Evidências — celular

- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/home-mobile.png`
- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/cardapio-mobile.png`
- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/catalogo-mobile.png`
- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/sabores-mobile.png`
- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/clube-cadastro-mobile.png`

## Evidências — computador

- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/home-desktop.png`
- `.superpowers/sdd/2026-10-28-experiencia-publica-unificada/screenshots/catalogo-desktop.png`

## Conteúdo removido

- seção “Tortas para revenda”;
- preço unitário de revenda;
- pedido mínimo e total de revenda;
- referências documentais que tratavam revenda como oferta pública ativa.

## Resultado

Proposta implementada e revisada localmente em celular e computador. A aprovação visual do proprietário continua pendente. Não executar publicação até nova autorização explícita.
