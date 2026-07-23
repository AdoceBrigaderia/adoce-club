# Instruções do projeto Clube Adoce

Os arquivos Markdown listados em `docs/documentation-manifest.json` são a fonte oficial da documentação.

## Antes de alterar qualquer coisa

1. Leia este arquivo e `docs/documentation-manifest.json`.
2. Consulte os capítulos oficiais relacionados à tarefa.
3. Compare a documentação com o código, as migrações e o comportamento real. Texto documental não é evidência de funcionamento.
4. Preserve alterações locais existentes e dados reais. Não reverta trabalho que não pertence à tarefa.

## Limites obrigatórios do produto

- O site público, o Clube Adoce, o Adoce Hoje e a Adoce Operação são superfícies diferentes.
- Clientes nunca devem ver painéis, métricas, linguagem, rotinas ou dados internos da operação.
- Informações pessoais, segredos, credenciais e chaves administrativas nunca podem ser expostos no navegador.
- Mudanças em tabelas públicas do Supabase exigem RLS, permissões mínimas e validação das políticas.
- Exclusões operacionais devem respeitar as regras de histórico e auditoria documentadas.

## Regra de validação

Não declare uma correção como concluída apenas porque o código compilou ou um teste isolado passou.

Classifique o resultado como:

- implementado, ainda não testado;
- validado automaticamente;
- validado visualmente;
- validado em produção;
- parcialmente implementado;
- bloqueado ou dependente de configuração externa.

Para mudanças de interface, valide pelo menos:

- computador;
- celular, prioridade principal do site público;
- tablet quando a mudança afetar a operação;
- carregamento, textos, imagens, botões, modais, rolagem, estados vazios e mensagens de erro;
- console do navegador e interação real do fluxo alterado.

Antes de publicar, execute `npm run release:check`. Produção só pode ser atualizada após autorização explícita. Depois da publicação, confira o domínio oficial sem iniciar outro deploy.

## Documentação oficial

Sempre que qualquer documentação oficial `.md` for criada ou alterada:

1. Atualize o manifesto quando houver novo documento, ordem, versão ou data.
2. Execute `node scripts/generate-docs.mjs`.
3. Confirme que `docs/clube-adoce-documentacao.html` foi regenerado.
4. Preserve o HTML como arquivo único e autocontido.

Não edite manualmente o conteúdo consolidado do HTML.
