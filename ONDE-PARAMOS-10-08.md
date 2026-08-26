# Onde paramos — 10/08/2026, domingo

Escrito para você retomar sem reconstruir contexto. Bom dia dos pais.

---

## Pronto hoje

**476 testes passando · typecheck limpo**

| Arquivo | O que faz |
|---|---|
| `src/balcao-atendimento.ts` + teste + `BalcaoAtendimento.tsx` + CSS | **A tela da Beth.** Busca primeiro, últimos atendidos sem procurar, um botão por linha. Quem tem fatia-presente sobe ao topo sozinho. |
| `src/cadastro-rapido.ts` + teste + `CadastroRapido.tsx` + CSS | **Cadastro em dez segundos.** Nome e WhatsApp no aparelho da Adoce. Detecta cliente repetido pelo telefone antes de criar. |
| `src/identidade-do-clube.ts` + teste | **Conserta o loop do Clube** — os itens 1 a 4 da sua lista. |
| `src/pacotes-de-docinhos.ts` + teste | **Docinhos em 25, 50 e 100**, com composição automática: 125 = 100 + 25. |
| `ADOCE-PRODUTO.html` | Material para você e a Beth, com a logo, offline. |
| `REVISAO-ARQUIVOS-LOCAIS-vs-HOMOLOGACAO.md` | Os 179 arquivos, um a um, com risco e recomendação. |

---

## Feito depois que você saiu

**496 testes passando.**

| Arquivo | O que faz |
|---|---|
| `src/catalogo-de-encomendas.ts` + teste | **Uma tela para as cinco linhas** — Tortas, Docinhos, Festas, Escola e Decoração, no mesmo peso. Substitui 5 rotas e 3 componentes que faziam a mesma coisa. |
| `src/CatalogoDeEncomendas.tsx` + CSS | A tela. Abas grudadas no topo: trocar de Tortas para Docinhos não volta mais à home. |

**Confirmei no banco de produção que o catálogo existe, com preços reais:**

| | Preço |
|---|---|
| Torta P · 10 a 15 fatias | R$ 115 |
| Torta M · 20 a 25 fatias | R$ 155 |
| Torta G · 30 a 35 fatias | R$ 195 |
| Docinhos tradicionais | a partir de R$ 35 |
| Docinhos especiais | a partir de R$ 45 |
| Kit Festa na Mesa | R$ 220 |
| Tabuleiros · 100 a 500 colheres | R$ 320 a R$ 550 |
| Adoce na Escola · 15 crianças | R$ 390 a R$ 950 |
| Decoração · Kit Comemore / Pegue e Monte | R$ 50 e R$ 100 |

**O problema não é falta de catálogo — é que a tela não mostrava.** E **12 dos 15 produtos não têm foto.** Só Kit Festa na Mesa e os dois de docinhos têm.

A tela mostra os sem foto assim mesmo, num lugar desenhado para isso. Esconder seria pior: o cliente deixaria de saber que existem. Mas **foto de torta inteira é hoje o item que mais segura a sua meta de 35** — é o produto de maior valor e o único sem nenhuma imagem.

Também achei e corrigi uma coisa pequena que morderia depois: o formatador de moeda do navegador usa **espaço não separável** entre "R$" e o número. Invisível na tela, quebra busca e comparação. Normalizado.

---

## Sobre a sua lista de testes

**Os itens 1 a 4 são um problema só.** O Clube reconhece o membro na home, mostra `6/14`, e ao tocar no perfil manda cadastrar. O cadastro duplicado passa, o código por e-mail não bate com o Magic Link que o Supabase envia, e o Magic Link volta com o token na URL sem abrir sessão.

A causa: **três caminhos de identidade convivendo** — WhatsApp, e-mail e passkey. Nenhum completa sozinho.

`identidade-do-clube.ts` resolve com uma regra única, testada:

> **Se o site sabe quem é a pessoa, ele não pede cadastro.**

E ele aproveita o token do Magic Link em vez de ignorá-lo, lê o QR impresso na sacola (`#cartao/<token>`) — que é o único caminho que funciona para quem está sem dado móvel, porque o papel já está na mão — e limpa a URL depois, para o token não ficar no histórico.

**Item 8, docinhos:** virou regra com teste. As quantidades impossíveis deixam de existir — o botão fica desabilitado em vez de avisar depois que a pessoa já escolheu.

**Itens 5, 6, 7, 9, 10 e 11** entram no redesenho. O 6 é o mais grave comercialmente: **não existe catálogo de tortas com foto, tamanho e preço no site**, e torta inteira é a sua meta de 35.

---

## Decisão confirmada e registrada

**Festas, Adoce na Escola e Decoração continuam** e serão refeitas por completo, com peso igual a Tortas e Docinhos. Suas palavras: *"enquanto a Beth não falar que vamos encerrar, isso precisa fazer parte."*

Sem urgência — mas já entraram na tela nova de encomendas como iguais, e não mais num link discreto embaixo.

A orientação anterior, de deixá-las discretas porque seriam encerradas, está superada. Registrei na memória do projeto para não voltar atrás por engano.

---

## O que está travado esperando alguém

**Produção continua com o código de 31/07 e 58 migrações.** O deploy de sábado não aconteceu — o Codex reportou sucesso, mas produção não mudou. **Antes de tentar de novo, vale perguntar a ele o que publicou de fato.**

Enquanto isso: sem aviso de pedido, sem painel do dia, sem esteira. Foi o que custou o Fabrício.

**A conferência que evita repetir:** depois do deploy, o número de migrações tem que sair de 58 e o deploy no Netlify não pode mais ser `6a6cfa57ebf6cc18b5e7361c`. Dez segundos cada.

---

## Esperando você

1. **Fotos** — e agora são duas frentes: as fatias, para o Adoce Hoje (principalmente o Trufado de Ninho com Morangos), e as **tortas inteiras P, M e G**, que não têm nenhuma imagem e são o produto de maior valor
2. **Sobras de sábado** — foram 116 fatias publicadas; com quanto sobrou eu fecho o faturamento real
4. **Modelo da impressora térmica e do tablet**
5. **`SUPABASE_SECRET_KEY` de produção está sem marcação de segredo** — vale gerar nova
6. **`CHAVES-WEB-PUSH.txt`** continua na pasta com a chave privada. As variáveis já estão nos dois ambientes; pode apagar

---

## Ordem quando você voltar

1. Descobrir o que aconteceu com o deploy de sábado
2. Subir produção de verdade — é o que resolve o aviso de pedido
3. Catálogo de tortas com foto e preço
4. Adoce Hoje redesenhado
5. Festas/Escola/Decoração, conforme sua decisão

Aproveita o dia com ele.
