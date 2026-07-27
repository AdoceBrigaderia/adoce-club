# Homologação isolada do Portal Adoce

Este procedimento publica somente um **deploy de rascunho com alias fixo**, em um projeto Netlify separado. Ele não usa `--prod`, não altera o domínio oficial e não toca no Supabase de produção.

## 1. Recursos obrigatoriamente separados

- Projeto Netlify exclusivo de homologação.
- Projeto Supabase exclusivo de homologação.
- Domínio `*.netlify.app` exclusivo e estável do preview.
- Número/template de teste da Meta, quando a integração real for ativada.
- Classe/emissor de teste do Google Wallet, quando a integração real for ativada.

O ID do projeto Netlify de homologação deve ser diferente do ID do projeto de produção. O gate interrompe a publicação se os dois forem iguais.

O workflow usa o alias fixo `homologacao-adoce`. Para o projeto Netlify `adoce-homologacao`, a origem canônica esperada é:

```text
https://homologacao-adoce--adoce-homologacao.netlify.app
```

A URL base do projeto Netlify não deve ser misturada com a URL do alias nas configurações de sessão ou passkey.

## 2. Configuração do ambiente `homologation` no GitHub

Somente as credenciais necessárias para executar o deploy ficam no ambiente protegido do GitHub:

### Secrets de infraestrutura

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_HOMOLOGATION_SITE_ID`

### Variables não secretas

- `HOMOLOGATION_SITE_URL`, com a origem HTTPS exata do alias fixo publicado.
- `NETLIFY_PRODUCTION_SITE_ID`, usado apenas para impedir que o workflow escolha o projeto errado.

Nenhuma chave da Meta, Supabase ou Google Wallet deve ser gravada no GitHub.

## 3. Cofre de variáveis do projeto Netlify de homologação

Todas as variáveis abaixo devem ser configuradas no contexto `branch-deploy`. Valores reais permanecem no cofre da Netlify e não são impressos pelo workflow.

### Ambiente e origens

- `ADOCE_DEPLOY_ENV=homologation`
- `SITE_URL=https://<alias-fixo>--<site-homologacao>.netlify.app`
- `BFF_ALLOWED_ORIGINS=https://<alias-fixo>--<site-homologacao>.netlify.app`
- `ADOCE_HOMOLOGATION_SUPABASE_REF=<ref-homologacao>`
- `ADOCE_PRODUCTION_SUPABASE_REF=<ref-producao>`

`SITE_URL`, `BFF_ALLOWED_ORIGINS` e `HOMOLOGATION_SITE_URL` devem representar a mesma origem. O readiness compara a origem real da requisição com `SITE_URL` e bloqueia o preview se houver divergência.

### Supabase de homologação

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`, como variável secreta e somente para Functions/runtime.

O frontend recebe apenas a chave publicável. O gate rejeita `sb_secret_*` e `service_role` em variável `VITE_*`.

### Sessão, proteção pública e passkeys

- `BFF_ALLOWED_ORIGINS`
- `PASSKEY_RP_ID`, contendo somente o hostname exato do alias fixo.
- `PASSKEY_RP_NAME=Adoce Brigaderia`
- `PASSKEY_ALLOWED_ORIGINS`, usando a mesma origem HTTPS canônica.
- `WHATSAPP_OTP_PEPPER`, secreto.
- `PUBLIC_RATE_LIMIT_PEPPER`, secreto e diferente do pepper do OTP.

Os dois peppers e o segredo do Supabase fazem parte do núcleo obrigatório. A ausência de qualquer um mantém `coreReady=false`.

### Meta WhatsApp Cloud API

- `META_WA_ACCESS_TOKEN`
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_WABA_ID`
- `META_WA_APP_SECRET`
- `META_WA_VERIFY_TOKEN`
- `META_WA_AUTH_TEMPLATE_NAME`
- `META_WA_GRAPH_API_VERSION`
- `META_WA_ENVIRONMENT=homologation`

Os valores sensíveis devem ser marcados como secretos. A ausência dessas credenciais não impede o teste do núcleo, mas mantém o WhatsApp real como pendente no readiness.

### Google Wallet

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLASS_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY`, secreto.
- `GOOGLE_WALLET_ORIGINS`

A ausência dessas credenciais não impede o teste do núcleo, mas mantém a emissão real de passes como pendente.

## 4. Pré-flight redigido antes da publicação

O comando abaixo avalia o ambiente atual e gera um diagnóstico que pode ser executado localmente ou dentro do contexto Netlify:

```bash
npm run report:homologation-preflight
```

Ele cria:

```text
artifacts/homologation-preflight.json
artifacts/homologation-preflight.md
```

O relatório separa três estados:

1. **núcleo pronto**: ambiente, origem, Supabase, chave publicável, segredo server-only e peppers válidos;
2. **preview pronto para publicação**: núcleo pronto mais credenciais de infraestrutura da Netlify presentes;
3. **integrações completas**: preview pronto mais Meta WhatsApp e Google Wallet configurados.

A falta de Meta ou Wallet não bloqueia o diagnóstico do núcleo. O relatório nunca inclui valores de tokens, chaves, peppers ou credenciais; registra somente estados booleanos e nomes de variáveis ausentes.

O workflow manual executa esse pré-flight dentro do contexto `branch-deploy` antes do gate e preserva os dois arquivos como evidência.

## 5. Publicação

O workflow `Publicar homologação isolada v2` é exclusivamente manual e exige:

1. branch fixa `reestruturacao/ux-crm-operacao-imagens-v1`;
2. commit completo e exato;
3. confirmação `PUBLICAR SOMENTE HOMOLOGACAO`;
4. projeto Netlify diferente da produção;
5. gates completos aprovados;
6. ambiente do cofre aprovado pelo gate de homologação.

O deploy usa alias de rascunho, nunca `--prod`. O workflow extrai a URL devolvida pela Netlify, confirma que ela pertence ao projeto reservado e usa exatamente essa URL no readiness e no Playwright. Ele não testa uma versão anterior por meio de endereço estático.

## 6. Validações automáticas posteriores

Após publicar, o workflow:

1. consulta `/api/homologation-readiness` no deploy exato;
2. confirma ambiente `homologation`;
3. confirma domínio não produtivo e origem real igual à origem configurada;
4. confirma frontend e Functions no mesmo Supabase autorizado;
5. confirma presença dos peppers obrigatórios sem revelar seus valores;
6. confirma ausência de chave secreta no frontend;
7. executa Playwright em celular, tablet e computador no mesmo deploy;
8. preserva pré-flight, relatório, screenshots, vídeos de falha, URL e JSON do deploy.

O endpoint de readiness retorna somente estados, nomes de variáveis ausentes e referências não secretas. Em produção, responde `404`.

## 7. Critério de aprovação funcional

A homologação só fica pronta para avaliação do proprietário quando:

- `coreReady=true`;
- o pré-flight não apresenta bloqueios do núcleo;
- a origem real do deploy corresponde à origem configurada;
- os três workflows principais estão verdes;
- migrations pendentes foram aplicadas somente no Supabase de homologação;
- smoke externo passou no deploy exato;
- passkeys foram ensaiadas em aparelhos reais;
- OTP da Meta e Google Wallet foram testados quando as credenciais estiverem disponíveis.

## 8. Produção

A homologação não autoriza publicação produtiva. Produção exige outra aprovação expressa, commit exato, backup confirmado, migrations revisadas, rollback preparado e smoke tests posteriores.
