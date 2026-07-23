# Portal Adoce

Portal público, Clube Adoce e sistema interno da Adoce Brigaderia. O projeto deixou de ser um protótipo local: utiliza React e TypeScript no frontend, Supabase para dados, autenticação e mídias, e Netlify para hospedagem e funções de servidor.

## Leia antes de trabalhar

1. `AGENTS.md` contém os limites e o método obrigatório de trabalho.
2. `docs/documentation-manifest.json` define quais documentos são oficiais.
3. `docs/clube-adoce-documentacao.html` reúne a documentação em um único arquivo offline.

Não use um texto documental como prova de que um fluxo funciona. Confira código, banco, interface e comportamento real.

## Superfícies do produto

- `/#inicio`: vitrine e entrada pública da Adoce.
- `/#adoce-hoje`: sabores, disponibilidade, agenda e pedidos imediatos.
- `/#entrar`: acesso do cliente ao Clube Adoce.
- `/#operacao`: ambiente exclusivo da equipe.

As áreas públicas e internas devem permanecer separadas em rotas, textos, componentes, dados e permissões.

## Executar localmente

```bash
npm install
npm run dev
```

O servidor do Vite aceita acesso pela rede local. O endereço exato é informado no terminal.

Variáveis necessárias são documentadas em `.env.example`. Segredos de servidor nunca devem usar o prefixo `VITE_`.

## Validação

```bash
npm test
npm run lint
npm run build
npm run release:check
```

`release:check` é o portão obrigatório antes de homologação ou produção. Além dos testes automáticos, mudanças visuais precisam de conferência real em computador, celular e, quando envolverem a operação, tablet.

## Publicação

```bash
npm run release:preview
npm run release:prod
```

- Use a prévia somente quando a validação exigir outro aparelho ou acesso remoto.
- Publique em produção apenas com autorização explícita.
- Depois do deploy, confira o domínio oficial e os fluxos críticos sem gerar uma nova publicação.

## Banco e mídias

- Migrações versionadas ficam em `supabase/migrations`.
- Tabelas expostas exigem RLS e permissões mínimas.
- Arquivos enviados pela operação usam o bucket `adoce-media`.
- Imagens de sabores, produtos, categorias, galerias e elementos institucionais possuem editores administrativos próprios.

## Estado do produto

O estado confirmado e as pendências ficam em `docs/07-status-publicacao.md`. Entradas históricas não substituem uma nova validação. Ao relatar uma entrega, diferencie claramente implementação, teste automático, inspeção visual e confirmação em produção.
