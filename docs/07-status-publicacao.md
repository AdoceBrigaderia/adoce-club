---
title: Status da publicação
description: Estado atual dos ambientes públicos, domínios, autenticação e recursos liberados.
status: Produção em evolução
---

# Status da publicação

### 20/07/2026 — Pede Junto Adoce publicado

O produto anterior de pedido coletivo foi substituído pelo Pede Junto Adoce em todo o site. A experiência permite sala compartilhada sem limite coletivo de fatias, entrega grátis liberada na quinta unidade, continuidade do grupo após a meta, escolha separada por participante e pagamento individual. A operação recebeu controle de estoque, reservas, participantes, links do Mercado Pago e evolução do pedido. O banco e o frontend foram publicados, e o fluxo real foi validado com dez fatias em computador, tablet e celular. O grupo e o estoque criados exclusivamente para o teste foram removidos após a conferência.

## Estado em 18/07/2026

O Clube Adoce já ultrapassou a fase de página estática. A estrutura institucional, o ambiente do cliente e a operação da equipe estão publicados, com dados reais no Supabase e autenticação definitiva por e-mail.

| Ambiente | Endereço | Estado atual |
| --- | --- | --- |
| Site oficial | `https://www.adocebrigaderia.com.br` | Publicado com HTTPS |
| Clube Adoce — cliente | `https://www.adocebrigaderia.com.br/#entrar` | Publicado; `clube.adocebrigaderia.com.br` aguarda registro DNS |
| Adoce Operação — equipe | `https://www.adocebrigaderia.com.br/#operacao` | Publicado; `operacao.adocebrigaderia.com.br` aguarda registro DNS |
| Autenticação por e-mail | `auth.adocebrigaderia.com.br` | Domínio verificado e remetente ativo |
| Backend e banco de dados | Supabase, região de São Paulo | Produção ativa no plano Free |

O domínio principal e os subdomínios utilizam HTTPS. O DNS permanece administrado no Registro.br, e a aplicação web é entregue pela Netlify.

## Recursos já disponíveis

- cadastro e acesso do cliente por código enviado por e-mail;
- conclusão obrigatória do perfil antes da liberação completa do cartão;
- cartão fidelidade principal com uma fatia igual a um carimbo;
- conclusão automática do cartão ao atingir 14 carimbos;
- prêmio acumulável, sem obrigar retirada imediata;
- resgate de fatia tradicional ou premium mediante pagamento da diferença;
- cartão exclusivo de indicações **Espalhe Doçura**;
- convite por link pessoal, com vínculo automático da indicação;
- QR Code do cliente e busca alternativa por parte do nome, telefone ou e-mail;
- registro de compras e resgates pela equipe;
- histórico e auditoria das movimentações;
- perfis de Proprietário, Gerente e Atendimento;
- página pública **Adoce Hoje** com catálogo, disponibilidade e canais de atendimento;
- instalação como aplicativo web no Android e no iPhone, respeitando as orientações próprias de cada sistema;
- administração do Adoce Hoje pela equipe, incluindo produtos, fotos, disponibilidade, horários, canais e promoções.

## Em evolução e ainda não anunciado como concluído

- Apple Wallet e Google Wallet como acesso principal ao cartão;
- Cartão em Grupo para casais, famílias e grupos de amigos;
- notificações de sabores, horários e promoções conforme as preferências do cliente;
- integração de autenticação e comunicação pelo WhatsApp;
- ampliação das rotinas administrativas e relatórios do CRM;
- revisão contínua de responsividade, acessibilidade e experiência em diferentes aparelhos.

## Histórico resumido

### 14/07/2026 — apresentação institucional

Foi publicada a primeira apresentação oficial na direção visual **Chocolate Depois das Oito**, com domínio próprio ainda em configuração.

### 16/07/2026 — piloto funcional

O primeiro piloto com dados reais validou cadastro, carimbos, conclusão de cartão, prêmio acumulável e resgate sem interromper o ciclo seguinte.

### 17/07/2026 — autenticação e operação reais

O domínio de envio foi verificado no Resend, o SMTP foi integrado ao Supabase e o acesso definitivo por código de e-mail entrou em funcionamento. Cliente, operação, Adoce Hoje, QR Code e indicações passaram a ser testados em situação real.

### 18/07/2026 — administração do Adoce Hoje

A operação recebeu os recursos para administrar produtos, várias fotos por sabor, disponibilidade, horários, canais e promoções sem depender de uma alteração manual no código a cada atualização cotidiana.

## Regra de publicação

Novos recursos só devem ser apresentados ao público como disponíveis depois de passarem por validação funcional no ambiente de produção. Funcionalidades ainda em construção devem permanecer identificadas como próximas etapas, sem induzir o cliente a acreditar que já estão liberadas.

### 20/07/2026 — reforço de identidade e segurança em validação

Foi implementada a migração do acesso do cliente para celular e senha após a primeira confirmação por e-mail, com opção de manter a sessão e preparação para passkeys. Também foram criados controles protegidos para desativação, reativação, solicitação de exclusão e revisão de duplicidade, sempre com motivo, auditoria e estado da notificação ao cliente. Em 20/07/2026, as migrações foram aplicadas no projeto de produção, os 21 perfis existentes foram preservados e a chave segura do servidor foi configurada na Netlify. A entrega ainda depende da validação final dos fluxos nos domínios oficiais.

### 20/07/2026 — revisão comercial e imagens publicadas

As páginas comerciais foram reorganizadas para apresentar fotos reais sem deformação, usar uma única imagem principal nas categorias de serviço e separar corretamente Festas e Eventos, Adoce na Escola e Aluguel de Decoração. A Festa na Mesa foi direcionada para Mini Festas, dentro de Festas e Eventos. A operação recebeu controles para trocar fotos, textos, itens incluídos, regras, pacotes e valores. Pede Junto Adoce, Clube Adoce e o exemplo do Adoce Hoje também receberam imagens coerentes com cada proposta. A estrutura de mídias e os vínculos corretos das fotografias foram aplicados ao banco em 20/07/2026; resta a validação final após a publicação do frontend.

### 20/07/2026 — publicação e conferência final da vitrine

A revisão comercial foi publicada no domínio principal e conferida em telas de computador e celular. Foram validados: imagens completas dos docinhos, foto única nos serviços, separação entre Eventos e Escola, apresentação anterior do pedido coletivo, exemplo ilustrativo do Adoce Hoje, login do cliente por celular e senha, linguagem própria da operação e funções protegidas no servidor. A inspeção não encontrou erros no navegador. A verificação de DNS confirmou que os subdomínios `clube` e `operacao` ainda precisam ser criados; até lá, as rotas oficiais permanecem disponíveis no domínio principal.

### 19/07/2026 — catálogo, agenda e CRM

Foi publicada a base de produção para pedidos por encomenda, produtos e preços administráveis, recheios e adicionais com acréscimos, pré-reservas de 48 horas, conflitos de agenda, bloqueios manuais, histórico de solicitações, notas e tarefas de relacionamento. A página pública separa o Festival de Fatias das encomendas e eventos. O acesso assistido da operação passou a gerar link direto de autenticação, mantendo o código como alternativa. Também foi exportado o kit visual completo para o anúncio oficial do site em Instagram, Facebook e WhatsApp.
