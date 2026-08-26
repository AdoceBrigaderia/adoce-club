# Limpeza do Storage — o que pode ir
**08/08/2026** · Conferido contra o banco de produção, tabela por tabela.

O bucket `adoce-media` tem **480 MB em 446 arquivos**. O limite do plano gratuito é 1 GB.

| O que é | Arquivos | Tamanho |
|---|---|---|
| Imagens que o site usa (`.webp`) | 231 | 44 MB |
| Originais guardados pelo editor (`.png`/`.jpg`) | 215 | **436 MB** |

Toda vez que alguém colou uma foto no editor do site, ele guardou duas: a otimizada, que o cliente vê, e o arquivo bruto. O bruto é dez vezes maior.

---

## Grupo 1 — Órfãos: podem ir sem pensar

**71 arquivos · 68 MB · nenhuma referência no banco.**

Conferido contra todas as colunas que apontam para imagem: `commercial_media_items`, `commercial_products`, `commercial_segment_media`, `site_visual_assets`, `flavor_images`, `flavors` (`image_path` e `whole_cake_*`), `promotions`.

São fotos que foram coladas, editadas e depois substituídas. O par ficou para trás. Ninguém acessa.

A lista completa está em `LIMPEZA-STORAGE-ORFAOS.txt`, ao lado deste arquivo.

Distribuição: 15 em `commercial/galleries/cakes` e `/events`, 2 em `galleries/9dccb25c...`, 48 em `produtos/`, 6 em `site-visuals/`.

---

## Grupo 2 — Originais ainda referenciados: decisão sua

**180 arquivos · 374 MB.**

Estes ainda estão ligados a um produto ou galeria, no campo "imagem original". Servem para **reeditar a foto depois sem perder qualidade**.

Três caminhos:

**Apagar.** Devolve 374 MB. O custo: se quiser reeditar aquela foto, precisa subir de novo.

**Converter para WebP com qualidade alta.** Devolve uns 250 MB e mantém a possibilidade de reeditar, com perda mínima. É o meio-termo, e o que eu recomendo.

**Manter.** Continua ocupando 374 MB — o que, no plano Pro com 8 GB, deixa de ser problema imediato.

---

## Antes de apagar qualquer coisa

**Baixe o bucket inteiro.** São 480 MB, cabe num pendrive. Storage não tem backup automático como o banco: apagou, acabou.

Um jeito rápido, com a CLI do Supabase já instalada no projeto:

```
npx supabase storage cp -r ss:///adoce-media ./backup-media --experimental
```

Confira que os 446 arquivos chegaram antes de apagar qualquer coisa.

---

## Impedir que volte a crescer

Apagar hoje não resolve amanhã: **o editor vai continuar guardando o original de cada foto nova.**

Duas mudanças que valem mais que a faxina:

**Comprimir o original antes de guardar.** Um PNG de 3,5 MB vira um WebP de 400 KB com qualidade de sobra para reedição.

**Apagar o original antigo quando a imagem é substituída.** É exatamente assim que nasceram os 71 órfãos.

---

## Por que eu não apago

Apagar arquivo em definitivo não tem desfazer, e um engano meu aqui não volta com backup nenhum. A lista está conferida e pronta; quem executa é você ou o Codex, depois do backup.
