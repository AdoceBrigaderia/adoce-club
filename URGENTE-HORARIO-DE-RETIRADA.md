# URGENTE — o campo de horário de retirada trava o pedido
**12/08/2026 · Cliente perdendo venda agora**

---

## O que o cliente vive

> "mesmo quando colocam o horário de retirada o pedido trava e fica pedindo pra inserir o horário novamente, e não permite inserir outro horário que não seja 19:30"

---

## A causa — achada e corrigida

`src/InstantOrderPanel.tsx`, o efeito que corrigia o horário:

```js
useEffect(() => {
  if (pickupTime && pickupMinimum && pickupTime < pickupMinimum) {
    setPickupTime(pickupMinimum);
    setNotice(`Com as quantidades escolhidas...`);
  }
}, [pickupMinimum, pickupTime]);   // ← pickupTime como dependência
```

O efeito **dependia de `pickupTime` e reescrevia `pickupTime`**.

Num `<input type="time">`, o navegador emite valor a cada tecla. Quem queria **20:00**:

1. digita o `2` → o campo vira `02:00`
2. `02:00 < 19:30` → o efeito dispara
3. `setPickupTime("19:30")` → o campo volta para 19:30 na hora
4. o aviso reaparece

**A pessoa nunca consegue terminar de digitar.** Qualquer tecla que produza um valor abaixo do mínimo é revertida antes do segundo dígito. Por isso só sobrava 19:30 — que é o horário de abertura do Cantinho da Adoce, o `pickupMinimum` daquele dia.

Não é validação apertada. **É o campo lutando contra quem digita.**

---

## A correção — já aplicada

O efeito agora depende **só de `pickupMinimum`**, e lê o horário atual por `ref`:

```js
const pickupTimeRef = useRef(pickupTime);
pickupTimeRef.current = pickupTime;

useEffect(() => {
  const escolhido = pickupTimeRef.current;
  if (escolhido && pickupMinimum && escolhido < pickupMinimum) {
    setPickupTime(pickupMinimum);
    setNotice(`Com as quantidades escolhidas, o pedido completo fica pronto a partir das ${pickupMinimum.replace(":00", "h")}.`);
  }
}, [pickupMinimum]);
```

**O que muda:**

- digitando, **nada é reescrito** — a pessoa escolhe o horário que quiser
- a correção automática só acontece quando o **mínimo muda**, ou seja, quando ela altera as quantidades e o pedido passa a ficar pronto mais tarde. Aí sim faz sentido ajustar, e o aviso explica.
- a validação continua no envio, onde ela deve estar: `pickupMinimum` e `isPickupTimeAllowed`

`tsc` limpo. 24 testes de horário e disponibilidade passando.

---

## O que você precisa fazer

**1. Publicar.** Isso está travando pedido agora. Vai junto com o release de produção, ou sozinho se ele demorar.

**2. Rodar e conferir, no celular:**
- montar um pedido e digitar um horário **acima** do mínimo → tem que aceitar
- digitar um **abaixo** → o campo deixa digitar; a mensagem só aparece ao enviar
- aumentar a quantidade até o pedido ficar pronto mais tarde → aí sim o horário sobe sozinho, com o aviso

**3. Escrever um teste que trava isso**, para não voltar:

> simular digitação caractere a caractere num campo com `pickupMinimum` de 19:30, digitando "20:00", e verificar que o valor final é 20:00 — não 19:30.

---

## Duas coisas que valem olhar depois

**O campo `type="time"` é ruim no celular.** Em Android varia por fabricante e às vezes abre relógio, às vezes teclado. Para a Adoce, melhor seriam **botões de horário** — 19:30, 20:00, 20:30 — gerados a partir das janelas de retirada. Um toque, sem digitação, sem erro possível. Já existe `horariosDisponiveis()` em `finalizar-reserva.ts` fazendo isso.

**Esse bug provavelmente não é o único.** Um efeito que depende do que ele mesmo escreve é um padrão, e padrão costuma se repetir. Vale procurar:

```bash
git grep -n "useEffect" -A 6 -- src | grep -B4 "set[A-Z]"
```

Qualquer efeito cuja lista de dependências contenha o mesmo estado que ele altera é candidato ao mesmo problema.

---

## E uma pergunta que muda o diagnóstico

Quantos clientes reclamaram, e desde quando? Se começou depois de alguma publicação específica, dá para saber o que introduziu — e conferir o que mais entrou junto.
