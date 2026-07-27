# Google Wallet — cartão digital do Clube Adoce

## Estado atual

A base técnica está implementada na branch de reestruturação e no Supabase de homologação. O botão aparece no cartão real do cliente, mas a emissão só será ativada quando o ambiente de homologação receber as credenciais protegidas e a classe oficial do Google Wallet.

Produção permanece fora do escopo até aprovação expressa.

## Fluxo do cliente

1. O cliente entra no Clube Adoce por senha ou passkey.
2. Toca em `Adicionar ao Google Wallet`.
3. O navegador chama somente o BFF com cookie HttpOnly e CSRF.
4. O backend prepara o passe, registra auditoria e assina o JWT com a conta de serviço.
5. O cliente é direcionado ao endereço oficial de salvamento do Google Wallet.

O frontend nunca recebe a chave privada da conta de serviço.

## Conteúdo do passe

- identidade visual definida na classe oficial do Clube Adoce;
- nome do cliente;
- código de membro;
- progresso de 0 a 14 carimbos;
- quantidade de fatias grátis disponíveis;
- QR identificador do cadastro;
- link para abrir a área do cliente.

O QR do passe apenas identifica o cadastro. Ele não autoriza ajuste de fidelidade, resgate, venda ou operação financeira. Essas ações continuam protegidas pelo backend, permissões e auditoria da equipe.

## Variáveis protegidas esperadas

Configurar somente no cofre de variáveis da Netlify do ambiente correspondente:

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLASS_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY`
- `GOOGLE_WALLET_ORIGINS`
- `SITE_URL`

A chave privada deve permanecer com as quebras de linha preservadas ou codificadas como `\n`. Nenhuma dessas variáveis deve ser colocada no GitHub, no frontend, em comentários ou em capturas de tela públicas.

## Separação de ambientes

Homologação e produção devem utilizar:

- origens distintas;
- configuração independente na Netlify;
- classe e conta de serviço controladas;
- testes em aparelho real antes da liberação;
- ativação de produção somente após aprovação expressa.

## Validações automatizadas

- assinatura RS256 conferida com chave pública;
- limite seguro do JWT;
- destino restrito a `https://pay.google.com/gp/v/save/`;
- origem e CSRF obrigatórios;
- sessão exclusiva da superfície cliente;
- tabela com RLS e sem leitura direta;
- RPC sem execução anônima;
- chave privada ausente do bundle público;
- auditoria a cada preparação do passe.

## Pendências externas para ativação real

1. concluir ou confirmar a conta de emissor Google Wallet;
2. criar e aprovar a classe com a identidade oficial da Adoce;
3. vincular a conta de serviço ao emissor;
4. cadastrar as variáveis no ambiente de homologação;
5. testar inclusão e atualização em Android com uma conta Google real;
6. validar o cartão visualmente e funcionalmente antes de qualquer configuração de produção.
