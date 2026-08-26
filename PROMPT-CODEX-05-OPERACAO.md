# Prompt 5 para o Codex — painel do dia e esteira de pedidos
**08/08/2026** · Cole tudo abaixo da linha.

---

Traga de `D:\Clube Adoce` os arquivos novos abaixo e integre-os à homologação. **Nada disso vai para produção sem o Rubens validar em homologação primeiro.**

## Arquivos novos

```
src/pede-junto-prazo.ts          src/pede-junto-prazo.test.ts    (26 testes)
src/PedeJuntoPrazo.tsx           src/pede-junto-prazo.css
src/painel-do-dia.ts             src/painel-do-dia.test.ts       (19 testes)
src/PainelDoDia.tsx              src/painel-do-dia.css
src/jornada-do-pedido.ts         src/jornada-do-pedido.test.ts   (20 testes)
src/PedidoNaEsteira.tsx          src/pedido-na-esteira.css
```

Já verificado aqui: `npx tsc -b` limpo, `npx vitest run` com **365 testes passando**.

⚠️ **Continuam faltando no branch**, do prompt anterior: `netlify/functions/alerta-pedidos.ts` e `netlify/functions/alerta-telegram.ts`, mais a dependência `web-push` no `package.json`. O merge do PR #22 entrou sem eles. Os avisos de pedido seguem sem quem envie.

---

## 1. Painel do dia — a nova porta de entrada da operação

**Problema:** existem cerca de 40 telas de operação. O Rubens não acha o botão de liberar produção porque ele está em uma entre quarenta. Hoje, 08/08, os 8 sabores nasceram esgotados e ele só descobriu pela reclamação de uma cliente.

`PainelDoDia.tsx` responde três perguntas, nessa ordem: o que precisa de mim agora, quanto ainda tenho para vender, e o que já aconteceu.

**Integre assim:**

- O painel passa a ser a **primeira tela** ao entrar na operação. As outras quarenta continuam existindo, só deixam de ser a porta de entrada.
- Monte o `EstadoDoDia` a partir de: `flavor_availability` do dia (`planejado` vem de `weekly_service_menu`, `liberado` de `quantity_available + quantity_reserved`, `vendido` do que já saiu), `instant_orders` do dia, e a contagem de `operation_notifications` com `push_status = 'pending'`.
- O `onAcao` recebe a chave da ação. Ligue: `liberar-producao` → a RPC de liberar produção; `pedidos-novos` → lista de pedidos; `dia-vazio` → cadastro de produção da semana.

**Não mexa na lógica de `painel-do-dia.ts`.** As regras estão testadas, inclusive a distinção entre *dia esgotado* (vendeu tudo, não pede ação) e *dia não montado* (não tem produção, é crítico). Confundir os dois faria o painel gritar no melhor dia.

---

## 2. Esteira de pedidos — as etapas que o Rubens pediu

Os estados **já existem** no `CHECK` de `instant_orders.status`. Não crie enum novo, não crie migração:

```
awaiting_confirmation → reserved → preparing → awaiting_payment → ready → completed
```

`PedidoNaEsteira.tsx` mostra a linha do tempo e **um único botão**: o próximo passo. Sem menu de status, sem chance de pular etapa.

**Integre assim:**

- `onAvancar` recebe a etapa de destino. Grave via RPC existente, respeitando as RLS. **Não escreva direto na tabela pelo cliente.**
- Registre quem avançou e quando — hoje não há trilha disso.
- O botão "Copiar e abrir o WhatsApp" já copia o texto e abre `wa.me`. Mantenha as duas coisas: o link abre a conversa com o texto pronto mas **não envia**, e no WhatsApp Business às vezes o texto nem aparece. A cópia é a rede de segurança.

**Duas regras estão codificadas e testadas. Não afrouxe nenhuma:**

1. **O cliente só paga depois que a Adoce confirma que separou.** `podeCobrar()` só devolve verdadeiro em `awaiting_payment` e `ready`. Quando o Mercado Pago entrar, o link de pagamento só pode ser gerado onde `podeCobrar()` for verdadeiro.
2. **Nenhuma mensagem promete o que ainda não aconteceu.** Há teste procurando a palavra "separado" nas mensagens de reserva e falhando se encontrar.

---

## 3. Prazo do Pede Junto

`PedeJuntoPrazo.tsx` entra no topo da sala do grupo, em `GroupOrderPage.tsx`. Mostra o tempo restante e **nomeia quem ainda não escolheu** — hoje o organizador cobra o grupo inteiro, se cansa e desiste, e a venda morre aí.

O botão copia um lembrete pronto para o WhatsApp, **sem link**: boa parte dos clientes tem WhatsApp e Instagram gratuitos no plano mas paga pelo resto, e pedir para abrirem um link constrange quem está sem dado. Há teste garantindo que o lembrete não contenha `http`.

---

## 4. Verificar

```
npx tsc -b
npx vitest run          # esperado 365 ou mais
npx vite build
```

Rode a verificação de codificação nos arquivos novos — todos têm acento, cedilha e til.

Publique em homologação e me informe a URL.

---

## O que NÃO fazer

- **Não toque em produção.** O Rubens validará em homologação primeiro.
- Não crie migração para os status: eles já existem.
- Não reescreva `GroupOrderPage.tsx`, que tem 1.061 linhas e funciona. Só insira a faixa de prazo.
- Não crie conta, não aceite termos, não gere nem rotacione credencial nenhuma.
- Não apague nada do Storage.

---

## Contexto que explica as decisões

Duas clientes chamadas Juliana, em dois dias:

**07/08, Juliana Sousa.** Pediu duas fatias às 12h40, ninguém viu, ligou às 18h e os sabores tinham acabado. O aviso dependia de o próprio cliente tocar em "enviar" num link `wa.me`.

**08/08, Juliana Vidal.** Reservou às 10h52 e ficou sem saber se valia, porque não existe etapa nenhuma comunicada ao cliente.

Os três blocos deste prompt existem por causa dessas duas.
