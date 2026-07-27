# Publicação controlada em produção

Produção não pode ser publicada apenas porque os testes passaram. O comando de deploy produtivo possui um segundo portão, separado do gate técnico de homologação.

## Condições obrigatórias

Antes de executar `npm run release:prod`, devem existir simultaneamente:

- aprovação expressa do responsável;
- commit exato vinculado à aprovação;
- aprovação emitida nas últimas 24 horas;
- backup confirmado;
- rollback confirmado;
- plano de smoke tests confirmado;
- gate integral `npm run verify` aprovado.

## Variáveis temporárias do portão

As variáveis abaixo devem ser definidas somente para a execução autorizada:

```text
ADOCE_PRODUCTION_APPROVAL=PRODUCAO_APROVADA_EXPRESSAMENTE
ADOCE_PRODUCTION_APPROVED_BY=<responsável>
ADOCE_PRODUCTION_COMMIT=<SHA completo aprovado>
ADOCE_PRODUCTION_APPROVAL_AT=<data e hora ISO-8601>
ADOCE_PRODUCTION_BACKUP_CONFIRMED=sim
ADOCE_PRODUCTION_ROLLBACK_CONFIRMED=sim
ADOCE_PRODUCTION_SMOKE_PLAN_CONFIRMED=sim
```

Não salvar essas confirmações permanentemente na Netlify ou no GitHub. Elas representam uma aprovação específica e expiram em 24 horas.

## Sequência de liberação

1. Congelar o commit aprovado.
2. Confirmar o backup do banco e dos artefatos atuais.
3. Registrar as migrations que serão aplicadas.
4. Confirmar o procedimento de rollback.
5. Executar o gate integral.
6. Executar o deploy produtivo com as confirmações temporárias.
7. Aplicar smoke tests imediatamente.
8. Reverter caso qualquer smoke test crítico falhe.

## Smoke tests mínimos

- página pública e imagens;
- cadastro e login do cliente;
- login da operação;
- passkey e fallback por senha;
- check-in NFC/QR;
- fidelidade manual;
- venda rápida;
- caixa e reconciliação;
- pedido público;
- WhatsApp OTP, quando ativo;
- cartão Google Wallet, quando ativo;
- headers de segurança e ausência de erros críticos no navegador.

O script apenas impede publicação acidental. Ele não substitui backup, validação humana, migrations controladas ou rollback.
