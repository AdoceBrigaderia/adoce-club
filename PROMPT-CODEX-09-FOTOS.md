# Prompt 9 para o Codex — subir as fotos do catálogo
**10/08/2026** · Cole tudo abaixo da linha.

---

O Rubens autorizou subir as fotos que já estão prontas.

**Origem:** `D:\Clube Adoce\fotos-para-o-site` — 54 imagens, 108 arquivos, 23 MB.
Cada uma em dois tamanhos: `nome.webp` (1200×1200) e `nome-mini.webp` (600×600).

O detalhe completo do tratamento e as pendências estão em `FOTOS-PARA-O-SITE.md`.

---

## 1. Regra que não pode ser quebrada

⚠️ **Não suba pelo editor de imagens do site.** Ele guarda o arquivo bruto de cada imagem — hoje são **215 originais ocupando 436 MB** de um bucket com 480 MB, e o limite do plano é 1 GB.

Estes arquivos **já estão otimizados e não precisam de original**. Suba direto para o Storage, sem passar pelo editor, e sem gravar nada em `original_image_url` / `original_image_path`.

---

## 2. O que ligar em `commercial_products`

12 dos 15 produtos estão sem foto. Estes oito têm sugestão:

| Produto | Arquivo |
|---|---|
| Torta P · R$ 115 | `torta-trufado-de-ninho` |
| Torta M · R$ 155 | `torta-chocolatudo` |
| Torta G · R$ 195 | `torta-ferrero-rocher` |
| Tabuleiro de doces - 100 colheres | `tabuleiro-01` |
| Tabuleiro de doces - 200 colheres | `tabuleiro-02` |
| Tabuleiro de doces - 500 colheres | `tabuleiro-03` |
| Docinhos tradicionais | `docinhos-01` |
| Docinhos especiais | `docinhos-02` |

⚠️ **P, M e G são tamanhos, não sabores** — a escolha dessas três é palpite meu, não decisão do Rubens. Se ele já tiver dito qual foto vai em cada tamanho, vale o que ele disse.

**Sem foto e sem candidata:** os 4 produtos de Adoce na Escola (R$ 390 a R$ 950) e os 2 de Decoração. Não invente substituto.

---

## 3. Caminho no bucket

Seguindo o que já existe:

```
produtos/<id-do-produto>/<nome>.webp
produtos/<id-do-produto>/<nome>-mini.webp
```

Grave o público em `commercial_products.image_url`. **Deixe `original_image_url` nulo.**

---

## 4. Ordem segura

1. **Homologação primeiro.** Suba, ligue aos produtos e confirme na tela de encomendas que as 8 aparecem.
2. **Só depois produção**, com o Rubens acompanhando.

Confira a contagem do bucket antes e depois em cada ambiente, e me informe.

---

## 5. Fica de fora deste prompt

**As fatias já têm foto no banco** — todas as 26 têm `image_path`, e 12 têm `whole_cake_image_path`. Não sobrescreva nenhuma. As fotos de fatia preparadas servem para eventual substituição futura, com decisão do Rubens caso a caso.

**`torta-whatsapp-image-2026-08-09-at-14-32-58`** — foto nova de 09/08, sabor ainda não identificado. **Não ligue a nada** até o Rubens dizer qual é.

---

## O que NÃO fazer

- Não subir pelo editor de imagens
- Não gravar original
- Não sobrescrever foto de sabor existente
- Não inventar foto para Escola e Decoração
- Não apagar nada do Storage — a limpeza dos 71 órfãos tem prompt próprio, com backup antes
