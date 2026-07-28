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

A execução faz checkout do **SHA exato** que acionou o workflow e confirma que o commit baixado coincide com `GITHUB_SHA`. Isso impede que um novo push altere silenciosamente o conteúdo enquanto o pacote anterior ainda está sendo montado.

O artefato do GitHub Actions contém os arquivos abertos e também um ZIP interno pronto para repasse:

```text
atlas-visual/
  validacao-visual-98.html
  LEIA-ME.md
  EVIDENCIA.txt
  SHA256SUMS.txt
  imagens-separadas/
    index.html
    manifest.json
    LEIA-ME.txt
    imagens/
      001-....svg
      002-....svg
      ...
      098-....svg
entrega/
  adoce-atlas-visual-98-<SHA-CURTO>.zip
  adoce-atlas-visual-98-<SHA-CURTO>.zip.sha256
  LEIA-ME.txt
```

O arquivo `imagens-separadas/index.html` apresenta uma galeria navegável. Cada SVG informa área, checkpoint, rota interna, indicação de homologação e confirmação de que produção não foi alterada.

O arquivo `SHA256SUMS.txt` permite conferir cada item do atlas antes do uso. O arquivo `.zip.sha256` permite validar o pacote completo. O workflow também abre o ZIP em modo de teste e confirma que existem exatamente 98 SVGs antes do upload.

As imagens são representações conceituais para revisão de UX, identidade, hierarquia visual, alvos touch e clareza operacional. A validação funcional continua sendo feita no preview navegável.

## Segurança

- execução exclusiva na branch de reestruturação;
- checkout e validação do SHA exato do evento;
- geração das 98 imagens sem `npm ci`, Netlify, Supabase ou credenciais externas;
- pacote ZIP validado antes do upload e acompanhado por checksums SHA-256;
- artefato mantido por 30 dias no GitHub Actions;
- publicação do preview apenas no deploy estático de rascunho da homologação;
- sem `--prod`;
- sem Netlify Functions;
- sem referência ao domínio ou ao Supabase de produção;
- sem persistência de autenticação, credenciais, dados de clientes ou transações;
- produção permanece inalterada.
