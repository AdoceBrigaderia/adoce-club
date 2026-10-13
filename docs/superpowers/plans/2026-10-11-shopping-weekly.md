# Planejamento semanal e lotes sugeridos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Distribuir tortas por dia/semana, manter planejamento compartilhado, imprimir cardápio com logo e sugerir lotes sem alteração automática de estoque.
**Architecture:** Semanas privadas versionadas por data inicial, edições atômicas por campo, tabela de sete dias. Lotes passam por prévia e confirmação, usando rendimento real da ficha G. Logo usa marcador conhecido e raster nativo Android.
**Tech Stack:** React, TypeScript, Supabase/Postgres, Android Java, ESC/POS.
**Spec:** Requisitos do proprietário neste chat em 11/10/2026 e documentação oficial 03/09/22.

## Global Constraints
- Somente D:\AdoceOnLine; preservar alterações existentes.
- Nenhuma publicação, instalação ou migração permanente sem autorização explícita.
- Planejamento e custos exclusivos da gestão; logo oficial e unidades corretas.

## Tasks
- [ ] Testar datas, somas, transferência de quantidades antigas sem duplicação e cardápio.
- [ ] Criar armazenamento por semana e sincronização atômica com cópia opcional sem sobrescrever.
- [ ] Implementar tabela responsiva, seleção de semanas, totais e impressão do cardápio.
- [ ] Integrar sugestão de lotes com confirmação, rendimento verdadeiro, trava de concorrência e proteção de estoque existente.
- [ ] Implementar logo gráfica nativa e validar bytes/compilação Android.
- [ ] Verificar migrações em transação revertida, computador/celular/tablet e release:check.
- [ ] Atualizar documentação e oferecer resultado concreto para autorização de produção.
