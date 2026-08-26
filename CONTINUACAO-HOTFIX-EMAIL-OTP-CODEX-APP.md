# Continuação do hotfix de e-mail OTP no Codex App

## Objetivo

Concluir e validar em produção a correção do não envio do código de acesso por e-mail para clientes e operação do Clube Adoce.

## Regras obrigatórias

- Trabalhar em `D:\Clube Adoce`.
- Ler `AGENTS.md` e `docs/documentation-manifest.json` antes de agir.
- O worktree contém muitas alterações de outras demandas. Não publicar o diretório inteiro e não reverter trabalho existente.
- Não fazer push, reset, clean, checkout destrutivo, exclusão ou alteração de banco.
- Preservar o deploy de produção atual como rollback.
- Validar pedido, recebimento e verificação do OTP de ponta a ponta antes de declarar concluído.

## Causas confirmadas

1. As variáveis de produção da Netlify apontavam para um projeto Supabase inexistente:
   - host incorreto anterior: `vazozolhbehnriytzcdc.supabase.co`;
   - projeto oficial: `uefwywizqhfvvijaopcn.supabase.co`.
   - logs de produção mostraram `getaddrinfo ENOTFOUND` para o host incorreto.

2. `netlify/functions/request-email-code.ts` usava `admin.auth.admin.generateLink()` e retornava `{ sent: true }` para usuários existentes. `generateLink()` gera o link, mas não envia o e-mail. A interface, portanto, informava sucesso sem entrega.

## Alterações locais já realizadas

- `netlify/functions/request-email-code.ts`
  - removido `createClient` e todo o fluxo `sendWithAdminLink`;
  - removidos os retornos falsos após `generateLink`;
  - todos os pedidos passam por `/auth/v1/otp` com `create_user` de acordo com o fluxo.

- `src/email-code-delivery.test.ts`
  - proteção contra retorno de `generateLink`/`sendWithAdminLink`;
  - teste funcional confirma que conta existente chama `/auth/v1/otp` com `create_user: false` antes de informar sucesso.

- `src/seo-static-pages.test.ts`
  - normalização de `CRLF` para `LF`, necessária para o gate funcionar no Windows.

## Testes concluídos

- Teste focado: 6/6 aprovado.
- `npm.cmd run lint`: aprovado.
- `npm.cmd run release:check`: aprovado.
- Resultado completo: 106 arquivos de teste e 719/719 testes aprovados, TypeScript e build aprovados.

## Configuração Netlify já corrigida

As variáveis abaixo foram atualizadas nos contextos `production`, `deploy-preview` e `branch-deploy`:

- `SUPABASE_URL` -> projeto oficial;
- `VITE_SUPABASE_URL` -> projeto oficial;
- `SUPABASE_PUBLISHABLE_KEY` -> chave pública validada;
- `VITE_SUPABASE_PUBLISHABLE_KEY` -> chave pública validada;
- `SUPABASE_SECRET_KEY` -> chave secreta validada, mantida como secreta.

A Netlify informou que as mudanças exigem novo deploy para entrarem em vigor.

## Netlify e deploys importantes

- Site ID: `bb0c96cd-5af2-4270-a9a8-b63b9637b1f4`.
- Projeto Netlify: `adocebrigaderia`.
- Deploy atual de produção/rollback: `6a85f56c0c6520bdb4dc0f7a`.
- Produção atual tem 190 arquivos e 25 funções.
- Digest antigo de `request-email-code`: `4b89cc1fbcdf8fa79537cb0e6d84a496f0ec656aa663492afcedd6675df98512`.
- ZIP local corrigido: `.netlify/functions/request-email-code.zip`.
- SHA-256 confirmado do ZIP corrigido: `d0930b7f168c2050f0118fdd371712c519570732efba370aff5eded9c331ce1a`.
- O ZIP foi inspecionado: contém `/auth/v1/otp` e não contém `generateLink`.

### Deploys de diagnóstico

- `6a86a59a9f7d4405d36692e1`: prévia criada com o diretório local completo. Não promover, pois contém muitas alterações fora do hotfix.
- `6a86be860c933126b906ffb9`: deploy cirúrgico pronto antes do alinhamento final das variáveis; respondeu 503 por não ter capturado as variáveis corretas. Não promover.
- `6a86c41bcf704b6a5cd018cc`: rascunho criado após alterar variáveis; ficou `uploading` e passou a exigir os 25 bundles de funções. Não promover incompleto.

## Próximo passo técnico

Criar um novo deploy cirúrgico que:

1. reutilize exatamente os 190 arquivos do deploy `6a85f56c0c6520bdb4dc0f7a`;
2. preserve exatamente as 25 funções existentes;
3. reempacote/reenvie as funções para capturar as variáveis corrigidas;
4. substitua somente o código de `request-email-code` pelo ZIP corrigido;
5. preserve rotas, agendamentos e configurações das funções;
6. seja validado primeiro como draft;
7. somente depois seja promovido/restaurado como produção.

Não usar `npm run release:prod` no worktree atual: isso publicaria centenas de mudanças locais alheias ao incidente.

Investigar primeiro a API oficial Netlify para baixar/reutilizar os bundles das funções do deploy atual. Métodos já identificados:

- `listSiteFiles`;
- `getSiteDeploy`;
- `createSiteDeploy`;
- `uploadDeployFunction`;
- `restoreSiteDeploy`.

A especificação oficial está em `https://open-api.netlify.com/swagger.json`.

## Validação final obrigatória

1. No draft isolado, chamar `/api/request-email-code` com a conta controlada já existente.
2. Confirmar HTTP 200 com `{ "sent": true }`.
3. Confirmar chegada do e-mail do remetente `acesso@auth.adocebrigaderia.com.br`.
4. Confirmar que o código é aceito por `/api/verify-email-code` sem expor o código em logs ou conversa.
5. Comparar manifestos para provar que somente o bundle necessário/configuração mudou.
6. Promover o deploy cirúrgico para produção.
7. Repetir pedido, recebimento e verificação no domínio `https://www.adocebrigaderia.com.br`.
8. Consultar logs e confirmar ausência de `ENOTFOUND`, `generateLink` e erros SMTP.
9. Manter `6a85f56c0c6520bdb4dc0f7a` documentado como rollback imediato.

## Evidência de e-mail

A caixa Gmail conectada já recebeu códigos reais do Clube Adoce até 16/08/2026, mas não apresentou novos códigos durante os testes deste incidente. Não exibir códigos OTP nem identificadores de mensagens.

