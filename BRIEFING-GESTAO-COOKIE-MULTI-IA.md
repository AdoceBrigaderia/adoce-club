# Gestão Cookie — briefing de arquitetura
**Para: as três IAs convidadas · 12/08/2026**

---

## Como este trabalho será avaliado

**Três IAs receberam este mesmo briefing, separadamente.** Cada uma entrega uma proposta completa e independente.

As três serão lidas lado a lado. **Não vamos escolher uma e descartar as outras** — vamos tirar o melhor de cada e montar uma quarta, que é a que vai para o código.

O que isso significa para você:

- **Discorde do briefing onde achar que ele está errado.** Uma proposta que só concorda não acrescenta nada à comparação. Se você acha que alguma premissa abaixo é ruim, diga, com o motivo.
- **Justifique cada escolha.** Uma decisão sem justificativa não pode ser comparada com a alternativa — e vai ser descartada na fusão.
- **Diga o que você não sabe.** Onde faltar informação para decidir, aponte a pergunta em vez de inventar resposta.
- **Não escreva código.** Esta fase é de arquitetura. Código só depois da fusão aprovada.

Siga o **formato de entrega** do fim deste documento. Propostas que respondem coisas diferentes não podem ser comparadas.

---

# 1. O que é o projeto

**Gestão Cookie** é um SaaS comercial para confeitarias: vitrine de venda para o cliente final e operação diária para a dona do negócio.

Nasce em `D:\TOPOINT\gestao-cookie`, repositório novo, sem herdar nada do código atual.

Substituirá o portal `adocebrigaderia.com.br`, hoje em Netlify + Supabase — **mas só quando estiver 100% aprovado em homologação.** Sem apagão.

## Quem é quem

| Camada | O que é |
|---|---|
| **TOPOINT** | a fábrica de software. Dona do produto. |
| **Gestão Cookie** | o produto vendido por assinatura. |
| **Adoce Brigaderia** | tenant nº 1. Confeitaria real, em operação, em Fortaleza. |
| **Cliente final** | quem compra torta da Adoce. |

**Essa separação é a decisão mais fácil de errar.** Ver o item 6.

---

# 2. As três regras de ouro

### 2.1 Multi-tenant desde o dia 1
O banco nasce multi-tenant, feito certo. Retrofitar isso depois é inviável.

### 2.2 Mobile first extremo
O celular é a experiência principal. O desktop é secundário. O público real está em **Android de entrada, 4G pré-pago**, e o dado é caro para ele.

### 2.3 Mínimo de cliques
Cadastro, login, compra e operação diária resolvidos no menor número de passos possível.

---

# 3. O contexto real — leia antes de propor

Estas não são hipóteses. É o que acontece hoje na Adoce.

**Por que o portal atual está sendo abandonado:**

- clientes desistem no meio do pedido e mandam no WhatsApp
- clientes reclamam da complexidade do cadastro
- pedidos falham
- a dona evita o painel: *"tem muita informação na tela, é difícil de achar os clientes, toda vez que entro em alguma tela da operação ela abre no meio… acabo deixando pro Rubens que tem mais paciência"*
- cada correção quebra outras coisas

**O que isso ensina, e que a sua proposta precisa levar em conta:**

1. **Cadastro antes da compra é pedágio.** Foi o que mais afastou cliente.
2. **O WhatsApp é o canal real.** No plano pré-pago brasileiro, WhatsApp e Instagram não gastam dado — o site gasta. Para boa parte do público, o site **compete com o WhatsApp em desvantagem**.
3. **Foto é o produto.** Confeitaria vende por imagem. Foto pequena ou lenta é venda perdida.
4. **Se a dona não usa, o sistema não existe.**

**Restrição de negócio, e ela é dura:** a Adoce precisa sair de 28 para 35 tortas por semana em 60 dias, ou fecha. O dono está endividado. Proposta que só começa a gerar valor em seis meses é proposta que chega tarde.

---

# 4. O que responder

## 4.1 Colaboração multi-IA e Git

