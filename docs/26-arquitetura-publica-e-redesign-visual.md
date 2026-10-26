# Arquitetura pública e redesign visual 2026

## Decisão aprovada em 25/10/2026

A experiência pública da Adoce passa a ser organizada pela intenção do cliente:

- `/`: entrada principal, com três caminhos claros: pedido online, catálogo de encomendas e Clube Adoce;
- `/cardapio`: pedido online dos produtos disponíveis no dia;
- `/sabores`: apresentação dos sabores, com o mesmo conteúdo visual do Adoce Hoje, porém sem disponibilidade, estoque ou botão de aviso de retorno;
- `/catalogo`: catálogo comercial de tortas, docinhos, adicionais e revenda;
- `/clube`: painel do programa de fidelidade;
- `/clube/cadastro`: criação do cartão fidelidade.

As rotas públicas anteriores devem continuar funcionando como aliases compatíveis. Essa compatibilidade não autoriza duplicar dados, regras ou páginas: as rotas antigas e novas precisam apontar para a mesma implementação e para a mesma fonte de dados.

## Direção visual

Os mockups e pacotes de recursos fornecidos pelo proprietário em 25/10/2026 são a referência visual aprovada. A implementação deve preservar:

- identidade rosa, creme e chocolate;
- chocolate escorrendo no cabeçalho e ondas no rodapé;
- logotipo original e fotografias reais fornecidas;
- tipografia, hierarquia, espaçamentos, cartões, ícones e chamadas para ação equivalentes aos mockups;
- adaptação responsiva, sem transformar o mockup em uma imagem única;
- conteúdo, botões e regras em HTML/CSS e componentes acessíveis.

A fidelidade é avaliada no celular, que é a prioridade do site público, e também em computador. Elementos podem ser reorganizados para caber em diferentes larguras, mas não devem perder hierarquia, conteúdo ou identidade.

## Regras funcionais

### Pedido online

`/cardapio` usa disponibilidade real do dia. Produto sem saldo livre não pode ser apresentado como disponível nem permitir compra. O estado do dia seguinte não pode herdar produtos com saldo zero.

### Sabores

`/sabores` é uma vitrine permanente. Ela reaproveita fotos, nomes, descrições e detalhes dos sabores do Adoce Hoje, mas não mostra:

- estado disponível/esgotado;
- saldo ou quantidade reservada;
- calendário de produção;
- botão “Avise quando voltar”;
- ação de adicionar ao pedido.

### Catálogo

`/catalogo` apresenta rapidamente tamanhos e preços das tortas, condições de revenda, docinhos tradicionais e especiais, regras da encomenda e chamada para WhatsApp. Os docinhos são apresentados por 50 unidades: tradicionais por R$ 70,00 e especiais por R$ 90,00.

O catálogo encaminha a chamada de sabores das tortas para `/sabores`, que exibe exclusivamente os sabores disponíveis para tortas, sem repetir tamanhos, preços ou navegação por categorias. A seção de docinhos possui uma chamada independente para `/docinhos`, onde o cliente pode consultar fotos e opções de docinhos. A antiga aba pública de fatias não faz parte dessas duas páginas; fatias disponíveis e calendário permanecem somente em `/cardapio`.

### Clube

`/clube` preserva dados reais de carimbos, recompensas, pedidos, favoritos, endereços, pagamentos e preferências. `/clube/cadastro` preserva validações, consentimentos e fluxo real de criação do cartão.

## Fora do escopo desta entrega

Os gatilhos de WhatsApp para correção cadastral, retomada e suspensão permanecem adiados por decisão do proprietário. A aprovação dos modelos na Twilio não deve ser confundida com gatilho implementado ou configuração ativa.

## Publicação

O desenvolvimento e a validação desta reformulação acontecem somente no ambiente local da pasta principal. Nenhuma dessas alterações pode ser publicada sem uma nova pergunta explícita ao proprietário e sua autorização específica para aplicar em produção.
