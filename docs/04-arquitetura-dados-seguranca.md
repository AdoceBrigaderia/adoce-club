---
title: Arquitetura, dados e segurança
description: Modelo de domínio, serviços, transações, Wallet, privacidade e operação técnica.
status: Proposta técnica
---

# Arquitetura, dados e segurança

## Limite do protótipo atual

O protótipo React existente usa `localStorage`. Ele não oferece sincronização entre dispositivos, autenticação real, banco central, leitura de câmera, emissão de Wallet ou segurança suficiente para operação comercial. A implementação de produção deve substituir essa base, preservando apenas componentes visuais ou regras que forem aprovados.

## Componentes recomendados

- **Web responsiva/PWA:** experiência do cliente, atendimento e administração.
- **API:** autenticação, permissões, regras e consultas.
- **PostgreSQL:** fonte de verdade transacional e livro de movimentações.
- **Worker e outbox:** atualização de Apple/Google Wallet, notificações e tentativas automáticas.
- **Armazenamento de mídia:** fotos de sabores, promoções e conteúdo.
- **Fila/Redis opcional:** tarefas, limites de uso e bloqueios auxiliares; a consistência do saldo permanece no banco.

## Modelo de domínio

| Entidade | Responsabilidade |
| --- | --- |
| Person | Identidade individual, telefone e consentimentos |
| LoyaltyAccount | Meu Cartão individual ou compartilhado |
| GroupMembership | Papel e vínculo entre pessoa e grupo |
| LoyaltyTrack | Trilha MAIN ou REFERRAL |
| Reward | Prêmio emitido, disponível, resgatado ou revertido |
| LedgerEntry | Movimento imutável de carimbo, bônus, resgate ou reversão |
| Referral | Indicador, indicado, código e estado da primeira compra |
| WalletPass | Passe por pessoa, provedor, serial e sincronização |
| StoreOperation | Status e horários dos canais da Adoce |
| FlavorAvailability | Sabor, data, disponibilidade e atualização |
| Promotion | Conteúdo, público e período |
| StaffUser | Identidade interna e papel |
| AuditEvent | Registro de ações administrativas e de segurança |

## Contadores derivados

A fonte de verdade é o livro de movimentações, não um número editável na tela.

- `completed_cards`: quantidade de ciclos de 14 concluídos.
- `available_rewards`: prêmios emitidos menos prêmios resgatados ou revertidos.
- `current_progress`: carimbos válidos além dos ciclos já concluídos.
- `redeemed_rewards`: prêmios efetivamente utilizados.

Contadores podem ser mantidos em cache para desempenho, mas precisam ser reconciliáveis com o livro.

## Transação de compra

1. Validar sessão, papel, conta, quantidade e chave de idempotência.
2. Abrir transação e bloquear a trilha afetada.
3. Retornar o resultado anterior se a chave já tiver sido processada.
4. Inserir os carimbos da compra no livro.
5. Emitir prêmios para cada ciclo de 14 completado.
6. Se for primeira compra com indicação válida, creditar o bônus do indicado e do indicador na mesma transação.
7. Inserir eventos na outbox.
8. Confirmar a transação.
9. O worker atualiza os passes; falha externa não desfaz a compra.

## Transação de resgate

- Bloquear o prêmio selecionado.
- Confirmar que está disponível e pertence à conta correta.
- Registrar resgate, funcionário, canal e referência.
- Alterar o estado do prêmio de forma transacional.
- Não alterar progresso atual nem cartões completados.
- Agendar atualização de todos os passes afetados.

## Apple Wallet e Google Wallet

Cada pessoa recebe um passe individual, mesmo quando participa de um grupo. O QR identifica o passe ou participante por um token aleatório e revogável, nunca por telefone ou saldo em texto aberto.

### Apple

Requer Pass Type ID, Team ID, certificado de assinatura, pacote assinado, serviço de atualização e notificações da Apple. O servidor mantém serial individual e publica atualizações do mesmo passe.

### Google

Requer conta de emissor, credencial de serviço, classe de fidelidade e objeto individual. Alterações do cliente atualizam o objeto correspondente.

Credenciais e certificados ficam em cofre de segredos. Nenhuma chave de emissão pode ser enviada ao navegador.

## API funcional

### Público e cliente

- cadastro, confirmação e recuperação;
- instalação de Wallet;
- home e Adoce Hoje;
- cartões, prêmios e histórico;
- criação e gestão de grupo;
- convite, entrada e saída de grupo;
- código e acompanhamento de indicação.

### Atendimento

- resolver QR ou busca;
- registrar compra;
- validar primeira compra indicada;
- resgatar prêmio;
- reverter operação autorizada;
- consultar extrato operacional.

### Administração

- clientes, grupos, prêmios e indicações;
- funcionários e permissões;
- sabores, status, horários, promoções e campanhas;
- relatórios, auditoria e configurações.

## Segurança e privacidade

- Cookies seguros, HTTP-only e SameSite; HTTPS/HSTS e CSP.
- Senhas com Argon2id quando aplicáveis; MFA para proprietário.
- Limite de tentativas e proteção contra automação.
- Tokens de QR aleatórios, rotacionáveis e armazenados como hash.
- Dados pessoais mascarados em tela e logs.
- Consentimento do clube, privacidade e marketing separados e versionados.
- Exportação, correção e anonimização conforme a LGPD e obrigações de retenção.
- Backups testados, alertas de certificado e reconciliação periódica do livro.
- Permissões verificadas no servidor, nunca apenas escondendo botões.

## Observabilidade

Alertas devem cobrir falhas de atualização da Wallet, fila acumulada, divergência de contadores, tentativas de duplicidade, crescimento de ajustes manuais, certificado próximo do vencimento e indisponibilidade das APIs.
