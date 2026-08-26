# Bloco 2 — o que o cliente vê
**Depois do bloco 1.** 34 telas. Cole tudo abaixo da linha.

---

## A base já está aplicada

`src/adoce-tokens.css` já traz as cinco cores do manual e as duas fontes. 48 folhas de estilo já foram passadas. **Não redeclare cor nem fonte** — use as variáveis.

```css
--adoce-rosa: #fbe3dd;        /* rosa creme */
--adoce-rosa-escuro: #e89a91; /* rosa cupcake — a cor da marca */
--adoce-marrom: #3b1f12;      /* chocolate — texto e AÇÃO */
--adoce-dourado: #e8ad67;     /* caramelo — urgência e presente */
--adoce-creme: #fff9f6;       /* branco quente */
--adoce-fonte: 'Inter'
--adoce-fonte-voz: 'Playfair Display'   /* peso 700 nos títulos */
```

**Chocolate age, rosa acolhe, caramelo aponta.** O rosa cupcake nunca é fundo de botão — com texto branco em cima ele reprova em contraste.

---

## 1. Vitrine e venda

**Nossos sabores** — já existe em `CatalogoDeSabores.tsx`, já corrigido: foto 4:5, botão de ampliar reusando `ProductImageViewer`, nome em Playfair dentro da foto, "a fatia" sob o preço, e saída no topo e no rodapé. Confira que está assim.

**Busca de sabor** — o termo procurado fica marcado em caramelo dentro do nome. Cada resultado traz a ação certa: "Quero" para o que tem hoje, "Me avisa" para o previsto.
**Sem resultado é a tela que mais importa:** *"Ainda não fazemos pistache. Mas se você quiser, a gente anota — é assim que sabor novo nasce por aqui."* com botão de sugerir, e dois sabores de hoje logo abaixo. Busca frustrada vira pedido de produto.

**Adoce Hoje** — calda aparece **depois** da primeira fatia e é **por fatia, numerada**. "Sem calda" fica na mesma linha das outras, como escolha legítima. O presente entra como linha em caramelo e **não mexe no total**.
Rodapé fixo: total, botão, e *"Você paga na retirada. Nada é cobrado agora."*

**Promoções do dia** — oferta de fim de dia, com o motivo escrito: *"existe para nada ser desperdiçado"*. E **"Carimbo do Clube conta normalmente"** — se promoção tirasse carimbo, o Clube viraria pegadinha.

**Cardápio da semana** — hoje aberto com botão de reservar; os outros dias em pílulas com "Me avisa". É pré-venda.

**Docinhos** — 25 em 25, composição visível ("1 pacote de 100 + 1 de 25"), sabores extras **desabilitados** ao chegar no limite, com a saída explicada: *"Aumente a quantidade para escolher mais."* Preço por unidade em cada pacote.

**Carrinho** e **Encomendas** — três tamanhos com preço fixo, galeria por tamanho, e **termina no WhatsApp**: *"A Beth confirma o valor final com você."* **Sem montador de torta.**

---

## 2. Reserva

**Finalizar** — nome, WhatsApp, observação. Só. *"Sem cadastro e sem cartão."*

**Confirmação** — número grande (`#A-2718`), retirada, e **"Falar com a Adoce" como botão principal**. O cliente vive no WhatsApp; o site entrega ele lá em vez de tentar segurá-lo.

**Acompanhar** — linha do tempo com o passo atual em caramelo.

---

## 3. Identidade — é aqui que morre o loop

**Uma porta só: o WhatsApp.** Sem senha, sem e-mail, sem código por e-mail.

**Não existe tela de "cadastro".** Sob o botão: *"Primeira vez? A gente cria seu cartão na hora. Já é de casa? Ele aparece do jeito que estava."*

**Reconhecido** — quando o site sabe quem é, ele **cumprimenta** ("Oi de novo, Juliana. Seu cartão está com 7 de 14") e **nunca** oferece cadastro. É o `decidirPorta()` em forma de tela.

**Link expirado** — aparece em 6 fluxos. Explica sem culpar, garante que *"nada do seu cartão se perdeu"*, e dá três saídas.

---

## 4. Clube

**Cartão** — carimbos em **5 colunas** (14 numa fileira viram pontinhos no celular), bolinhas de brigadeiro, e o presente fechando a grade em caramelo pontilhado. Histórico das últimas fatias abaixo.

**Presente liberado** — a única tela do site em **caramelo cheio**. É comemoração, não transação. *"É por nossa conta"*, nunca "R$ 16,00 de desconto".

**QR do cartão** — código curto legível (`JS-4172`) para quando a câmera falhar, e o brilho da tela sobe sozinho.

**Movimentações** — extrato fatia a fatia, com o carimbo de indicação marcado em caramelo.

**Compartilhar cartão** — link de 2 horas, mostra só nome e carimbos, **telefone não aparece**.

**Indicação** — convite já escrito, quem veio, e a recompensa é **carimbo, não desconto**. Sem limite de pessoas.

**Landing do Clube** — o título é a oferta, não o nome: *"A 15ª fatia é por nossa conta."* E *"Nada de ponto que expira. Carimbo é carimbo."*

---

## 5. As que ninguém lembra e custam cliente

**404** — *"Essa página não existe. Mas doce a gente tem."* Três saídas.

**Sem internet** — *"Não é o site que quebrou — é o sinal."* Mostra o cartão salvo no celular e lembra que *"o WhatsApp costuma funcionar mesmo quando o dado acaba"*.

**Abertura** — hoje é tela branca. Logo, nome em Playfair e a assinatura, enquanto o app carrega.

**Instalar** — *"Não ocupa espaço como um aplicativo comum."*

**Minha conta · Segurança · Ajuda · Fale com a Adoce · Legais** — nas legais o tom muda de propósito: texto grande, linha alta, português de gente. "Como a gente combina" no lugar de juridiquês.

⚠️ **Confirme com o Rubens antes de publicar as legais:** cancelamento acima de 48h devolve tudo e abaixo devolve metade; 2 dias para torta e 7 para festa; alérgenos leite, ovos, glúten e castanhas. Está escrito como promessa pública.

---

## Verificação

```bash
git grep -l "CatalogoDeSabores\|CompartilheDocura\|PedeJuntoPagamento" -- src
```

Cada um tem que listar uma tela ou o `App.tsx`.

E no celular: entrar no Clube com quem tem carimbos **sem** ver cadastro; `#docinhos` de 25 em 25; `#sabores` com foto grande, ampliação e saída; digitar endereço errado e cair no 404 com botões.

---

## O que NÃO fazer

- Não usar carrossel em lugar nenhum
- Não pôr a logo sobre foto
- Não transformar presente em desconto
- Não pedir e-mail nem senha em nenhuma tela de entrada
- Não deixar tela sem saída — foi a reclamação nº 1 do Rubens
