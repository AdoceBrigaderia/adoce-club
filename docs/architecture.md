# Arquitetura de produção

## Limite deste repositório

Esta entrega implementa o MVP local navegável e as regras críticas. Persistência PostgreSQL, autenticação real, filas e emissão nativa de passes são a próxima camada; não podem ser simuladas como produção porque dependem de infraestrutura e credenciais externas.

## Serviços propostos

- `web`: cadastro, cartão web, PWA de atendimento e administração.
- `api`: autenticação, RBAC, transações e auditoria.
- `worker`: outbox, atualização Apple/Google, retry e notificações.
- PostgreSQL: fonte de verdade e livro imutável.
- Redis: fila, rate limit e locks auxiliares; a correção do saldo permanece garantida pelo banco.

`WalletProvider` define `issue`, `update`, `revoke` e `health`. Implementações: `MockAppleWalletProvider`, `MockGoogleWalletProvider`, `AppleWalletProvider`, `GoogleWalletProvider`; Samsung fica como extensão futura.

## Transação de saldo

1. Validar sessão, papel, conta, quantidade e idempotency key.
2. Iniciar transação e bloquear `loyalty_account` com `SELECT ... FOR UPDATE`.
3. Retornar o resultado anterior se a idempotency key já existir.
4. Calcular o novo saldo; impedir negativo.
5. Inserir `loyalty_transaction` e atualizar o cache `current_balance` na mesma transação.
6. Inserir evento `LoyaltyBalanceChanged` na outbox.
7. Commit. O worker atualiza carteiras separadamente; falha externa não desfaz a compra.

Índices únicos: telefone normalizado ativo, hash do token, idempotency key por conta, serial Apple e external object Google. Movimentações nunca recebem UPDATE/DELETE; correções usam `REVERSAL` vinculada à original.

## API principal

Público: `POST /api/public/enrollment`, recuperação, cartão e links Apple/Google. Atendimento: resolver token, consultar cliente, earn, redeem, reverse e extrato. Admin: clientes, ajustes, usuários, relatórios, auditoria e configurações. Erros seguem `{ "error": { "code", "message", "requestId" } }`.

## Apple e Google

A emissão Apple requer Pass Type ID, Team ID, certificado, assinatura PKPass, web service de registros/dispositivos e APNs. Google exige Issuer ID, service account, classe/objeto e JWT “Add to Google Wallet”. As dimensões e payloads devem ser validados novamente na documentação oficial no momento da configuração, pois são requisitos externos sujeitos a mudança.

## Checklist de implantação

- HTTPS/HSTS, cookies secure/HTTP-only/SameSite e CSP.
- Argon2id para senhas, MFA para OWNER e proteção de força bruta.
- Chaves e certificados em cofre, nunca em variáveis públicas.
- Logs JSON com request ID, sem token, telefone completo ou segredo.
- Backups PostgreSQL testados e rotação de tokens.
- Exportação/anonimização LGPD com retenção técnica auditável.
- Alertas para certificado vencendo, fila de erro e divergência de saldo.
