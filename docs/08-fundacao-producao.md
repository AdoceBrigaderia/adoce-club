---
title: Fundação de produção
description: Decisões técnicas, ambientes, custos e estado da implantação real do Clube Adoce.
status: Em implementação
---

# Fundação de produção

## Decisão de arquitetura

A implementação real utilizará:

- **Netlify** para a aplicação web responsiva, arquivos públicos e funções específicas de integração.
- **Supabase** para PostgreSQL, autenticação, armazenamento de mídia e eventos em tempo real.
- **Migrações versionadas no GitHub** para que o banco possa ser reconstruído e auditado.
- **Row Level Security (RLS)** em todas as tabelas expostas.
- **Chaves públicas no navegador** e segredos somente nos cofres do Netlify e do Supabase.

A landing atual continuará isolada durante a construção. A recomendação é publicar o sistema em **clube.adocebrigaderia.com.br** e somente alterar a página oficial quando cada etapa estiver aprovada.

## Ambientes

| Ambiente | Finalidade | Dados reais? |
| --- | --- | --- |
| Local | Desenvolvimento e testes automatizados | Não |
| Preview | Revisão antes de publicar | Não |
| Produção | Uso por clientes e equipe | Sim |

## Banco inicial

A primeira migração já modela:

- pessoas, consentimentos e funcionários;
- contas individuais e Cartão em Grupo;
- trilhas Meu Cartão e Espalhe Doçura;
- livro imutável de carimbos;
- cartões completados e prêmios acumuláveis;
- compra tradicional ou premium valendo 1 carimbo;
- prêmio tradicional ou premium mediante pagamento da diferença;
- indicações e bônus dos dois participantes;
- convites de grupo;
- Apple Wallet e Google Wallet;
- status da loja e dos canais;
- sabores do dia;
- promoções;
- auditoria e fila de atualizações.

## Autenticação

O fluxo previsto é telefone com código temporário. O provedor de SMS ainda precisa ser contratado e configurado. O telefone não será usado sozinho como prova permanente de identidade para ações sensíveis da equipe.

## Custo estimado do backend

Em 16/07/2026, o Supabase informa:

- plano Free: US$ 0, sujeito a pausa após uma semana de inatividade e sem backups automáticos;
- plano Pro: a partir de US$ 25 por mês, incluindo um projeto Micro dentro dos créditos de computação e backups diários;
- o envio de SMS é cobrado separadamente pelo provedor escolhido.

### Estratégia aprovada de implantação

- Iniciar no plano Free para preservar o caixa durante a implantação.
- Permanecer no Free por no máximo 12 meses.
- Meta preferencial: migrar para o Pro em aproximadamente 6 meses.
- Antecipar a migração se o banco atingir 250 MB, se o tráfego atingir 60% da franquia ou se a indisponibilidade passar a afetar a operação.
- Manter backup externo recorrente enquanto não houver backups automáticos do plano Pro.
- Ativar limite de gastos ao migrar para o Pro.

Com 390 fatias por semana e projeção de 500, a capacidade do Free é suficiente para esse período mesmo no cenário conservador em que cada fatia gere uma operação individual.

## Estado atual

- Migração inicial criada localmente e versionável.
- Cliente Supabase preparado sem segredos no código.
- Normalização de telefone e início do fluxo OTP implementados e testados.
- Projeto Supabase Free em São Paulo aguardando criação.
- Migração para o Pro planejada para 6 meses e obrigatória em até 12 meses.
- Aplicação atual continua em modo de demonstração até a conexão com o projeto real.