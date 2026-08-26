# Redesenho da Adoce — índice dos blocos
**11/08/2026**

64 telas desenhadas em seis revisões. Este índice diz o que existe, em que ordem construir, e por quê nessa ordem.

---

## A regra que vale para tudo

Cor, fonte e medida nascem em `src/adoce-tokens.css`. **Nenhum arquivo novo declara hex próprio.**

**Cores — as cinco do manual da marca, literais:**

| Nome | Hex | Papel |
|---|---|---|
| Rosa creme | `#FBE3DD` | campo, fundo de aviso |
| Rosa cupcake | `#E89A91` | a cor da marca, moldura, destaque |
| Marrom chocolate | `#3B1F12` | texto, superfície escura, **ação** |
| Caramelo | `#E8AD67` | urgência, presente, o que aponta |
| Branco quente | `#FFF9F6` | papel |

**Chocolate age, rosa acolhe, caramelo aponta.**

**Fonte:** `Playfair Display Bold` na voz da marca (títulos, nome de sabor, números grandes) e `Inter` no resto. Carregadas uma única vez em `styles.css`.

**Assinatura:** *"Doce feito com afeto, para celebrar cada momento."* em Playfair itálico, fechando toda página do cliente.

**Regras do manual que são proibições:**
- nunca a logo sobre fundo poluído (por isso capa é chocolate liso, nunca foto atrás)
- nunca alterar as cores
- preservar a área de respiro da logo

**Mobile primeiro.** Alvo mínimo de 44px. Campo de texto nunca abaixo de 16px, senão o iPhone dá zoom sozinho.

---

## Ordem dos blocos

| Bloco | O que faz | Por que agora |
|---|---|---|
| **1** | Ligar o que já existe · subir produção | Cinco dias de trabalho parados entre "pronto" e "no ar". Produção está em 31/07. |
| **2** | Vitrine, Clube, venda e reserva | É o que o cliente vê. Onde a venda acontece. |
| **3** | Operação | Resolve as três queixas da Beth e o bug de estoque. |
| **4** | Meta, Mercado Pago, carteira | Depende de credencial que o Rubens ainda precisa providenciar. |
| **5** | Busca do Google | Só dá resultado em meses. Último de propósito. |

---

## As 64 telas

**Cliente (34)** — Abertura · Home · Nossos sabores · Busca de sabor · Adoce Hoje · Promoções do dia · Cardápio da semana · Finalizar reserva · Confirmação · Acompanhar pedido · Carrinho · Encomendas · Docinhos · Festas/Escola/Decoração · Catálogo comercial · Orçamento · Pede Junto (grupo, pagamento, minichat) · Entrar · Código · Já reconhecido · Landing do Clube · Cartão do Clube · Presente liberado · QR do cartão · Compartilhar cartão · Carteira do celular · Movimentações · Minha conta · Segurança · Instalar · Ajuda · Fale com a Adoce · Legais (3) · Link expirado · Sem internet · 404 · Aviso de fatia · Indicação

**Operação (24)** — Painel do dia · Balcão · Ficha do cliente · Venda manual · Esteira · Ficha térmica · Estoque do dia · Encomendas da semana · Agenda de produção · Clientes · Relacionamento · Pede Junto · Central de avisos · Quem está esperando · Arquivo · Feedback · Financeiro · Catálogo Meta · Solicitações · Ajustes · Cardápio da semana · Fotos · Caldas · Equipe · Documentação

---

## O que NÃO fazer, em nenhum bloco

- Não declarar hex fora de `adoce-tokens.css`
- Não usar carrossel — o Rubens relatou falha grave, e no celular ele esconde o que vende
- Não construir montador de torta: **não se vende o que não tem custo apurado**
- Não transformar a fatia-presente em desconto. Presente é presente.
- Não afrouxar RLS nem conceder grant novo a `anon` ou `authenticated`
- Não gerar link de pagamento antes de a operação confirmar que separou
- Não dizer que está pronto sem a saída dos `git grep` de cada bloco
