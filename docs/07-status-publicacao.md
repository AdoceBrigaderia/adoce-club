---
title: Status da publicação
description: Estado atual dos ambientes públicos, domínios, autenticação e recursos liberados.
status: Produção em evolução
---

# Status da publicação

## Estado em 18/07/2026

O Clube Adoce já ultrapassou a fase de página estática. A estrutura institucional, o ambiente do cliente e a operação da equipe estão publicados, com dados reais no Supabase e autenticação definitiva por e-mail.

| Ambiente | Endereço | Estado atual |
| --- | --- | --- |
| Site oficial | `https://www.adocebrigaderia.com.br` | Publicado com HTTPS |
| Clube Adoce — cliente | `https://clube.adocebrigaderia.com.br` | Publicado e em uso controlado |
| Adoce Operação — equipe | `https://operacao.adocebrigaderia.com.br` | Publicado e em uso controlado |
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

Foi implementada no código a migração do acesso do cliente para celular e senha após a primeira confirmação por e-mail, com opção de manter a sessão e preparação para passkeys. Também foram criados controles protegidos para desativação, reativação, solicitação de exclusão e revisão de duplicidade, sempre com motivo, auditoria e estado da notificação ao cliente. Esta entrega ainda depende de migração controlada do banco, configuração dos segredos e validação com contas de teste antes de ser publicada.

### 20/07/2026 — revisão comercial e imagens em validação

As páginas comerciais foram reorganizadas para apresentar fotos reais sem deformação, usar uma única imagem principal nas categorias de serviço e separar corretamente Festas e Eventos, Adoce na Escola e Aluguel de Decoração. A Festa na Mesa foi direcionada para Adoce na Escola. A operação recebeu controles para trocar fotos, textos, itens incluídos, regras, pacotes e valores. Compra em Grupo, Clube Adoce e o exemplo do Adoce Hoje também receberam imagens coerentes com cada proposta. A publicação depende da conclusão da validação visual e técnica registrada no documento de apresentação comercial e mídias.

### 19/07/2026 — catálogo, agenda e CRM

Foi publicada a base de produção para pedidos por encomenda, produtos e preços administráveis, recheios e adicionais com acréscimos, pré-reservas de 48 horas, conflitos de agenda, bloqueios manuais, histórico de solicitações, notas e tarefas de relacionamento. A página pública separa o Festival de Fatias das encomendas e eventos. O acesso assistido da operação passou a gerar link direto de autenticação, mantendo o código como alternativa. Também foi exportado o kit visual completo para o anúncio oficial do site em Instagram, Facebook e WhatsApp.
