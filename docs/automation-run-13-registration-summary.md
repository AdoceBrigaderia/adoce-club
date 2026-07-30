# Marco: cadastro simplificado com WhatsApp OTP automático

- Nova rota pública exclusiva para cadastro.
- Um único aceite obrigatório reúne Termos e Política de Privacidade.
- Marketing pelo WhatsApp permanece opcional e desmarcado.
- Nome normalizado antes do envio e protegido também no banco.
- OTP automático usa Meta WhatsApp Cloud API com contingência por e-mail.
- Desafio verificado é vinculado ao perfil autenticado por função PostgreSQL transacional.
- Reutilização do desafio e número já vinculado a outra conta são bloqueados.
- Migration aplicada somente no Supabase de homologação.
- TypeScript, Vitest, auditorias, build e gate de segurança aprovados nos dois pipelines.

Produção não foi acessada, migrada ou publicada.
