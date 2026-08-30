---
title: Simplificação da operação em 26/08/2026
description: Registro auditável do corte funcional realizado somente na homologação local.
status: Implementado localmente, aguardando aceite e publicação autorizada
---

# Simplificação da operação em 26/08/2026

## Resultado

A cópia local de homologação foi reduzida para cinco áreas: **Hoje, Pedidos, Produtos, Clientes e Configurações**. A Agenda foi excluída completamente da interface e do código executável; não foi conservada com outro nome.

## Removido

- Agenda e capacidade de encomendas em calendário;
- Pede Junto e seus fluxos público, operacional e de pagamento;
- Financeiro e arquivo como áreas independentes;
- central avançada de notificações e promoções públicas;
- campanhas e configuração visual duplicada;
- catálogo Meta, webhooks Meta/Instagram e sincronização relacionada;
- piloto de autenticação por WhatsApp e hook de SMS associado;
- restauração de produção pela aplicação;
- protótipo paralelo `operation-v2`.

## Reorganizado sem criar novas áreas

- pedidos futuros, pré-reservas, histórico, notas, lembretes e cancelamento ficam em Pedidos;
- sabores, disponibilidade, conteúdo diário e catálogo comercial ficam em Produtos;
- funcionamento e exceções ficam em Configurações;
- equipe fica em Configurações e é visível apenas ao proprietário;
- histórico do Clube permanece dentro do cliente selecionado.

## Limites de segurança

- trabalho realizado somente em `D:\Clube Adoce Replica Local\app\working-copy`;
- nenhuma alteração em produção;
- nenhum deploy executado;
- nenhuma migration ou trilha de auditoria apagada;
- mudanças locais são recuperáveis pelo histórico Git.

## Aceite exigido

Antes de qualquer publicação: lint, suíte completa, build, verificação de release e QA visual mobile/tablet/desktop devem passar. A publicação continua dependendo de explicação prévia e autorização explícita.

## Evidência local desta execução

- lint aprovado;
- 97 arquivos de teste e 613 testes aprovados;
- bundle Vite aprovado, com 2.231 módulos transformados;
- QA visual aprovado em 320, 360, 375, 390, 412, 430, 768, 1024 e 1280 px;
- 45 trocas de área verificadas, sem overflow, Agenda visível, overlay ou erro de console;
- portão `release:check` bloqueado somente na etapa SEO porque o Supabase local em `127.0.0.1:54321` estava desligado e retornou 0 dos 26 sabores mínimos.

Não houve validação com dados reais, Safari em iPhone físico ou publicação remota nesta execução.
