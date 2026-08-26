# Fotos preparadas para o site
**10/08/2026** · Origem: `D:\Adoce Imagens` · Saída: `D:\Clube Adoce\fotos-para-o-site`

**54 imagens, 108 arquivos, 23 MB** — contra 394 MB dos originais.

Cada foto em dois tamanhos, WebP:

| | Uso |
|---|---|
| `nome.webp` — 1200×1200 | tela cheia, detalhe do produto |
| `nome-mini.webp` — 600×600 | lista, cartão, miniatura |

---

## O tratamento aplicado

Ajuste **suave**, aprovado pelo Rubens depois de comparar com uma versão mais forte:

- **equilíbrio de cor** medido do próprio arquivo, com correção limitada a 4% por canal — tira a dominância de ambiente sem inventar cor
- **brilho +3%, contraste +5%, saturação +6%**
- **nitidez por máscara** (raio 1,6 · 70%), que realça textura sem serrilhar
- **recorte quadrado** centrado, puxado 35% para cima — o produto quase sempre fica acima do centro geométrico

A régua foi: o bolo tem que continuar parecendo bolo de verdade. Foto tratada demais levanta suspeita de que mente.

**Exceções de enquadramento:**

| Foto | O que foi feito |
|---|---|
| `torta-trufado-de-ninho` | corte 22% mais fechado — era a única em bancada de granito, e o corte tirou quase todo o fundo de cozinha |
| Pede Junto e Cantinho | corte 10 a 15% mais fechado, por serem fotos de celular com muito ambiente |

---

## O que foi preparado

| Grupo | Quantas | Prefixo |
|---|---|---|
| Fatias | 23 | `fatia-` |
| Tortas inteiras | 14 | `torta-` |
| Tabuleiro de doces | 4 | `tabuleiro-` |
| Docinhos | 6 | `docinhos-` |
| Pede Junto | 4 | `pede-junto-` |
| Cantinho da Adoce | 3 | `cantinho-` |

Havendo mais de uma foto do mesmo sabor, a marcada como **FOTO PRINCIPAL** foi a escolhida.

---

## Para os 12 produtos de encomenda sem foto

| Produto | Sugestão |
|---|---|
| Torta P · R$ 115 | `torta-trufado-de-ninho` |
| Torta M · R$ 155 | `torta-chocolatudo` |
| Torta G · R$ 195 | `torta-ferrero-rocher` |
| Tabuleiro 100 colheres · R$ 320 | `tabuleiro-01` |
| Tabuleiro 200 colheres · R$ 420 | `tabuleiro-02` |
| Tabuleiro 500 colheres · R$ 550 | `tabuleiro-03` |
| Docinhos tradicionais | `docinhos-01` |
| Docinhos especiais | `docinhos-02` |

⚠️ **P, M e G são tamanhos, não sabores.** Escolhi três fotos diferentes só para não repetir. **A escolha é do Rubens.**

---

## Precisa da sua atenção

**Foto nova sem nome.** Chegou em 09/08 — bolo de chocolate com trufas e bombons listrados, sobre prato branco. Está como `torta-whatsapp-image-2026-08-09-at-14-32-58`. **Qual é o sabor?**

**Nomes de arquivo com erro de digitação**, que viraram nomes de imagem:

| Arquivo | Provável correto |
|---|---|
| `BLACKVELVER FOTO PRINCIPAL` | Black Velvet |
| `SUPRESA DE UVA` | Surpresa de Uva — e existe outra grafada certo, então há **duas fotos do mesmo sabor** |
| `Kider Bueno` | Kinder Bueno |
| `CASADINHO (DOIS AMORES)` | no banco o sabor se chama **Dois Amores** |

Não renomeei nada: nome errado é fácil de corrigir, foto trocada não.

**Ainda sem foto nenhuma:**

| Segmento | Situação |
|---|---|
| **Adoce na Escola** — 4 produtos, R$ 390 a R$ 950 | pasta `Festa na escola` **vazia** |
| **Decoração** — Kit Comemore e Pegue e Monte | não há pasta |

São 6 produtos, incluindo o mais caro do catálogo — **Pacote Recreio Completo, R$ 950.** Vender esse valor sem imagem é muito difícil.

---

## Como subir

**Eu não subo para o Storage.** Escrita lá é sua ou do Codex, e vale conferir antes se cada foto está no produto certo.

Caminho sugerido, seguindo o que já existe:

```
produtos/<id-do-produto>/<nome>.webp
```

⚠️ **Não suba pelo editor do site.** Ele guarda o arquivo bruto de cada imagem — são 215 originais ocupando 436 MB hoje, e as fotos novas fariam o Storage crescer do mesmo jeito. Estes arquivos já estão otimizados e não precisam de original.