Três IAs vão trabalhar no mesmo repositório. **Duas IAs editando a mesma pasta ao mesmo tempo se sobrescrevem** — o Git resolve depois, e "depois" é o conflito que ninguém sabe desfazer.

Proponha o fluxo. Responda pelo menos:

- como isolar fisicamente o trabalho de cada IA (worktree? clone? outra coisa?)
- como dividir território: por camada, por feature, por rota?
- o que fazer quando duas precisarem do mesmo arquivo
- convenção de commit e de branch
- como impedir que entre em `main` algo quebrado
- **como provar que uma entrega foi realmente integrada, e não só criada**

Sobre o último ponto — no projeto anterior, arquivos com teste verde nunca foram chamados por tela nenhuma. Pareciam prontos e não estavam. Proponha uma verificação que pegue isso.

## 4.2 Stack

Escolha e justifique: framework, banco, estilo, hospedagem, pagamento.

Considere: os dados estão hoje no Supabase; o público é celular fraco em 4G caro; o produto é foto; e o site precisa ser achável no Google — hoje o portal atual é **uma única página** para o buscador, porque toda navegação é por `#`.

## 4.3 Multi-tenant no banco

Compare as abordagens (banco por tenant, schema por tenant, coluna + RLS) e recomende uma, com prós e contras honestos.

**Trate o isolamento como responsabilidade legal, não só técnica.** Vazamento entre tenants expõe a base de clientes de outras empresas — é incidente de LGPD com o negócio dos outros. Proponha como *provar* o isolamento, não só como implementá-lo.

## 4.4 Migração dos dados

Plano para preservar 100% de clientes e produtos do Supabase atual.

**Atenção especial ao Clube de fidelidade:** 61 pessoas com carimbos acumulados, a cada 14 fatias a 15ª é presente. Cliente que tem 13 carimbos e volta com 0 vai embora para sempre. Proponha como migrar isso de forma auditável.

## 4.5 Jornada do cliente final

Da descoberta ao pedido, com o mínimo de atrito. Diga **quantos toques** cada etapa custa.

## 4.6 Jornada do dono de confeitaria assinando o SaaS

Do primeiro contato até a loja no ar. Também em toques.

## 4.7 Jornada operacional diária

O dia a dia no celular. Qual a tela central e como as tarefas principais são feitas com o mínimo de telas e toques.

## 4.8 SEO local — e como o produto pode automatizá-lo

Confeitaria é negócio de bairro. Quem procura "confeitaria perto de mim" ou "bolo em Fortaleza" está a um dia de comprar — **88% de quem faz busca local no celular visita ou liga em 24 horas.** E 46% de todas as buscas do Google têm intenção local.

O portal atual não aparece em nenhuma delas: toda navegação é por `#`, então o Google enxerga **uma página só** no site inteiro.

**Responda três coisas:**

**a) O que o site precisa ter** para aparecer em busca local: endereços por produto, dados estruturados, sitemap, conteúdo renderizado no servidor. Seja específico.

**b) O Perfil da Empresa no Google.** Em 2026 ele é o fator nº 1 do bloco de mapas, e as AI Overviews do Google respondem "qual a melhor confeitaria aberta agora" usando os dados dele. Ele não depende do site — mas **o produto pode alimentá-lo**.

O algoritmo hoje premia **frescor**: uma loja com 150 avaliações que postou foto hoje ganha de uma com 500 avaliações parada há seis meses.

**A pergunta que interessa:** a Gestão Cookie pode publicar automaticamente no Perfil do Google toda vez que a confeitaria atualizar os sabores do dia? Se puder, isso é diferencial de produto — cada tenant ganha frescor sem trabalho manual. Avalie viabilidade e risco.

**c) SEO local multiplicado por tenant.** Cada confeitaria assinante é um negócio local diferente, em cidade diferente. Como a arquitetura entrega SEO local para **todos os tenants** sem trabalho manual por cliente? Endereço próprio, dados estruturados por loja, sitemap por tenant?

**Contexto honesto:** SEO leva meses. Não vai salvar os 60 dias da Adoce. Diga o que dá resultado em semanas e o que só rende no médio prazo — e não misture os dois.

