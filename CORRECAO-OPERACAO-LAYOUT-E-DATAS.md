# Correção da operação — layout quebrado e datas sem rótulo
**12/08/2026** · Comando único. Cole tudo abaixo da linha.
*(substitui `CORRECAO-DATA-DO-PEDIDO.md`, que não foi executado)*

---

# Contexto

O Rubens abriu a operação no celular dele (Android, 360px de largura) e fotografou seis telas. **Todas têm conteúdo cortado, texto quebrado errado ou informação faltando.** A Beth já evita essas telas — *"acabo deixando pro Rubens que tem mais paciência"* —, e assim ela nunca vai usar.

Quatro dos problemas têm a **mesma raiz**: contêiner mais largo que a tela. Conserte a raiz uma vez e some em vários lugares.

**Teste tudo em 360px.** Se aparecer barra de rolagem horizontal, não está resolvido.

---

# PARTE A — Layout

## A0. O mais grave: metade da operação não abre no celular

> "se eu tiver na tela principal da operação no meu celular e apertar em mais eu só consigo ir até Pede Junto"

O menu **não rola até o fim**. Depois de "Pede Junto Adoce" ele trava. Tudo que vem abaixo — **Financeiro, Ajustes, Fotos, Caldas, Equipe, Cardápio da semana** — está inacessível no celular do dono.

Isso não é acabamento. É metade do sistema fora do ar para quem usa celular, que é a Beth.

**Causas prováveis, em ordem:**

1. `overflow: hidden` num contêiner acima da lista — o conteúdo existe e não pode rolar
2. altura fixa (`height`) onde deveria ser mínima (`min-height`), cortando o resto
3. `100vh` num contêiner interno: no celular a barra do navegador entra e sai e o valor mente. Use `100dvh`.
4. a lista rolando dentro de um elemento que não é o que recebe o toque

**Faça:**

- o contêiner do menu **rola de verdade**, até o último item
- espaço no fim, para o último item não ficar sob a barra:
  ```css
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  ```
- se usar altura de viewport, `100dvh` e não `100vh`
- nenhum `overflow: hidden` no caminho entre a lista e a tela

**Teste obrigatório:** abrir "Mais" no celular e **chegar ao último item da lista**, tocá-lo e ver a tela abrir. Faça isso com o teclado fechado e com ele aberto.

## A1. A raiz: conteúdo mais largo que a tela

Aparece em quatro telas:

| Onde | O que o Rubens vê |
|---|---|
| Financeiro · "Por meio de pagamento" | coluna **Líquido** cortada — lê-se só "Lí" e `R$ 5…` |
| Financeiro · "Vendas por dia" | mesma coisa — `R$ 51…` cortado |
| Caixa e pedidos · barra de abas | o ícone de nova encomenda aparece cortado na direita |
| Agenda · campo de busca | *"Buscar número, cliente, telefone ou"* — some no corte |

**Causas, em ordem de probabilidade:**

1. coluna de `grid` declarada como `1fr` — o padrão é `min-width: auto`, e o conteúdo empurra a coluna para fora. **Sempre `minmax(0, 1fr)`.**
2. filho de `flex` com texto longo sem `min-width: 0`
3. `<table>` com mais colunas do que cabe
4. largura fixa em px onde deveria ser `100%`

**Faça:**

```css
/* toda coluna de grid */
grid-template-columns: repeat(2, minmax(0, 1fr));

/* todo filho de flex que contém texto */
min-width: 0;

/* títulos e rótulos longos */
overflow-wrap: anywhere;

/* campo de busca e botões de ação no celular */
width: 100%;
```

E deixe a rede de segurança, **depois** de corrigir a causa:

```css
/* Nada pode ser mais largo que a tela. Uma vez o Financeiro escondeu a
   coluna Liquido e a Agenda cortou o botao "Nova solicitacao" no meio. */
html, body { overflow-x: hidden; }
```

⚠️ `overflow-x: hidden` esconde o sintoma. Não use como conserto.

## A2. As tabelas do Financeiro não cabem no celular

Cinco colunas — Meio, Vendas, Bruto, Taxas, Líquido — não cabem em 360px, e a mais importante (**Líquido**) é justamente a que some.

**No celular, tabela vira cartão empilhado.** Uma linha por meio de pagamento:

```
Pix                                    2 vendas
Bruto      R$ 52,00
Taxas    − R$  0,26
Líquido    R$ 51,74      ← em destaque
```

O líquido é o número que interessa: é o que sobra. Ele nunca pode ser o cortado.

Acima de 720px pode voltar a ser tabela.

Mesma regra em "Vendas por dia".

## A3. O menu "Mais" está quebrando palavra por palavra

Hoje aparece assim:

```
Caixa e
pedidos
de
fatias
```

