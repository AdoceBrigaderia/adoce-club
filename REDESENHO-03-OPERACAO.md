# Bloco 3 — a operação
**Depois do bloco 2.** 24 telas. Cole tudo abaixo da linha.

---

## O que esta reforma resolve

A Beth disse, com todas as letras:

> "Tem muita informação na tela, é difícil de achar os clientes, toda vez que entro em alguma tela da operação ela abre no meio… acabo deixando pro Rubens que tem mais paciência."

Operação que a dona do negócio evita não é operação. Três correções, e todas as telas obedecem:

1. **Busca de cliente no topo**, sempre visível, dentro do cabeçalho
2. **Toda tela abre no topo** — e o topo é o que pede ação agora
3. **O que não é de agora vai para gaveta**, com o número do lado para ela saber se precisa abrir

---

## 1. Painel do dia — a porta única

Substitui `OperationDashboard` e `InstantOrderPanel` como entrada.

- busca de cliente no cabeçalho
- **"3 pedidos esperando você"** em caramelo, com a hora do mais antigo. Não é notificação: é dívida visível. Foi o que teria salvado a Juliana.
- cada pedido com nome, itens e três botões grandes: **confirmar, imprimir, chamar no zap**
- o dia até agora: fatias vendidas e quanto entrou
- gavetas: Estoque · Clientes · Encomendas · Pede Junto · Ajustes
- no fim, sozinho: **Atender no balcão**

---

## 2. Balcão

**Quem tem presente flutua para o topo, em caramelo.** Ela não precisa lembrar nem procurar.

Ficha do cliente: mesma grade de 5 colunas do cartão do cliente — se a pessoa mostrar o celular, as duas veem a mesma coisa.

Contador com botões de 52px e número em 40px: ela toca de pé, com a mão ocupada. O botão diz **"Carimbar 2 fatias"**, não "Confirmar".

E o aviso que faz ela usar o sistema em vez do papel: *"Carimbou errado? Dá para desfazer nos próximos 10 minutos."*

**Entrada por QR também** — leitor de câmera e campo para o código curto, porque câmera falha.

---

## 3. Venda manual — a tela dos 80%

O Rubens: *"hoje a proporção é algo como 20% e 80% digital/presencial"*. Esta é a tela dos 80%, e o inimigo é o tempo.

Cabe em **quatro toques**: sabor, calda, pagamento, concluir.

- sabores em grade de dois, alvo grande, com o que resta em cada um
- calda vale para todas as fatias por padrão; separar é exceção
- cliente é opcional, mas quando identificado **o carimbo entra sozinho** — "7 de 14 · vai para 9 com esta venda"
- formas de pagamento em quatro botões
- o botão final diz o que acontece: *"Baixa o estoque e carimba o Clube da Juliana."*

---

## 4. Esteira e ficha térmica

**Esteira** é a única tela feita para ser lida de longe: dois de largura no tablet, número em 26px, **quantidade na frente do sabor** ("**1** Trufado de Ninho"), botão de 52px. Wake Lock ligado — *"tela sempre acesa"*. Tablet que dorme no sábado é o mesmo que não ter tablet.

**Ficha térmica** mostra as 32 colunas antes de gastar papel. Os dois problemas já estão resolvidos em `impressora-termica.ts`: página de código portuguesa (senão "Ração" imprime "RaÃ§Ã£o") e quebra por palavra (senão a linha some no corte lateral).

---

## 5. Estoque do dia — conserta o bug que o Rubens viu

> "Quando eu zero o estoque manualmente ainda fica com status de disponível"

Três separações que o sistema não fazia:

- **"Acabou hoje"** — seção própria, com botão **Repor**
- **"Não foi feito hoje"** — os 23 restantes continuam na vitrine como *"avisamos quando sair"*, visíveis mas **impossíveis de reservar**
- **o botão "Acabou" é separado do contador** — zerar é contagem, "acabou" é decisão

E **"Fechar a vitrine do dia"** com a promessa embaixo: *reservas já feitas continuam valendo*. É isso que faz ela apertar sem medo às 20h.

---

## 6. As telas que vendem

