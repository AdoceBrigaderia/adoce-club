# Estado do ambiente de homologação

Atualização de 27/07/2026. Este documento descreve somente recursos não produtivos e não contém credenciais.

## Recursos separados confirmados

- Netlify: projeto não produtivo `adoce-homologacao`.
- Alias fixo de preview: `homologacao-adoce`.
- URL canônica esperada: `https://homologacao-adoce--adoce-homologacao.netlify.app`.
- Supabase de homologação: `vazozolhbehnriytzcdc`.
- Supabase de produção usado somente como referência de bloqueio: `uefwywizqhfvvijaopcn`.
- Branch autorizada: `reestruturacao/ux-crm-operacao-imagens-v1`.
- Produção permanece proibida.

A URL base `https://adoce-homologacao.netlify.app` identifica o projeto, mas não deve ser usada como origem da aplicação enquanto o workflow publicar por alias. Sessão, BFF, passkeys, readiness e Playwright precisam usar a URL canônica do alias fixo.

## Variáveis não secretas já configuradas no Netlify de homologação

- identificação do ambiente como `homologation`;
- URL e origens permitidas do BFF;
- referência do Supabase de homologação e referência de bloqueio da produção;
- URL e chave publicável do Supabase de homologação;
- RP ID, nome e origem permitida das passkeys;
- ambiente e versão da Meta Graph API;
- origem permitida do Google Wallet.

Antes do primeiro deploy funcional, as variáveis de origem devem ser revisadas para confirmar que apontam para a URL canônica do alias fixo, sem mistura com a URL base do projeto.

## Segredos ainda obrigatórios no cofre Netlify

O deploy funcional permanece bloqueado até que os valores abaixo sejam inseridos diretamente no cofre do projeto de homologação:

- `SUPABASE_SECRET_KEY`;
- `WHATSAPP_OTP_PEPPER`;
- `PUBLIC_RATE_LIMIT_PEPPER`;
- credenciais e IDs reais do número/template de teste da Meta;
- credenciais do emissor de teste do Google Wallet.

O readiness agora considera os dois peppers parte do núcleo obrigatório. Seus valores nunca são devolvidos; apenas os nomes ausentes podem aparecer no diagnóstico.

Esses valores não devem ser enviados pelo chat, gravados no GitHub ou exibidos em logs.

## Infraestrutura do workflow manual

O ambiente protegido `homologation` do GitHub ainda precisa receber apenas as credenciais de infraestrutura necessárias ao deploy:

- secret `NETLIFY_AUTH_TOKEN`;
- secret `NETLIFY_HOMOLOGATION_SITE_ID`;
- variable `HOMOLOGATION_SITE_URL`, usando a URL canônica do alias fixo;
- variable `NETLIFY_PRODUCTION_SITE_ID`, usada exclusivamente para impedir seleção acidental do site produtivo.

Nenhuma credencial de Supabase, Meta ou Wallet deve ser copiada para o GitHub Actions.

## Critério para o primeiro preview funcional

1. alinhar `SITE_URL`, `BFF_ALLOWED_ORIGINS`, `PASSKEY_ALLOWED_ORIGINS`, `PASSKEY_RP_ID`, `GOOGLE_WALLET_ORIGINS` e `HOMOLOGATION_SITE_URL` com o alias fixo;
2. preencher os segredos diretamente nos cofres correspondentes;
3. executar os três pipelines principais no commit exato;
4. iniciar manualmente `Publicar homologação isolada v2`;
5. confirmar que o workflow usa a URL devolvida pelo deploy e obtém `coreReady=true`;
6. concluir Playwright externo e testes reais de passkey;
7. validar Meta e Wallet quando as integrações estiverem configuradas.

A existência do projeto e da URL reservada não significa que a versão atual da reestruturação já foi publicada nela.
