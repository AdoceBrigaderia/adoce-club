# Cadastro simplificado e validação automática por WhatsApp

## Fluxo público

1. Cliente informa nome, WhatsApp e e-mail.
2. Um único aceite obrigatório cobre os Termos do Clube e a ciência da Política de Privacidade.
3. O consentimento de marketing permanece separado, opcional e desmarcado por padrão.
4. O nome é normalizado no navegador e novamente protegido pelo banco.
5. A Meta WhatsApp Cloud API envia um OTP de seis dígitos.
6. Após confirmar o WhatsApp, o cliente confirma o e-mail.
7. O desafio verificado é vinculado ao perfil autenticado e não pode ser reutilizado por outra conta.

## Contingência

Caso a Meta esteja indisponível, o cliente pode continuar pelo e-mail. Nesse cenário, o cadastro é concluído com o WhatsApp pendente de verificação e a validação poderá ser feita depois.

## Segurança

- OTP armazenado somente como hash.
- Validade de cinco minutos.
- Limite de tentativas e rate limit por telefone e origem.
- Idempotência por solicitação.
- Webhook com assinatura da Meta.
- Vinculação do desafio ao perfil dentro de função PostgreSQL transacional.
- Bloqueio de reutilização e de números já vinculados a outra conta.
- Auditoria da validação e da vinculação.
- Segredos somente em variáveis protegidas do ambiente.

## Variáveis necessárias para ativação real

- `META_WA_ACCESS_TOKEN`
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_WABA_ID`
- `META_WA_APP_SECRET`
- `META_WA_VERIFY_TOKEN`
- `META_WA_AUTH_TEMPLATE_NAME`
- `META_WA_GRAPH_API_VERSION`
- `WHATSAPP_OTP_PEPPER`

Até essas variáveis serem configuradas, a interface apresenta a contingência por e-mail sem bloquear os demais fluxos.