## 4.9 Estrutura de pastas

Como organizar `D:\TOPOINT\gestao-cookie` para a stack escolhida e para trabalho multi-IA.

---

# 5. Sequência — e onde eu quero sua opinião

A minha proposta é:

1. arquitetura multi-tenant desde o dia 1
2. **um tenant só (Adoce) até ela estar vendendo bem**
3. a tela de "criar minha loja" construída, mas guardada até lá
4. primeiro corte: **vitrine + pedido + operação do dia**
5. Clube, Pede Junto, encomendas e financeiro na segunda rodada

**Discorde se achar errado.** Especialmente sobre o item 4 — o portal anterior morreu porque construiu 63 telas e entregou zero. Qual é o menor corte que já vende?

---

# 6. As três marcas — não misture

Este é o ponto que mais se erra.

## 6.1 TOPOINT — a fábrica

Aparece na institucional e na assinatura do produto ("por TOPOINT").

| Cor | Hex |
|---|---|
| Azul marinho | `#0B1D3A` |
| Azul cobalto | `#1565FF` |
| Cinza ardósia | `#64748B` |
| Branco off | `#F7F8FA` |
| Branco | `#FFFFFF` |

**Sora Bold** nos títulos · **Inter Regular** no texto
Valores: Precisão · Entrega · Crescimento · Confiança · Escalabilidade
*"Tecnologia que entrega. Resultados que escalam."*

## 6.2 Gestão Cookie — o painel da operação

É onde a dona da confeitaria trabalha. **Precisa ser neutro.** A Confeitaria da Márcia não vai operar num sistema com a cara da concorrente.

**Recomendação a debater:** o painel herda a linguagem da TOPOINT — azuis, Sora, Inter. Sóbrio, legível, sem personalidade de marca de doce.

Se você discordar e achar que Gestão Cookie precisa de identidade própria, diga por quê.

## 6.3 Adoce Brigaderia — o tenant

Aparece **só na vitrine que o cliente final vê**. Nunca no painel.

| Cor | Hex |
|---|---|
| Rosa creme | `#FBE3DD` |
| Rosa cupcake | `#E89A91` |
| Marrom chocolate | `#3B1F12` |
| Caramelo | `#E8AD67` |
| Branco quente | `#FFF9F6` |

**Playfair Display Bold** na voz · **Inter** no resto
Valores: Afeto · Capricho · Sabor · Cuidado · Celebração
*"Doce feito com afeto, para celebrar cada momento."*

Regras do manual que viram regra de código: nunca a logo sobre fundo poluído; nunca alterar as cores; preservar a área de respiro.

## 6.4 O sistema de temas

Cada tenant terá a própria marca. Proponha **o que o tenant pode mudar e o que é fixo do produto**.

Ponto de partida a debater: o tenant escolhe logo e duas cores; espaçamento, tamanho de alvo de toque, hierarquia e ritmo são fixos. Assim cada loja parece dela e nenhuma consegue quebrar a usabilidade.

---

# 7. Formato da entrega

Para que as três propostas sejam comparáveis, entregue **nesta ordem**, com estes títulos:

```
0.  Onde eu discordo do briefing        ← comece por aqui
1.  Colaboração multi-IA e Git
2.  Stack, com justificativa por item
3.  Multi-tenant: abordagem e prova de isolamento
4.  Migração dos dados
5.  Jornada do cliente final (em toques)
6.  Jornada de quem assina o SaaS (em toques)
7.  Jornada operacional diária (em toques)
8.  Sistema de temas por tenant
9.  SEO local, e como o produto o automatiza por tenant
10. Estrutura de pastas
11. Menor corte que já vende, e por quê
12. Riscos: o que pode dar errado nesta proposta
13. O que eu precisaria saber e não sei
```

**O item 0 é obrigatório.** Proposta sem discordância será tratada como proposta sem opinião.

**O item 12 também.** Toda arquitetura tem um ponto fraco; quem não aponta o seu está escondendo ou não enxergou.

**Não escreva código.** Nem exemplo, nem esqueleto, nem migração. Só arquitetura e decisão.
