# Canais de e-mail da Adoce Brigaderia

Este documento registra os grupos corporativos já criados no Google Workspace. Ele não contém senhas, tokens ou informações de administração do domínio.

## Endereços oficiais

| Grupo | Endereço | Uso no Portal Adoce |
| --- | --- | --- |
| Atendimento Adoce | `atendimento@adocebrigaderia.com.br` | contato público, dúvidas sobre o Clube, reclamações, sugestões e contingência quando o formulário estiver indisponível |
| Financeiro Adoce | `financeiro@adocebrigaderia.com.br` | cobranças, fornecedores, comprovantes, notas e comunicações financeiras internas |
| Alertas do Sistema Adoce | `alertas@adocebrigaderia.com.br` | falhas técnicas, segurança, integrações, jobs e incidentes operacionais; não deve aparecer publicamente |
| Privacidade Adoce | `privacidade@adocebrigaderia.com.br` | solicitações de acesso, correção, exclusão, consentimento e demais direitos relacionados a dados pessoais |

Rubens e Beth devem permanecer como proprietários dos grupos. O grupo de atendimento pode operar como caixa de entrada colaborativa para evitar respostas duplicadas.

## Regras de integração

- O Portal não deve armazenar nem utilizar as senhas pessoais do Google Workspace.
- `rubens@adocebrigaderia.com.br` e `beth@adocebrigaderia.com.br` são identidades administrativas, não remetentes automáticos do sistema.
- Mensagens transacionais futuras devem usar um provedor próprio e um remetente técnico separado, com SPF, DKIM e DMARC.
- O endereço `alertas@` pode receber notificações de Netlify, Supabase, Meta, Google Wallet e do monitoramento do Portal.
- O endereço `financeiro@` não deve ser exposto em páginas públicas sem necessidade específica.
- O endereço `privacidade@` deve permanecer visível na Política de Privacidade.
- Todos os links públicos devem ser derivados de `src/business-contacts.ts`, evitando endereços pessoais espalhados pelo código.

## Situação implementada

- Política de Privacidade direciona solicitações para `privacidade@`.
- Termos do Clube direcionam dúvidas para `atendimento@`.
- O formulário de reclamações e sugestões oferece `atendimento@` como contingência quando a Function estiver indisponível.
- O menu flutuante de contatos inclui o e-mail oficial de atendimento.
- Testes impedem a volta do endereço pessoal anteriormente utilizado.

## Pendências futuras

- escolher e configurar o provedor de e-mail transacional;
- definir remetente técnico em subdomínio próprio;
- criar notificações de segurança e operação para `alertas@`;
- criar notificações financeiras estritamente necessárias para `financeiro@`;
- validar entrega, SPF, DKIM, DMARC, bounce e reclamações antes de produção.

Nenhuma credencial do Google Workspace deve ser versionada, enviada por chat ou colocada no frontend.
