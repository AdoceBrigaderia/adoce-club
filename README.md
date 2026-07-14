# Adoce Fidelidade

MVP funcional e responsivo do programa de fidelidade da Adoce Brigaderia. Inclui adesão pública, cartão web com QR pessoal, atendimento, painel administrativo, livro de movimentações no cliente, regras de saldo testadas, adaptadores de carteira em modo demonstração e geração determinística dos 15 estados visuais.

## Executar localmente

```bash
npm install
npm run generate:assets
npm run dev
```

Acesse `http://localhost:5173`. Atalhos de demonstração:

- `/#card-demo`: cartão com recompensa liberada;
- `/#staff`: atendimento (busque por “Rubens”);
- `/#admin`: painel administrativo.

Para validar: `npm test` e `npm run build`. Com Docker: `docker compose up --build` e acesse `http://localhost:8080`.

## Regras implementadas

- Cada fatia elegível adiciona um carimbo.
- Recompensas são `floor(saldo / 14)`.
- Cada resgate desconta exatamente 14, sem zerar excedentes.
- A mesma chave de idempotência não movimenta duas vezes.
- Movimentações preservam saldo anterior/posterior e não são editadas.
- QR contém token aleatório, nunca dados pessoais ou saldo.
- Consentimento do programa e marketing são separados.

## Arquitetura

O protótipo local usa React + TypeScript e `localStorage` para ser executável sem infraestrutura ou credenciais. O domínio em `src/domain.ts` não depende da interface e está pronto para migração a uma API transacional. O modelo de produção recomendado, contrato de API e estratégia de carteiras estão em `docs/architecture.md`.

Apple Wallet e Google Wallet iniciam explicitamente em modo mock. Publicação real exige credenciais, certificados, domínio HTTPS e aprovação dos emissores; a interface não declara publicação real.

## Dados de demonstração

O seed local cria quatro clientes Rubens com saldos 0, 8, 13 e 14. Os telefones são deliberadamente fictícios e locais ao navegador. Limpe o armazenamento do site para recriar o seed.

## Segurança e privacidade

Não há segredos no repositório. `.env.example` documenta os grupos de configuração. Em produção, sessão de equipe, controle OWNER/MANAGER/ATTENDANT, rate limit, CSRF, CSP, logs mascarados e bloqueio transacional precisam ser aplicados no backend conforme `docs/architecture.md`.
