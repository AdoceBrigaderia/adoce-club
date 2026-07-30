# Decisões técnicas da reestruturação

- Repositório oficial: `AdoceBrigaderia/adoce-club`.
- Endereço anterior `RMBPS/adoce-club` permanece apenas como redirecionamento histórico e não deve ser usado em novas automações, integrações ou documentação operacional.
- Base preservada: `fonte-oficial/portal-adoce-2026-07-25`.
- Branch de desenvolvimento: `reestruturacao/ux-crm-operacao-imagens-v1`.
- Produção não será alterada durante o desenvolvimento.
- Supabase de homologação será utilizado para migrations e testes.
- Interface prioritária: celular e tablet.
- Imagens serão tratadas como conteúdo administrável, e não como caminhos fixos espalhados pelo código.
- Merge e publicação em produção exigem aprovação expressa, commit exato, backup, rollback e smoke tests.