Quatro linhas para três palavras. Também em "Pede / Junto / Adoce" e "Clientes / & Clube".

**Causa:** o espaço do rótulo é estreito demais — coluna fixa pequena, ou o ícone consumindo largura.

**Faça:** ícone com largura fixa (`flex: 0 0 24px`) e o rótulo ocupando **todo o resto** (`flex: 1; min-width: 0`). Item de menu em lista de uma coluna, ocupando a largura inteira. Nome curto quando couber: "Caixa e pedidos", "Pede Junto", "Clientes e Clube".

**E o "Financeiro" está cortado pela barra de baixo.** Toda tela com navegação fixa precisa de espaço embaixo:

```css
padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
```

## A4. "Caixa e pedidos" tem dois cabeçalhos e dois botões iguais

Na mesma tela aparecem:

- `VENDAS DE FATIAS · Caixa e pedidos · [Atualizar]`
- `VENDAS DE FATIAS · Pedidos de retirada · [Atualizar]`

Dois títulos com a mesma etiqueta e dois botões "Atualizar" idênticos. A pessoa não sabe qual atualiza o quê.

**Deixe um cabeçalho e um botão.** O segundo bloco vira só um subtítulo discreto, sem etiqueta repetida e sem botão próprio.

**E o sublinhado da aba "Fatias" está deslocado** — aparece fora do contêiner, abaixo da linha. Prenda o indicador ao item da aba.

## A5. O zero em Playfair parece a letra O

Em "**0** em andamento" e "**0** para conferir", o zero da Playfair é redondo e lê-se como "O".

**Número de dado usa Inter**, com `font-variant-numeric: tabular-nums` — assim as colunas também alinham. Playfair fica para título e nome de sabor, que é onde ela é bonita.

---

# PARTE B — As datas

## B1. Falta a data em que o cliente fez o pedido

Existem **três datas** e hoje elas se confundem:

| Data | O que é | Situação |
|---|---|---|
| **Pedido** | quando o cliente pediu | **não aparece em lugar nenhum** |
| **Retirada** | quando ele busca | aparece, mas sem rótulo |
| **Impressão** | quando saiu papel | colada no número, parece a do pedido |

A data do pedido é a que resolve discussão no balcão e a que mostra pedido esperando tempo demais.

## B2. Ficha térmica — já corrigida, só integrar

`src/lib/impressora-termica.ts` foi atualizado. **27 testes passando.**

- nasceu `quando(iso)` → `"11/08/2026 as 17h00"`, fuso `America/Fortaleza`
- `Pedido em ...` entra logo abaixo do número
- `impresso ...` foi para o rodapé, **sempre com rótulo**
- `Ficha` ganhou `impressoEm?`

**Ao montar a ficha, passe `criadoEm` com o `created_at` real do pedido** — nunca `new Date()`.

## B3. Onde mais ela precisa aparecer

**Detalhe do pedido:**
```
Pedido em 11/08/2026 às 17h00
Retirada 15/08/2026 às 01h30
```

**Agenda operacional** — hoje mostra a data solta. Fica:
```
ADO-2026-000012 · Josefa Maria
Docinhos especiais
Retirada 15/08/2026 às 01h30
pedido em 11/08, 17h00 · (85) 99623-9271
```

**Painel do dia** — mantenha "há 6 min", com a data completa no `title`.

**Acompanhar pedido (cliente)** — "Reserva recebida" mostra a data real, não "hoje".

**Arquivo** — o filtro por período usa a **data do pedido**, não a de retirada.

## B4. A regra do site inteiro

> **Data sem rótulo é proibida.** Toda data diz o que é: "Pedido em", "Retirada", "impresso".

Um formatador só para todo o sistema, no fuso de Fortaleza. Use `quando()` ou extraia para `src/lib/datas.ts`.

## B5. O telefone

A agenda mostra `+5585996239271`. Ninguém lê assim.

- formate: **(85) 99623-9271**
- menor e mais claro que o nome — é apoio, não título
- **tocável**: um toque abre o WhatsApp. É a ação que a Beth mais faz olhando a lista.

## B6. "JosefaMaria" está sem espaço

Descubra se veio assim do cadastro ou se é a tela juntando nome e sobrenome. Corrija na origem certa.

---

# PARTE C — Dois pedidos suspeitos

`ADO-2026-000012` e `ADO-2026-000013` têm retirada em **15/08/2026 às 01:30** — uma e meia da manhã, confeitaria fechada.

```sql
select id, created_at, scheduled_for, pg_typeof(scheduled_for)
  from orders
 where id in ('ADO-2026-000012','ADO-2026-000013');
```

Se `created_at` e `scheduled_for` estiverem próximos, é bug de gravação ou fuso trocado (UTC salvo como local), não escolha do cliente.

