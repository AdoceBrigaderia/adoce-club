# Atlas visual de homologação — 98 pontos

## Objetivo

Disponibilizar uma revisão visual detalhada e independente das integrações externas, organizada nas oito áreas principais do Portal Adoce.

O atlas é gerado somente durante os workflows de validação visual da homologação e não é publicado em produção. A página interativa usa a logo oficial `/site/logo.webp`, não consulta banco, não executa Functions e não armazena credenciais ou dados de clientes.

Além do atlas interativo, o empacotamento gera **98 representações visuais separadas**, uma para cada checkpoint, em SVG 1080 × 1350. A logo oficial é incorporada em cada arquivo, permitindo abrir as imagens individualmente sem depender de rede, Netlify ou Supabase.

## Distribuição

| Área | Pontos |
|---|---:|
| Início e identidade | 12 |
| Fatias de hoje | 12 |
| Cadastro simplificado | 12 |
| Clube e cartão digital | 12 |
| Pede Junto | 12 |
| Encomendas | 12 |
| Operação | 18 |
| Atendimento | 8 |
| **Total** | **98** |

## Atlas interativo

O workflow de preview pode executar:

```bash
node scripts/generate-homologation-visual-atlas.mjs --check
node scripts/generate-homologation-visual-atlas.mjs --out dist/validacao-visual-98.html
```

Depois da publicação do preview, o atlas fica disponível em:

```text
<URL-DO-PREVIEW>/validacao-visual-98.html
```

Cada ponto pode ser marcado como `Aprovado`, `Ajustar` ou permanecer pendente. As observações e o progresso são mantidos apenas em `sessionStorage`, dentro da aba atual. O botão **Copiar relatório** gera um resumo textual com URL, viewport, resultado e observação de cada ponto.

## 98 imagens separadas

O workflow `Gerar atlas visual de homologação` executa sem credenciais externas:

```bash
node scripts/export-homologation-visual-atlas-images.mjs --check
node scripts/export-homologation-visual-atlas-images.mjs \
  --logo public/site/logo.webp \
  --out-dir artifacts/atlas-visual/imagens-separadas
```

O artefato do GitHub Actions é baixado como ZIP e contém:

```text
validacao-visual-98.html
imagens-separadas/
  index.html
  manifest.json
  LEIA-ME.txt
  imagens/
    001-....svg
    002-....svg
    ...
    098-....svg
EVIDENCIA.txt
```

O arquivo `imagens-separadas/index.html` apresenta uma galeria navegável. Cada SVG informa área, checkpoint, rota interna, indicação de homologação e confirmação de que produção não foi alterada.

As imagens são representações conceituais para revisão de UX, identidade, hierarquia visual, alvos touch e clareza operacional. A validação funcional continua sendo feita no preview navegável.

## Segurança

- execução exclusiva na branch de reestruturação;
- geração das 98 imagens sem `npm ci`, Netlify, Supabase ou credenciais externas;
- artefato ZIP mantido por 30 dias no GitHub Actions;
- publicação do preview apenas no deploy estático de rascunho da homologação;
- sem `--prod`;
- sem Netlify Functions;
- sem referência ao domínio ou ao Supabase de produção;
- sem persistência de autenticação, credenciais, dados de clientes ou transações;
- produção permanece inalterada.
