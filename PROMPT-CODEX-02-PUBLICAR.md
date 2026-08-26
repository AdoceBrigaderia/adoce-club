# Prompt 2 para o Codex — publicar homologação pelo Git
**Preparado em 07/08/2026, após o diagnóstico** · Cole tudo abaixo da linha.

---

Obrigado pelo diagnóstico. Ele estava correto e mudou o plano. Decisões tomadas pelo Rubens a partir dele:

## Decisões

**1. A linhagem oficial é a cópia local `D:\Clube Adoce`.**
É a que corresponde às 152 migrações aplicadas no banco de homologação e a que contém a integração Meta/Instagram publicada.

**2. A branch `homologacao/redesign-aprovado-v2` está ABANDONADA. Nada dela entra.**
O Rubens descartou aquele escopo deliberadamente — o trabalho de 29/07 (escopo por loja, relatórios, travas de RPC) não é a direção do produto. **Não faça merge, não faça cherry-pick, não traga nenhuma das 14 migrações exclusivas dela.** Deixe a branch existir, intocada, como histórico.

**3. `fix/catalogo-fotos-e-home-story-2026-08-06` é idêntica a `homologacao-adoce` e não tem trabalho exclusivo.** Pode ignorar.

**4. O nome da migração já foi corrigido.** O arquivo local foi renomeado de `20260807120000_...` para `20260807114331_release_production_all_channels.sql`, batendo com o registro no banco. **Não mexa mais nisso.** Confirme apenas que o arquivo com esse nome existe e que o de `120000` não existe mais.

---

## Tarefas

### 1. Normalizar fim de linha (commit isolado)

Criar `.gitattributes` na raiz:

```
* text=auto
*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.ico binary
```

Rodar `git add --renormalize .` e commitar **sozinho**, mensagem sugerida:
`chore: normaliza fim de linha com .gitattributes`

Isso deve resolver a maior parte dos 137 arquivos "modificados" que na verdade só mudaram de `LF` para `CRLF`.

### 2. Limpar worktrees órfãs

```
git worktree prune
git branch -D adoce/melhorias-07-08
```

Se travar, apague manualmente os arquivos de bloqueio em `.git/worktrees/adoce-wt` e `/tmp/adoce-wt`, depois repita. **Não apague nenhuma outra branch.**

### 3. Reconciliar a homologação no Git

Objetivo: fazer `adoce-oficial/homologacao-adoce` refletir o que está publicado hoje, para que o deploy volte a ser por Git em vez de CLI manual.

Caminho sugerido (avalie e proponha melhor se enxergar):

1. Criar branch a partir de `adoce-oficial/homologacao-adoce`
2. Trazer da cópia local o que falta — as **12 migrações exclusivas**, as **funções Netlify da Meta/Instagram**, e o código-fonte correspondente
3. **Não sobrescrever arquivos em massa.** Onde houver divergência real de conteúdo em `.tsx`, analise e reconcilie arquivo a arquivo
4. Abrir PR em `AdoceBrigaderia/adoce-club` em vez de push direto, para o Rubens revisar o diff antes

Se em algum arquivo a reconciliação for ambígua, **pare e pergunte** em vez de escolher sozinho.

### 4. Incluir o trabalho de 07/08

Estes 12 arquivos precisam entrar (lista completa e explicação de cada um estão em `PROMPT-PARA-O-CODEX.md`, seção "Tarefa 4"):

```
src/adoce-tokens.css                (novo)
src/pickup-window.ts                (novo)
src/pickup-window.test.ts           (novo)
src/RequestQuoteDocument.tsx        (novo)
src/request-quote-document.css      (novo)
src/request-quote-document.test.ts  (novo)
supabase/migrations/20260807114331_release_production_all_channels.sql  (novo, renomeado)
src/main.tsx                        (modificado — import dos tokens por último, de propósito)
src/AdoceHoje.tsx                   (modificado — poucas linhas)
src/InstantOrderPanel.tsx           (modificado — poucas linhas)
src/WeeklyMenuAdmin.tsx             (modificado — poucas linhas)
src/OperationCommercialAdmin.tsx    (modificado — poucas linhas)
```

### 5. Verificar e publicar

Rodar e reportar: `npx tsc -b`, `npx vitest run` (esperado **295/295**), `npx vite build`.
Depois do merge do PR, confirmar que o deploy automático do Netlify passou e informar a URL.

---

## O que NÃO fazer

🚫 **Não toque em produção.** Nem o banco `uefwywizqhfvvijaopcn` (93 migrações pendentes — decisão do Rubens de adiar), nem o site `adocebrigaderia` / www.adocebrigaderia.com.br.

🚫 **Não traga nada de `homologacao/redesign-aprovado-v2`.**

🚫 **Não altere as variáveis do Mercado Pago** em `adoce-homologacao` (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `VITE_MP_PUBLIC_KEY`).

🚫 **Não apague branches** além de `adoce/melhorias-07-08`.

🚫 **Não faça push direto na `homologacao-adoce`.** Abra PR.

---

## Ao terminar, responda

1. O PR foi aberto? Qual o link e quantos arquivos ele toca?
2. Houve algum arquivo onde a reconciliação foi ambígua? Quais e por quê?
3. `.gitattributes` resolveu quantos dos 137 arquivos? Sobrou algum com mudança real de conteúdo?
4. Testes: passou 295/295?
5. Depois do merge, o deploy do Netlify passou? URL para o Rubens testar no celular.
