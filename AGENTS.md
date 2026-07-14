# Instruções do projeto Clube Adoce

Os arquivos Markdown listados em `docs/documentation-manifest.json` são a fonte oficial da documentação.

Sempre que qualquer documentação oficial `.md` for criada ou alterada:

1. Atualize o manifesto quando houver novo documento, ordem, versão ou data.
2. Execute `node scripts/generate-docs.mjs`.
3. Confirme que `docs/clube-adoce-documentacao.html` foi regenerado.
4. Preserve o HTML como arquivo único e autocontido.

Não edite manualmente o conteúdo consolidado do HTML.
