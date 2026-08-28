# Projeto: transformar o Planejamento Financeiro em produto

Documento de decisão. Nada aqui foi construído em produção nem gerou custo — a homologação está de pé dentro do projeto Supabase que você já paga.

---

## 1. O que você já tem

Não estamos começando do zero, e isso muda bastante a conta.

O que está funcionando hoje, validado:

- Motor de recorrência que não erra data. Semanal, quinzenal, mensal por dia do mês, mensal por posição da semana ("última sexta"), a cada N meses, anual. Com prazo, sem prazo ou até uma data. Datas nunca vazam para o mês seguinte e fim de semana vira dia útil. O mesmo cálculo roda no navegador e no banco, com resultado idêntico — conferi hash a hash.
- Visão por semana, mês e ano, com navegação de período e saldo acumulado.
- Contas a vencer, atrasadas em destaque, quitação em massa.
- Isolamento por RLS testado com usuário real: quem não é membro vê zero.

Isso é o núcleo difícil de um produto financeiro. A parte que quebra a confiança do cliente — data errada de boleto — já está resolvida.

**O que falta para virar produto** não é a tela. É tudo que existe em volta dela: cadastro, cobrança, suporte, e a decisão de para quem você vende.

---

## 2. A homologação já está pronta (custo zero)

Criei o banco do produto genérico como tabelas `app_*` no projeto que você já tem. Elas não conversam com as tabelas da operação da Adoce nem com as `fin_*` do seu financeiro pessoal.

| Tabela | Para que serve |
|---|---|
| `app_accounts` | A conta que assina. Guarda cor da marca, logo, moeda, início da semana, regra de ajuste de data, plano e status da assinatura. |
| `app_members` | Quem tem acesso a cada conta, com papel: dono, admin, editor ou leitor. |
| `app_invites` | Convite por e-mail com token e validade. |
| `app_centers` | Substitui o "Empresa/Pessoal" fixo. Cada cliente nomeia como quiser. |
| `app_categories` | Categorias por conta, com cor e ordem. |
| `app_series` | Configuração da recorrência. |
| `app_entries` | Os lançamentos. |
| `app_subscriptions` | Histórico de cobrança, pronto para plugar gateway. |

Testei com duas contas fictícias e donos diferentes: o dono da "Padaria" vê um lançamento, o do "Salão" vê outro, e nenhum dos dois enxerga nada do outro nem do seu financeiro. A função `app_create_account()` já cria conta, dono, centros e categorias padrão numa chamada só.

Se você aprovar o produto, esse desenho migra para um projeto dedicado sem reescrever nada.

---

## 3. As três decisões que travam tudo o mais

Não dá para eu escolher por você, porque cada uma muda o produto inteiro.

### 3.1 Para quem você vende

| Público | A favor | Contra |
|---|---|---|
| **Pequeno negócio / MEI** | É a sua dor. Você viveu misturar conta da empresa com a de casa, empréstimo consignado, funcionário, fluxo semanal. Isso não se pesquisa, se viveu. Paga mais e cancela menos. | Mercado menor. Venda mais lenta, exige conversa. |
| Pessoa física / família | Mercado grande. | Concorrência pesada e cliente que paga pouco e cancela rápido. |
| Contador | Ticket alto, um cliente traz dezenas de empresas. | Exige visão multi-empresa, exportação contábil e uma barra de qualidade bem mais alta desde o dia um. |

Minha leitura: **o MEI que mistura o dinheiro da empresa com o de casa é onde você tem vantagem injusta.** O app já nasceu com "centro financeiro" separando Empresa e Pessoal porque essa era a sua necessidade real. Nenhum concorrente grande trata isso bem, porque eles assumem que a pessoa separa as contas — e ela não separa.

### 3.2 O que "personalizar individualmente" quer dizer

Existem quatro níveis, do mais barato ao mais caro:

1. **Dados próprios** — categorias, centros, saldo inicial, início da semana, regra de ajuste de data. *Já está pronto no banco.*
2. **Vários usuários por conta** — convidar sócio, esposa, funcionário, cada um com permissão diferente. *Estrutura pronta, falta a tela de convite.*
3. **Marca do cliente** — logo e cor dele no sistema. *Campos prontos, falta aplicar no visual.*
4. **Campos e relatórios que o cliente monta** — poderoso e caro. Complica a tela e costuma ser usado por menos de 5% dos clientes.

Sugiro entregar 1, 2 e 3 e **deixar o 4 de fora**, pelo menos até alguém pedir pagando.

### 3.3 Como você cobra

Cobrança automática é o que separa um produto de um favor. Sem ela, você vira cobrador e o negócio para de crescer no dia em que você ficar doente.

Existem três caminhos no Brasil — Mercado Pago, Asaas e Stripe. As taxas e regras mudam com frequência, então **não vou afirmar números aqui sem conferir na fonte**. Quando você decidir avançar, eu pesquiso as condições atuais das três e te apresento a comparação com taxa de Pix, de cartão, prazo de repasse e esforço de integração.