**Clientes** não é lista, é **fila de vendas paradas**:
- **"Perto do presente"** no topo — Rita a 3 fatias, Paulo a 2. A venda mais barata que existe.
- **"Sumiram há 30 dias" com o sabor que a pessoa amava** — "Camila · amava Prestígio" vira mensagem que funciona
- **"Avisar quem gosta do sabor"** — Ninho sai amanhã, 19 pessoas já levaram

**Quem está esperando** — 38 pessoas tocaram em "Me avisa". Agrupa por sabor, cruza com o cardápio, e aponta produção: *"8 pessoas esperam Surpresa de Uva e ele não tem data."*

**Relacionamento** — o número que salta: **12 pessoas são 7% dos clientes e 31% do que entra**. E 98 vieram uma vez só.

⚠️ **Envio um a um, nunca em massa.** WhatsApp bloqueia número que dispara. O botão **prepara** as mensagens para a Beth mandar.

---

## 7. Encomendas da semana

No topo, o número que decide o negócio: **29 de 35, faltam 6**, em barra de caramelo. Todo dia, não uma vez por semana.

Agenda **por dia**, porque a Beth produz por dia. E o limite honesto: *"Sábado está cheio — 9 de 10. A próxima encomenda de sábado vai avisar que a agenda está no limite."* Isso protege ela de aceitar o que não entrega.

**"Anotar encomenda"** para o que chega pelo WhatsApp — que são 80%.

---

## 8. Pede Junto na operação

**Confere o estoque antes de deixar separar:** *"3x Trufado de Ninho — só tem 2 na bancada"*, em caramelo. Ela vê o problema **antes** de gerar os links.

O botão diz o que faz: **"Separei tudo · liberar pagamento"**, e embaixo a razão da coisa toda: *"Cada pessoa recebe o próprio link. A Juliana não precisa cobrar ninguém."*

E: *"Dá para entregar mesmo com pagamento pendente. Você decide."* O sistema não pode travar entrega porque um amigo demorou.

---

## 9. Financeiro

**O "sobrou" vem com aviso, não com confiança falsa:** *"3 encomendas desta semana ainda estão sem custo."* Número de lucro que ignora custo não lançado faz decidir errado.

**Balcão vs site em porcentagem** — 82% e 18%. É o placar do que o Rubens está tentando virar.

E separado no rodapé: *"Isto é o caixa da Adoce. Seu planejamento pessoal fica em outro lugar."* As tabelas `fin_*` não se misturam com a operação, nem na tela nem na cabeça.

---

## 10. O resto da operação

**Central de avisos** — mostra **o que falhou**, com motivo e botão de reenviar. Existe porque pedidos entraram e nada chegou no Telegram.

**Arquivo** — o filtro que mais importa é **"Não retirados"**: *"3 pessoas não retiraram este mês. Quase sempre é esquecimento, não desistência."*

**Feedback** — crítica na frente com botão de responder, agrupamento por assunto ("espera · 6" é problema com número), e **"Usar um elogio no Instagram"**.

**Ajustes** — horário de retirada sai daqui e muda no site; "mandar aviso de teste"; impressora com a limitação escrita (*"no iPhone não dá — o Safari não fala Bluetooth"*); "7 sem foto" em caramelo. **As cores aparecem mas não são editáveis** — mudar uma quebra a identidade em 68 telas.

**Cardápio · Fotos · Caldas · Equipe · Solicitações · Documentação** — conforme desenhado. Em Caldas, **"Sem calda" tem cadeado**: é escolha legítima, não ausência. Em Equipe, os papéis já existem para quando entrar ajuda: Atendente não vê financeiro, Produção não vê cliente nem dinheiro.

---

## Verificação

```bash
git grep -l "PainelDoDia\|BalcaoAtendimento\|OperationManualSale\|PedidoNaEsteira" -- src
```

E no celular da Beth: toda tela abre no topo; busca de cliente visível sem rolar; carimbar e desfazer; zerar um sabor e confirmar que **some da vitrine do cliente**.

---

## O que NÃO fazer

- Não deixar tela abrindo no meio
- Não esconder a busca de cliente
- Não disparar mensagem em massa pelo WhatsApp
- Não misturar `fin_*` com o caixa da Adoce
- Não deixar o financeiro dizer "sobrou" sem avisar do custo faltando
