# Como manter esta documentação

Os documentos oficiais são os arquivos numerados. A ordem, versão e data ficam em `documentation-manifest.json`.

Após qualquer mudança, execute `node scripts/generate-docs.mjs`. Isso recria `clube-adoce-documentacao.html`, um arquivo responsivo e autocontido que pode ser enviado isoladamente para celulares e computadores.

O HTML não deve ser editado diretamente. Todas as mudanças de conteúdo começam nos arquivos Markdown.
