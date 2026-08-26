# Como avaliar as três propostas
**12/08/2026**

---

## A armadilha da quarta IA

Sua ideia de usar uma quarta IA para avaliar é boa, mas tem um risco que precisa ser dito:

**IA julgando IA premia a mais eloquente, não a que funciona.**

A quarta IA não testa nada, não conhece a Beth, não sabe o que é 4G pré-pago em Fortaleza, e não vai pagar a conta se der errado. Se você pedir "escolha a melhor", ela vai escolher **a mais completa e mais confiante** — que costuma ser a mais longa, não a mais certa.

**A solução não é abandonar a quarta IA. É dar a ela o trabalho certo.**

| A quarta IA faz | A quarta IA NÃO faz |
|---|---|
| lê as três e monta comparação item a item | escolher a vencedora |
| aponta onde as três concordam | dar nota |
| aponta onde divergem, e o que está em jogo | decidir por você |
| transforma divergência em pergunta factual | opinar sobre gosto |
| pega contradição e afirmação não verificável | |

**A decisão continua sua.** A quarta IA faz a leitura pesada e te entrega o material organizado.

---

## O princípio que faz a avaliação funcionar

> **Onde as três concordam, provavelmente está certo. Onde divergem, é decisão sua — e cada divergência precisa virar uma pergunta de fato, não de opinião.**

Exemplo. Se uma propõe Next.js e outra Vite, a pergunta não é "qual é melhor". É:

> *"O ganho de otimização de imagem e SEO do Next compensa a complexidade extra, dado que o código é escrito por IA e o público está em 4G caro?"*

Isso você consegue responder. "Qual é melhor" você não.

---

## Os seis critérios — tirados da sua realidade, não de manual

Não avalie por "boas práticas". Avalie pelo que te machuca hoje.

### 1. Toques até o pedido
Mensurável. Menos é melhor. **Foi o que fez seu cliente desistir.**

### 2. Peso da primeira tela
Quantos KB o celular baixa para ver a vitrine. Seu cliente **paga por esse dado**. Proposta que não fala disso não entendeu o público.

### 3. Tempo até a primeira venda nova
Quantos dias até um cliente comprar pelo sistema novo. **Você tem 60 dias.** Proposta que só entrega valor no mês três chegou tarde.

### 4. Prova de isolamento entre tenants
Não "vamos usar RLS". **Como se prova que funciona, automaticamente, a cada publicação.** É responsabilidade legal.

### 5. Recuperação quando quebrar
Vai quebrar. A pergunta é como você descobre e como volta. **"Cada correção quebra dez coisas" foi o que matou o projeto anterior.**

### 6. A Beth usaria?
A régua final. Sistema que a dona evita não existe. Se a proposta não mostra que pensou nela, o resto não importa.

### 7. SEO local sem trabalho manual
Cada tenant é um negócio de bairro diferente. A arquitetura entrega endereço próprio, dados estruturados e sitemap **sozinha**, ou alguém vai ter que fazer à mão para cada cliente? E a proposta separa o que rende em semanas do que só rende em meses — ou mistura os dois e promete demais?

**Sugestão de peso:** critérios 1, 3 e 6 valem dobro. São os que decidem se a Adoce sobrevive.

---

## O prompt para a quarta IA

Cole isso, junto com as três propostas.

---

### PROMPT — Avaliador

Você recebeu **três propostas de arquitetura** para o mesmo projeto, escritas por três IAs diferentes a partir do mesmo briefing.

**Seu papel não é escolher uma vencedora.** É fazer a leitura pesada e entregar o material organizado para que o dono do projeto decida. Ele é iniciante em programação, tem 60 dias para salvar o negócio dele, e vai ser quem paga a conta se a decisão for errada.

**Não dê notas. Não eleja a melhor. Não escreva código.**

Entregue exatamente isto:

**1. Onde as três concordam**
Liste ponto a ponto. Consenso entre três raciocínios independentes é o sinal mais forte que existe aqui. Marque isso como "provavelmente resolvido".

**2. Onde divergem — e o que está em jogo**
Para cada divergência:
- o que cada proposta defende, em uma frase
- **o que teria que ser verdade** para cada opção ser a certa
- **a pergunta factual** que o dono precisa responder para decidir
- o custo de errar essa decisão, e se dá para voltar atrás depois

Este é o item mais importante da sua entrega. Divergência convertida em pergunta respondível vale mais que opinião sua.

**3. O que só uma delas viu**
Ideias que aparecem em uma proposta só. Podem ser as mais valiosas — ou as mais arriscadas. Diga qual dos dois, e por quê.

**4. Contradições e afirmações não verificáveis**
Onde uma proposta se contradiz, promete algo que não sustenta, ou afirma sem base. Cite o trecho.

**5. O que nenhuma das três resolveu**
Buracos comuns às três. É onde o dono vai ser pego de surpresa.

**6. Comparação nos seis critérios**

| Critério | Proposta A | B | C |
|---|---|---|---|
| Toques até o pedido | | | |
| Peso da primeira tela | | | |
| Dias até a primeira venda nova | | | |
| Prova de isolamento entre tenants | | | |
| Como se recupera quando quebra | | | |
| A dona da confeitaria usaria? | | | |

Se uma proposta não responde um critério, escreva **"não respondeu"** — isso é informação, não falha sua.

**7. As três perguntas que o dono precisa responder antes de qualquer código**
Só três. As que mais mudam o resultado.

**Regras:**
- Não invente consenso onde não há
- Não suavize divergência para parecer equilibrado
- Se uma proposta for claramente mais fraca num ponto, diga — mas com o motivo, não com nota
- Português claro. Quem vai ler não é engenheiro.

---

## Como usar o resultado

1. Leia o **item 1** — o que já está resolvido, não precisa decidir
2. Leia o **item 7** — três perguntas, responda
3. Volte no **item 2** e decida cada divergência com as respostas na mão
4. O **item 5** é a sua lista de risco — e o que você vai me trazer

Aí a fusão vira montagem, não debate.

---

## Uma última coisa

**Não peça a fusão para a quarta IA.**

Quem avalia não deve montar — vai puxar para o que já elogiou. Depois de você decidir as divergências, a fusão é trabalho de escrita, e pode ser feita por qualquer uma das três, ou por mim.

O que a quarta entrega é **a leitura**. A decisão é sua, e a montagem vem depois dela.
