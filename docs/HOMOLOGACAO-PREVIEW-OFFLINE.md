# Preview visual offline da homologação

## Objetivo

Permitir que a experiência visual do Portal Adoce seja testada imediatamente, mesmo quando a credencial de publicação da Netlify ainda não estiver configurada.

O pacote offline é gerado pelo workflow `Publicar validação visual da homologação` depois de:

1. baixar e confirmar o SHA exato da branch autorizada;
2. instalar as dependências com lockfile;
3. executar `npm run verify:fast`;
4. gerar o build com `VITE_ADOCE_VALIDATION_MODE=visual`;
5. incorporar o commit e o horário UTC do build;
6. testar o servidor local e uma rota interna do SPA;
7. preservar o pacote completo como artefato do GitHub Actions.

A ausência de `NETLIFY_AUTH_TOKEN` não reprova esse fluxo. Ela apenas impede a publicação web; o pacote offline continua disponível.

## Conteúdo do artefato

```text
homologacao-visual-offline-<SHA>/
  dist/
  servidor-preview.mjs
  INICIAR-PREVIEW-WINDOWS.cmd
  INICIAR-PREVIEW-LINUX-MAC.command
  LEIA-ME.txt
  EVIDENCIA.txt
  SERVIDOR-TESTE.log
  SMOKE-INDEX.html
```

O artefato é mantido por 14 dias e o issue #3 recebe automaticamente:

- link direto para download;
- digest retornado pelo GitHub Actions;
- commit exato;
- instruções de inicialização por sistema;
- confirmação de que produção não foi alterada.

## Execução local rápida

Requisito: Node.js 22 ou superior.

### Windows

Depois de extrair o pacote, dê dois cliques em:

```text
INICIAR-PREVIEW-WINDOWS.cmd
```

### macOS ou Linux

Execute:

```bash
./INICIAR-PREVIEW-LINUX-MAC.command
```

Caso o sistema remova a permissão de execução ao extrair o arquivo:

```bash
chmod +x INICIAR-PREVIEW-LINUX-MAC.command
./INICIAR-PREVIEW-LINUX-MAC.command
```

### Alternativa universal

Dentro da pasta extraída:

```bash
node servidor-preview.mjs --open
```

O navegador abrirá:

```text
http://127.0.0.1:4173
```

Não é necessário executar `npm install`, `npm ci`, `npx` ou baixar pacotes adicionais. O servidor usa apenas recursos nativos do Node.js, escuta somente em `localhost/127.0.0.1` e aplica fallback para as rotas internas do Portal.

## Validação automática do pacote

Antes do upload, o workflow:

1. inicia o servidor empacotado em uma porta temporária reservada;
2. confirma resposta HTTP 200 na página inicial;
3. confirma a presença do elemento raiz da aplicação;
4. abre diretamente `/operacao/venda-rapida` e exige resposta HTTP 200;
5. encerra o servidor de teste;
6. só então publica o artefato.

O servidor possui testes próprios para:

- arquivos estáticos reais;
- fallback de rotas SPA;
- assets inexistentes sem fallback indevido;
- métodos HTTP não permitidos;
- tipos de conteúdo;
- headers mínimos `nosniff` e `Referrer-Policy`.

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
- o servidor local não aceita exposição em interfaces de rede externas;
- o pacote não instala dependências durante o teste do usuário;
- não há deploy produtivo;
- não há `--prod`;
- a publicação Netlify continua restrita ao site separado de homologação;
- o pacote offline não contém secrets;
- produção permanece inalterada.
