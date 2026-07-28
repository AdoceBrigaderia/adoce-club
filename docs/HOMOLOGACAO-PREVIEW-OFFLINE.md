# Preview visual offline da homologação

## Objetivo

Permitir que a experiência visual do Portal Adoce seja testada imediatamente, mesmo quando a credencial de publicação da Netlify ainda não estiver configurada.

O pacote offline é gerado pelo workflow `Publicar validação visual da homologação` depois de:

1. baixar e confirmar o SHA exato da branch autorizada;
2. instalar as dependências com lockfile;
3. executar `npm run verify:fast`;
4. gerar o build com `VITE_ADOCE_VALIDATION_MODE=visual`;
5. incorporar o commit e o horário UTC do build;
6. preservar a pasta `dist` como artefato do GitHub Actions.

A ausência de `NETLIFY_AUTH_TOKEN` não reprova mais esse fluxo. Ela apenas impede a publicação web; o pacote offline continua disponível.

## Conteúdo do artefato

```text
homologacao-visual-offline-<SHA>/
  dist/
  LEIA-ME.txt
  EVIDENCIA.txt
```

O artefato é mantido por 14 dias e o issue #3 recebe automaticamente:

- link direto para download;
- digest retornado pelo GitHub Actions;
- commit exato;
- comando de execução local;
- confirmação de que produção não foi alterada.

## Execução local

Requisito recomendado: Node.js 22 ou superior.

Dentro da pasta extraída:

```bash
npx --yes serve@14.2.4 -s dist -l 4173
```

Depois, abrir:

```text
http://localhost:4173
```

O servidor em modo SPA é necessário para que rotas internas retornem corretamente ao `index.html`.

## Escopo da validação

O pacote permite avaliar:

- identidade oficial;
- responsividade em celular, tablet e computador;
- hierarquia, textos, espaçamentos e contraste;
- alvos touch;
- roteiro guiado das oito áreas;
- estados aprovado, ajustar e pendente;
- observações por tela;
- relatório copiável com commit e viewport.

Integrações externas e ações transacionais podem permanecer indisponíveis. O objetivo desta entrega é antecipar a validação visual sem confundir o pacote com a homologação funcional completa.

## Segurança

- branch e SHA exatos são obrigatórios;
- `npm run verify:fast` é executado antes do build;
- não há deploy produtivo;
- não há `--prod`;
- a publicação Netlify continua restrita ao site separado de homologação;
- o pacote offline não contém secrets;
- produção permanece inalterada.
