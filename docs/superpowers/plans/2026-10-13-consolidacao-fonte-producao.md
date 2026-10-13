# Consolidação da Fonte e Produção Adoce — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar `D:\AdoceOnLine` a única fonte do sistema Adoce, preservar o trabalho válido, alinhar código, banco e produção e terminar com tudo versionado e verificável.

**Architecture:** O diretório principal permanece como checkout único. A consolidação usa os testes e os bloqueios de publicação existentes, compara a publicação atual e o Supabase antes de qualquer mudança remota, elimina cópias somente depois do inventário e publica um pacote atômico a partir da fonte oficial.

**Tech Stack:** React, TypeScript, Vite, Vitest, Netlify, Supabase/PostgreSQL e Capacitor Android.

**Spec:** `AGENTS.md`

## Global Constraints

- O único diretório autorizado é `D:\AdoceOnLine`; não criar worktree, cópia de release ou checkout paralelo.
- Preservar dados reais, isolamento de acesso, RLS, histórico financeiro e rastreabilidade operacional.
- Não deixar arquivo novo ou alteração sem commit.
- Excluir as demais cópias somente após comprovar que não contêm trabalho válido ausente da fonte oficial.
- Executar `npm run release:check` e verificar produção depois da publicação.

## Review Focus

- Uma cópia antiga não pode substituir código mais novo da Operação.
- Migrações com timestamps locais e remotos diferentes devem ser comparadas pelo efeito real no banco.
- Cadastros removidos não podem reaparecer em buscas, caixa, QR ou seletores.
- O pacote publicado deve conter as funções de custos, compras, impressão e atendimento presentes no código validado.
- O checkout final deve ficar limpo e o verificador deve rejeitar qualquer nova cópia executável.

---

### Task 1: Inventário e comparação

**Files:**
- Modify: `docs/07-status-publicacao.md`
- Modify: `docs/18-guia-de-entrega-para-outra-ia.md`

- [ ] Registrar a fonte oficial, o deploy encontrado, o estado do banco e as cópias localizadas.
- [ ] Comparar arquivos exclusivos antes de remover qualquer diretório.
- [ ] Executar o portão de publicação como linha de base.

### Task 2: Consolidação e proteção

**Files:**
- Modify: `scripts/verify-primary-workspace.mjs`
- Modify: `scripts/remover-copias-adoce.ps1`
- Test: `src/primary-workspace.test.ts`

- [ ] Confirmar por teste que apenas o diretório oficial pode executar o projeto.
- [ ] Remover cópias antigas e artefatos rejeitados após a comparação.
- [ ] Manter as regras de fonte única visíveis no `AGENTS.md` e na documentação de entrega.

### Task 3: Banco e aplicação

**Files:**
- Modify: `supabase/migrations/*.sql`
- Modify: `src/**/*`
- Test: `src/**/*.test.ts`

- [ ] Comparar o efeito das migrações locais com o esquema remoto antes de aplicar qualquer pendência.
- [ ] Corrigir somente divergências reproduzidas por teste.
- [ ] Rodar testes, tipos, build, verificador da Operação e verificações de segurança do banco.

### Task 4: Versionamento e produção

**Files:**
- Modify: `docs/07-status-publicacao.md`
- Modify: `docs/clube-adoce-documentacao.html`
- Modify: `public/documentacao.html`

- [ ] Gerar novamente a documentação oficial e consolidar todo o trabalho válido em commits.
- [ ] Publicar no Netlify apenas a partir de `D:\AdoceOnLine` após o portão completo.
- [ ] Comparar os ativos publicados com o build validado e testar as rotas críticas.
- [ ] Confirmar `git status` limpo e ausência de qualquer outra cópia executável.
