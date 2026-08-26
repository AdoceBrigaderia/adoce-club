# Correção — a data e hora em que o cliente fez o pedido
**12/08/2026** · Cole tudo abaixo da linha.

---

## O problema, visto na tela

O Rubens abriu o pedido `ADO-2026-000012` e não achou quando o cliente pediu. Pior: a ficha mostra **`12/08/2026, 02:17`** logo abaixo do número, e qualquer pessoa lê aquilo como data do pedido — mas é **a hora em que a ficha foi impressa**.

Existem **três datas diferentes** no sistema, e hoje elas se misturam:

| Data | O que é | Onde estava |
|---|---|---|
| **Pedido** | quando o cliente pediu | **não aparecia em lugar nenhum** |
| **Retirada / entrega** | quando o cliente busca | no cabeçalho ("15/08/2026, 01:30") |
| **Impressão** | quando saiu papel | colada no número, sem rótulo |

A data do pedido é a que resolve discussão no balcão ("eu pedi antes dela") e a que mostra que um pedido está esperando tempo demais. Ela não pode faltar.

---

## 1. Ficha térmica — já corrigido, só integrar

`src/lib/impressora-termica.ts` foi atualizado. **27 testes passando.**

- nasceu `quando(iso)` → `"11/08/2026 as 17h00"`, no fuso `America/Fortaleza`
- a data do **pedido** entra logo abaixo do número: `Pedido em 11/08/2026 as 17h00`
- a hora da **impressão** foi para o rodapé, sempre com o rótulo `impresso ...`
- `Ficha` ganhou `impressoEm?`; sem ele usa a hora de agora

Há teste travando a distância entre as duas e travando que a de baixo sempre tem rótulo.

**Ao montar a ficha, passe `criadoEm` com o `created_at` real do pedido** — não com `new Date()`.

---

## 2. Onde mais a data do pedido precisa aparecer

**Detalhe do pedido** (a tela do print) — abaixo do nome do cliente:

```
Pedido em 11/08/2026 às 17h00
Retirada 15/08/2026 às 01h30
```

Duas linhas, rotuladas, nunca uma data solta. Hoje só existe a segunda.

**Agenda operacional** — hoje cada item mostra uma data **solta**, sem dizer o que é. Fica assim:

```
ADO-2026-000012 · Josefa Maria
Docinhos especiais
Retirada 15/08/2026 às 01h30
pedido em 11/08, 17h00 · (85) 99623-9271
```

A retirada é a informação principal do item — mantenha em destaque. A data do pedido e o telefone vão em linha menor, embaixo.

E **"JosefaMaria" está sem espaço**. Se o nome veio assim do cadastro, corrija na origem; se é a tela juntando nome e sobrenome, conserte a junção.

**Painel do dia** — já usa "há 6 min". Mantenha, mas com a data completa no `title`, para quem passar o dedo ou o mouse.

**Acompanhar pedido (cliente)** — o primeiro passo da linha do tempo é "Reserva recebida". Ele tem que mostrar a data e hora reais do pedido, não "hoje".

**Arquivo** — a busca por período deve filtrar pela **data do pedido**, não pela de retirada. São coisas diferentes e hoje é fácil confundir.

---

## 3. Uma regra para o site inteiro

> **Data sem rótulo é proibida.** Toda data na tela diz o que ela é: "Pedido em", "Retirada", "impresso".

Foi a falta de rótulo que fez a hora da impressora virar hora do pedido na leitura.

Use sempre `quando()` de `impressora-termica.ts` — ou extraia para `src/lib/datas.ts` se preferir, mas **um formatador só** para todo o sistema, no fuso de Fortaleza. Hoje há formatos diferentes em telas diferentes.

---

## 4. Uma coisa que talvez seja outro problema

Dois pedidos aparecem com retirada em **15/08/2026 às 01:30** — uma e meia da manhã. É horário de confeitaria fechada.

Pode ser: cliente que errou ao escolher, campo que está guardando a hora do pedido no lugar da retirada, ou fuso trocado (UTC gravado como local).

**Verifique:**

```sql
select id, created_at, scheduled_for, pg_typeof(scheduled_for)
  from orders
 where id in ('ADO-2026-000012','ADO-2026-000013');
```

Se `created_at` e `scheduled_for` estiverem próximos ou iguais, é bug de gravação, não escolha do cliente. Me diga o que encontrou — **não conserte os dados sem confirmar comigo**, pode ser pedido real.

E acrescente uma trava: retirada fora do horário de funcionamento avisa na hora de reservar, em vez de virar pedido impossível.

---

## 5. A agenda está estourando a largura da tela

No print da agenda, o cartão **"Registrar uma nova solicitação"** é mais largo que o celular: o título some no corte da direita e o botão aparece como **"+ Nova soli"**. A lista inteira também encosta na borda.

Isso é estouro horizontal, e é o tipo de erro que faz a pessoa achar que o sistema está quebrado.

**Causa mais provável:** um `grid` ou `flex` cujo filho tem `min-width: auto` por padrão — o conteúdo empurra a coluna para além do container. Também acontece com texto longo sem quebra.

**Corrija assim:**

- em toda coluna de grid use `minmax(0, 1fr)`, nunca `1fr` sozinho
- nos filhos de flex que contêm texto, `min-width: 0`
- nos títulos longos, `overflow-wrap: anywhere`
- o botão de ação nunca com largura fixa: `width: 100%` no celular

E acrescente uma trava para não voltar:

```css
/* Nada pode ser mais largo que a tela. Uma vez a agenda foi, e o
   botao "Nova solicitacao" apareceu cortado no meio da palavra. */
html, body { overflow-x: hidden; }
```

⚠️ `overflow-x: hidden` **esconde o sintoma**. Corrija a causa primeiro e deixe a linha só como rede de segurança.

**Confira em 360px de largura** — é o celular do print. Se aparecer barra horizontal, não está resolvido.

---

## 6. O telefone na lista

A agenda mostra `+5585996239271`. Ninguém lê número assim.

- formate: **(85) 99623-9271**
- deixe menor e mais claro que o nome — é dado de apoio, não título
- e torne-o **tocável**: um toque abre o WhatsApp daquele cliente. É a ação que a Beth mais faz olhando essa lista.

---

## Verificação

```bash
npx vitest run src/impressora-termica.test.ts   # 27 testes
git grep -n "Pedido em" -- src | head
```

**No celular, com a tela em 360px:**

- nenhuma barra de rolagem horizontal em nenhuma tela da operação
- o botão "Nova solicitação" aparece inteiro
- toda data com rótulo
- telefone formatado e abrindo o WhatsApp ao toque

E na tela: abrir `ADO-2026-000012` e ver as duas linhas rotuladas; imprimir e conferir que "Pedido em" está no topo e "impresso" no rodapé.

---

## O que NÃO fazer

- Não usar `new Date()` como data do pedido — use o `created_at` do banco
- Não mostrar data sem rótulo em nenhuma tela
- Não alterar os dados dos pedidos 000012 e 000013 antes de me dizer o que a consulta devolveu