⚠️ **Não altere esses dados.** Me diga o que a consulta devolveu — pode ser pedido real da Josefa Maria.

E acrescente a trava: **retirada fora do horário de funcionamento avisa na hora de reservar**, em vez de virar pedido impossível.

---

# PARTE D — Cadastro de pessoas da equipe

> "cadastro dos funcionários não tem nenhuma opção de inserir dados… ate foto do perfil eu quero"

A tela de Equipe hoje só lista nome e papel. Não dá para editar nada. Precisa virar cadastro de verdade.

## D1. O que a ficha tem que ter

**Identificação**
- **foto de perfil** — enviar do celular, recortar em quadrado, e usar a mesma foto no avatar do balcão e no histórico de carimbos
- nome completo (com espaço — ver B6)
- apelido / como é chamada no dia a dia
- **cargo** — texto livre, porque confeitaria não cabe em lista fechada
- data de entrada
- ativo ou inativo

**Contato**
- **celular com WhatsApp**, formatado `(85) 99623-9271` e tocável
- telefone alternativo, opcional
- **e-mails, mais de um** — lista onde dá para acrescentar e remover, com um marcado como principal. É o principal que recebe aviso do sistema.

**Endereço**
- CEP com busca automática, rua, número, complemento, bairro, cidade, estado

**Acesso ao sistema**
- papel: **Dona/Dono** (tudo), **Atendente** (vende, carimba, imprime — não vê financeiro nem ajustes), **Produção** (esteira e estoque — não vê cliente nem dinheiro)
- botão para **remover o acesso na hora**, sem apagar a pessoa do histórico

**Anotações** — campo livre para o que a Beth quiser lembrar.

## D2. Regras

- **campo obrigatório é só nome e celular.** O resto entra aos poucos; formulário que exige tudo de uma vez ninguém preenche.
- **salvar por seção**, não um botão único no fim. No celular, formulário longo com um botão lá embaixo se perde.
- o e-mail principal é único no sistema; os outros são só contato
- remover acesso **não apaga a pessoa** — o histórico de quem carimbou o quê precisa continuar de pé
- a foto entra pelo mesmo editor que já existe (`ImageEditor`), recorte 1:1

## D3. ⚠️ Dado de pessoa exige cuidado

Endereço, telefone e foto de funcionário são dados pessoais. Isso muda duas coisas:

- **quem pode ver:** só quem tem papel de dono. Atendente e Produção não veem ficha de colega. Garanta no RLS, não só na tela.
- **não peça CPF, RG nem dado bancário nesta tela.** Se for preciso para pagamento, isso é assunto de folha e merece decisão separada do Rubens — não invente campo.

Se o banco ainda não tiver as colunas, crie a migração com RLS restringindo leitura ao papel de dono, e **me diga o que criou** antes de aplicar em produção.

## D4. Onde a ficha aparece

- lista de Equipe → tocar abre a ficha
- botão **"Convidar alguém"** abre a mesma ficha vazia
- o avatar da pessoa passa a aparecer no balcão e no histórico de carimbos, para saber quem atendeu

---

# Verificação

```bash
npx vitest run src/impressora-termica.test.ts   # 27 testes
npm run lint && npm run build
```

**No celular, em 360px de largura, tela por tela:**

0. **Menu "Mais" rola até o último item** e ele abre ao toque — este é o teste que não pode falhar
1. Financeiro — a coluna **Líquido** aparece inteira nas duas tabelas
2. Menu "Mais" — nenhum rótulo quebrando palavra por palavra, e "Financeiro" não fica sob a barra
3. Caixa e pedidos — **um** cabeçalho, **um** botão Atualizar, abas inteiras, sublinhado no lugar
4. Agenda — campo de busca inteiro, botão "Nova solicitação" inteiro
5. Nenhuma tela com barra de rolagem horizontal
6. Todo número de dado em Inter — nenhum zero parecendo "O"
7. Toda data com rótulo
8. Telefone formatado e abrindo o WhatsApp ao toque

9. Ficha de funcionário: enviar foto, acrescentar dois e-mails, salvar celular e endereço, e o dado ficar salvo depois de sair e voltar

Me mande **print depois da correção**, no mesmo celular: as quatro telas de layout, o menu "Mais" rolado até o fim, e a ficha de funcionário preenchida.

---

# O que NÃO fazer

- Não usar `overflow-x: hidden` como conserto — só como rede, depois da causa
- Não usar `1fr` em coluna de grid; sempre `minmax(0, 1fr)`
- Não usar Playfair em número de dado
- Não usar `new Date()` como data do pedido — use o `created_at`
- Não mostrar data sem rótulo em nenhuma tela
- Não alterar os pedidos 000012 e 000013 antes de me dizer o que a consulta devolveu
- Não dizer que está pronto sem os prints em 360px
