# Homologação isolada do Portal Adoce

Este procedimento publica somente um **deploy de rascunho com alias**, em um projeto Netlify separado. Ele não usa `--prod`, não altera o domínio oficial e não toca no Supabase de produção.

## 1. Recursos obrigatoriamente separados

- Projeto Netlify exclusivo de homologação.
- Projeto Supabase exclusivo de homologação.
- Domínio `*.netlify.app` exclusivo do preview.
- Número/template de teste da Meta, quando a integração real for ativada.
- Classe/emissor de teste do Google Wallet, quando a integração real for ativada.

O ID do projeto Netlify de homologação deve ser diferente do ID do projeto de produção. O gate interrompe a publicação se os dois forem iguais.

## 2. Configuração do ambiente `homologation` no GitHub

Somente as credenciais necessárias para executar o deploy ficam no ambiente protegido do GitHub:

### Secrets de infraestrutura

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_HOMOLOGATION_SITE_ID`

### Variables não secretas

- `HOMOLOGATION_SITE_URL`, usando HTTPS e domínio `*.netlify.app`.
- `NETLIFY_PRODUCTION_SITE_ID`, usado apenas para impedir que o workflow escolha o projeto errado.

Nenhuma chave da Meta, Supabase ou Google Wallet deve ser gravada no GitHub.

## 3. Cofre de variáveis do projeto Netlify de homologação

Todas as variáveis abaixo devem ser configuradas no contexto `branch-deploy`. Valores reais permanecem no cofre da Netlify e não são impressos pelo workflow.

### Ambiente e origens

- `ADOCE_DEPLOY_ENV=homologation`
- `SITE_URL=https://<alias-de-homologacao>.netlify.app`
- `BFF_ALLOWED_ORIGINS=https://<alias-de-homologacao>.netlify.app`
- `ADOCE_HOMOLOGATION_SUPABASE_REF=<ref-homologacao>`
- `ADOCE_PRODUCTION_SUPABASE_REF=<ref-producao>`

### Supabase de homologação

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`, como variável secreta e somente para Functions/runtime.

O frontend recebe apenas a chave publicável. O gate rejeita `sb_secret_*` e `service_role` em variável `VITE_*`.

### Sessão e passkeys

- `BFF_ALLOWED_ORIGINS`
- `PASSKEY_RP_ID`
- `PASSKEY_RP_NAME=Adoce Brigaderia`
- `PASSKEY_ALLOWED_ORIGINS`
- `WHATSAPP_OTP_PEPPER`, secreto.

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

## 4. Publicação

O workflow `Publicar homologação isolada v2` é exclusivamente manual e exige:

1. branch fixa `reestruturacao/ux-crm-operacao-imagens-v1`;
2. commit completo e exato;
3. confirmação `PUBLICAR SOMENTE HOMOLOGACAO`;
4. projeto Netlify diferente da produção;
5. gates completos aprovados;
6. ambiente do cofre aprovado pelo gate de homologação.

O deploy usa alias de rascunho, nunca `--prod`.

## 5. Validações automáticas posteriores

Após publicar, o workflow:

1. consulta `/api/homologation-readiness`;
2. confirma ambiente `homologation`;
3. confirma domínio não produtivo;
4. confirma frontend e Functions no mesmo Supabase autorizado;
5. confirma ausência de chave secreta no frontend;
6. executa Playwright em celular, tablet e computador;
7. preserva relatório, screenshots, vídeos de falha e JSON do deploy.

O endpoint de readiness retorna somente estados, nomes de variáveis ausentes e referências não secretas. Em produção, responde `404`.

## 6. Critério de aprovação funcional

A homologação só fica pronta para avaliação do proprietário quando:

- `coreReady=true`;
- os três workflows principais estão verdes;
- migrations pendentes foram aplicadas somente no Supabase de homologação;
- smoke externo passou;
- passkeys foram ensaiadas em aparelhos reais;
- OTP da Meta e Google Wallet foram testados quando as credenciais estiverem disponíveis.

## 7. Produção

A homologação não autoriza publicação produtiva. Produção exige outra aprovação expressa, commit exato, backup confirmado, migrations revisadas, rollback preparado e smoke tests posteriores.
