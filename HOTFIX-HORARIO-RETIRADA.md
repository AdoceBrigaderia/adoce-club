# HOTFIX — campo de horário trava o pedido
**Publicar sozinho, hoje. Cole tudo abaixo da linha.**

---

# O que está acontecendo agora

Clientes não conseguem fechar pedido. Relato do dono:

> "mesmo quando colocam o horário de retirada o pedido trava e fica pedindo pra inserir o horário novamente, e não permite inserir outro horário que não seja 19:30"

Cada hora com isso no ar é venda perdida.

---

# A causa

`src/InstantOrderPanel.tsx` — um `useEffect` que **depende de `pickupTime` e reescreve `pickupTime`**.

Em `<input type="time">` o navegador emite valor a cada tecla. Quem quer **20:00**:

1. digita o `2` → campo vira `02:00`
2. `02:00 < 19:30` → efeito dispara
3. `setPickupTime("19:30")` → campo volta na hora
4. aviso reaparece

A pessoa **nunca chega no segundo dígito**. Sobra só 19:30, que é o `pickupMinimum` do dia.

---

# ⚠️ Isto é um hotfix. Leve UM arquivo, não o resto.

A cópia local do dono tem **228 arquivos alterados** acumulados (tokens de marca, telas novas, migrações). **Nada disso entra aqui.**

**Não aplique migração. Não toque no banco.** Este conserto é só de interface.

**Faça assim:**

```bash
git checkout -b hotfix/horario-retirada <commit-que-está-em-produção>
```

Aplique **apenas** a alteração abaixo, em `src/InstantOrderPanel.tsx`.

---

# A alteração

## Trocar isto:

```js
  useEffect(() => {
    if (pickupTime && pickupMinimum && pickupTime < pickupMinimum) {
      setPickupTime(pickupMinimum);
      setNotice(`Com as quantidades escolhidas, o pedido completo fica pronto a partir das ${pickupMinimum.replace(":00", "h")}.`);
    }
  }, [pickupMinimum, pickupTime]);
```

## Por isto:

```js
  // O horario digitado NAO e corrigido enquanto a pessoa digita.
  //
  // Antes este efeito dependia de `pickupTime` e o reescrevia. Em <input
  // type="time"> o navegador emite valores intermediarios a cada tecla: quem
  // queria 20:00 digitava o "2", o campo virava "02:00", o efeito via que
  // 02:00 < 19:30 e devolvia 19:30 na hora. Resultado: so era possivel deixar
  // 19:30, e o aviso reaparecia sem parar. Cliente travava aqui.
  //
  // Agora a correcao acontece so quando o MINIMO muda — ou seja, quando a
  // pessoa altera as quantidades e o pedido passa a ficar pronto mais tarde.
  // O que ela digita fica intacto; a validacao final e feita no envio.
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

`useRef` já está importado no arquivo. **Nenhuma outra linha muda.**

Verificado aqui: `tsc` limpo, `vite build` limpo, 24 testes de horário e disponibilidade passando.

---

# Um teste que impede isso de voltar

Crie `src/horario-retirada.test.ts`:

> Com `pickupMinimum` de `19:30`, simular a digitação de `20:00` caractere a caractere no campo e verificar que o valor final é **20:00**, não `19:30`.

Esse teste falha no código antigo e passa no novo. É a prova de que o conserto funciona.

---

# Publicar

1. homologação → **testar no celular** (roteiro abaixo)
2. passou → produção

**Se a publicação em produção der `401` de novo**, é a credencial do Netlify sem acesso ao site de produção. Pare e diga — não tente contornar por outro caminho.

---

# Roteiro de teste, no celular

1. montar um pedido e digitar um horário **acima** do mínimo → **aceita, e não volta sozinho**
2. digitar um horário **abaixo** do mínimo → deixa digitar; a mensagem só aparece ao enviar
3. aumentar a quantidade até o pedido ficar pronto mais tarde → o horário sobe sozinho, **com o aviso explicando** — este comportamento é o correto e tem que continuar existindo
4. enviar o pedido com horário válido → **entra**

---

# Me devolva

- hash e id do deploy de **homologação** e de **produção**
- confirmação de que **só `src/InstantOrderPanel.tsx`** entrou no commit (`git show --stat`)
- confirmação de que **nenhuma migração** foi aplicada
- o resultado dos 4 passos do roteiro, no celular

---

# O que NÃO fazer

- Não trazer os outros 227 arquivos alterados
- Não aplicar migração nenhuma
- Não mexer no banco
- Não juntar isto com o release grande — ele espera; este não
- Não dizer que publicou sem o `git show --stat` provando que foi um arquivo só