---

## 4. Fases de construção

Cada fase entrega algo que funciona sozinho. Você pode parar em qualquer uma.

### Fase 1 — Multi-cliente de verdade
Cadastro próprio, criação de conta, convite de usuário, troca de conta, aplicação da marca do cliente. O app deixa de ser "seu" e passa a ser "de quem entrar".

**Resultado:** você consegue colocar 5 conhecidos usando de graça e ouvir a verdade.

### Fase 2 — Cobrança e ciclo de vida
Teste grátis com prazo, assinatura, bloqueio suave de quem não pagou (mantém leitura, corta escrita), tela de plano, recibo. Recuperação de senha e e-mails do sistema.

**Resultado:** o dinheiro entra sem você tocar.

### Fase 3 — O que faz o cliente ficar
Importação de extrato ou planilha, relatório em PDF, lembrete de conta a vencer no WhatsApp ou e-mail, app instalável no celular.

**Resultado:** cai o cancelamento. Cliente que importou o histórico dele não vai embora.

### Fase 4 — Escala
Projeto Supabase dedicado, backup automático, painel para você ver as contas e o faturamento, política de privacidade e termos de uso.

**Resultado:** dá para crescer sem medo.

Ordem importa. **Não construa a Fase 3 antes de alguém pagar pela Fase 2.** O erro clássico é caprichar no produto para um cliente que nunca existiu.

---

## 5. Custos reais

| Item | Custo | Quando |
|---|---|---|
| Supabase Pro | Já pago pela Adoce | Hoje |
| Projeto Supabase dedicado | **US$ 10/mês** | Só na Fase 4, ou antes se você quiser separar já |
| Branch de homologação | ~US$ 0,013/hora (~US$ 9,70/mês se ficar ligado) | Alternativa ao projeto dedicado |
| Netlify | Gratuito no começo | — |
| Domínio próprio | ~R$ 40 a 60 por ano | Fase 1 |
| E-mail do sistema | Faixa gratuita atende o início | Fase 2 |
| Gateway de pagamento | Percentual por venda | Fase 2 |

**Enquanto você não aprovar, o custo é zero.** A homologação mora no projeto que já existe.

Quando o produto estiver de pé, o custo fixo fica na casa de poucas dezenas de reais por mês. Com uma mensalidade na faixa de R$ 30 a 50, **três ou quatro clientes pagantes já cobrem a infraestrutura inteira.** O que custa não é o servidor — é o seu tempo.

---

## 6. Riscos que eu não vou esconder de você

**O mercado é concorrido.** Organizze, Mobills, Conta Azul, Granatum e vários outros já existem, com time e verba de marketing. Você não ganha deles no volume de funcionalidades. Ganha em ser específico para uma dor que eles tratam mal.

**Suporte consome mais tempo que código.** Dez clientes pagantes geram perguntas quase todo dia. Isso concorre direto com a Adoce. Vale pensar quanto do seu tempo cabe aqui.

**Dado financeiro não admite erro.** Uma data errada, um saldo que não bate, e o cliente vai embora e conta para os outros. Por isso investi tanto no motor de datas antes de qualquer coisa.

**Existe obrigação legal.** LGPD, termos de uso, política de privacidade, e um caminho claro para o cliente exportar e apagar os dados dele. Não é opcional a partir do primeiro cliente pagante. Eu não sou advogado e isso não é orientação jurídica — vale conversar com um profissional antes de vender.

**O ponto honesto:** o produto não precisa dar certo para ter valido a pena. Você já tem uma ferramenta que resolve o seu problema e o da Beth, funcionando e online, a custo zero. Tudo daqui para frente é ganho.

---

## 7. O que eu sugiro como próximo passo

Antes de escrever mais uma linha de código, **coloque de 3 a 5 pessoas usando a versão atual.** Donos de pequeno negócio que você conhece. De graça, sem promessa.

Você descobre em duas semanas o que dois meses de programação não contam:

- Eles entendem a diferença entre Previsto e Realizado sem você explicar?
- Usam a visão semanal, ou vão direto no mês?
- O que eles pedem primeiro?
- Alguém pergunta quanto custa?

Se ninguém perguntar o preço, o produto ainda não está pronto — e aí a gente ajusta com informação, não com palpite.

Enquanto isso eu deixo a homologação parada, sem custo, esperando sua decisão.

---

## 8. Onde estão as coisas

- **App no ar:** https://planejamento-financeiro-rb.netlify.app
- **Código:** `D:\Clube Adoce\planejamento-financeiro\index.html`
- **Banco pessoal:** tabelas `fin_*` no projeto Clube Adoce
- **Homologação do produto:** tabelas `app_*` no mesmo projeto, isoladas e sem custo
