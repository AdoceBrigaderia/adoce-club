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
