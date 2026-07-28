# Atlas visual de homologação — 98 pontos

## Objetivo

Disponibilizar uma revisão visual detalhada e independente das integrações externas, organizada nas oito áreas principais do Portal Adoce.

O atlas é gerado somente durante o workflow de validação visual da homologação e não é publicado em produção. A página resultante usa a logo oficial `/site/logo.webp`, não consulta banco, não executa Functions e não armazena credenciais ou dados de clientes.

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

## Uso

O workflow `Publicar validação visual da homologação` executa:

```bash
node scripts/generate-homologation-visual-atlas.mjs --check
node scripts/generate-homologation-visual-atlas.mjs --out dist/validacao-visual-98.html
```

Depois da publicação do preview, o atlas fica disponível em:

```text
<URL-DO-PREVIEW>/validacao-visual-98.html
```

Cada ponto pode ser marcado como `Aprovado`, `Ajustar` ou permanecer pendente. As observações e o progresso são mantidos apenas em `sessionStorage`, dentro da aba atual. O botão **Copiar relatório** gera um resumo textual com URL, viewport, resultado e observação de cada ponto.

## Segurança

- execução exclusiva na branch de reestruturação;
- geração após `verify:fast`;
- publicação apenas no deploy estático de rascunho da homologação;
- sem `--prod`;
- sem Netlify Functions;
- sem referência ao domínio ou ao Supabase de produção;
- sem persistência de autenticação, credenciais, dados de clientes ou transações;
- produção permanece inalterada.
