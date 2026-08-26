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

- Projeto Supabase Free criado em São Paulo e conectado à aplicação.
- Migração inicial aplicada, com 18 tabelas públicas protegidas por RLS.
- Migração temporária do piloto do festival aplicada e versionada.
- Cliente Supabase preparado sem segredos no código.
- Normalização de telefone e início do fluxo OTP implementados e testados.
- Piloto funcional publicado separadamente em `https://clube-adoce-piloto.netlify.app/#festival`.
- Fluxo real validado: 14 carimbos completam um cartão, liberam um prêmio acumulável e o resgate não interrompe o próximo ciclo.
- Migração para o Pro planejada para 6 meses e obrigatória em até 12 meses.
- Site institucional oficial permanece separado e não foi substituído pelo piloto.

## Limites conscientes do piloto

O acesso por código compartilhado é temporário e exclusivo para a validação do festival. Ainda não fazem parte desta entrega de emergência: login individual de funcionário, OTP do cliente, Wallet, Cartão em Grupo, Espalhe Doçura, sabores do dia e administração completa. Esses recursos continuam no roadmap oficial e serão liberados por etapas depois da validação operacional.

## Avanço da autenticação e da operação — 17/07/2026

O acesso definitivo por e-mail foi configurado e validado de ponta a ponta:

- domínio `auth.adocebrigaderia.com.br` verificado no Resend;
- SMTP próprio integrado ao Supabase;
- remetente `acesso@auth.adocebrigaderia.com.br`;
- código de acesso com seis dígitos e validade de dez minutos;
- modelos de autenticação e segurança personalizados em português;
- URLs oficiais de redirecionamento autorizadas;
- Francisco Rubens Pereira Bezerra Filho e Elizabeth Cristina Sampaio Nascimento registrados como proprietários com acesso total e contas individuais;
- primeiro acesso do proprietário validado com recebimento imediato do e-mail.

A fundação de dados também passou a contemplar:

- campos opcionais de relacionamento e perfil do cliente;
- catálogo com preço, descrição comercial e várias fotos por sabor;
- horários regulares e exceções por canal de atendimento;
- busca segura de clientes pela equipe;
- painéis conectados para cliente e operação;
- página pública `Adoce Hoje` conectada ao catálogo e ao status dos canais;
- nova versão da página oficial com fase atual, prévias das telas, benefícios e chamadas para cadastro e acesso.

O WhatsApp permanece como próxima integração de autenticação. Até a conclusão da configuração Meta, o e-mail é o canal definitivo disponível.
