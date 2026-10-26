---
title: Guia de entrega para outra IA
description: Ordem de leitura, limites, método de revisão e formato de resposta para agentes externos.
status: Norma oficial
---

# Guia de entrega para outra IA

## Ordem de leitura

1. `AGENTS.md`;
2. `docs/documentation-manifest.json`;
3. capítulos oficiais relacionados à tarefa;
4. código, testes e migrações correspondentes;
5. comportamento renderizado;
6. produção somente quando autorizada.

## Instrução recomendada

> Compare documentação, código, banco e interface. Não trate afirmações históricas como evidência atual. Preserve a separação entre cliente e operação. Classifique cada conclusão como implementada, automaticamente validada, visualmente validada, funcionalmente validada, confirmada em produção, parcial ou bloqueada. Não crie homologação online, Deploy Preview, branch deploy ou alias público. Antes de toda modificação em produção, peça autorização explícita ao proprietário. Só apresente a solução como concluída depois de comprová-la e, quando a publicação for autorizada, verificá-la no domínio oficial.

## O que uma revisão deve procurar

- diferença entre regra documentada e implementação;
- controles visíveis que não executam ação;
- ação executada sem retorno ao usuário;
- dados que somem ou duplicam após recarga;
- rotas internas expostas publicamente;
- imagens fixas fora do gerenciamento da operação;
- textos técnicos ou sem próximo passo;
- telas móveis com sobreposição, corte ou ação escondida;
- RLS insuficiente, função pública ou segredo exposto;
- status documental incompatível com evidência.

## Formato de resposta

1. achados por prioridade;
2. reprodução;
3. evidência;
4. causa provável;
5. correção aplicada ou recomendada;
6. validação realizada;
7. riscos restantes.

## Antes de presumir o que está em produção

Não confie apenas na documentação ou no histórico do Git local para decidir se algo já foi publicado. Em 17/10/2026, uma publicação isolada presumiu que uma integração não estava em produção porque a documentação dizia "pendente" — mas a Netlify tinha dois deploys de 16/10/2026 que nenhum documento registrou, e o deploy isolado reverteu funções já publicadas. Antes de isolar um deploy ou de tratar algo como "ainda não publicado", compare o histórico real de deploys (`netlify-cli api listSiteDeploys` e `getDeploy`, hash das funções publicadas) com o código local. Publicações diretas por `npm run release:prod`, fora do fluxo documentado, já aconteceram sem deixar rastro automático aqui.

## Proibições

- Não corrigir dados reais de forma destrutiva sem autorização.
- Não afirmar conclusão usando apenas build.
- Não confundir prévia local com produção e nunca publicar uma prévia online.
- Não editar manualmente o HTML consolidado.
- Não colocar linguagem, métricas ou rotinas da equipe no site público.


### 08/10/2026 — fonte única determinada pelo proprietário

Todo desenvolvimento, teste, revisão e publicação deste site deve usar exclusivamente `D:\AdoceOnLine`. É proibido criar outra cópia completa, pasta de release, réplica ou worktree para atualizar o produto. Histórico deve ser preservado no Git da pasta principal. A pasta `android` é um componente do mesmo produto, não outra fonte de desenvolvimento.

Os comandos de desenvolvimento, testes, verificação, compilação e publicação verificam o caminho canônico antes de continuar. Cópias completas internas e cópias irmãs do mesmo projeto no volume da fonte oficial bloqueiam a validação. Uma marca de desativação não autoriza manter fonte paralela: compare o conteúdo, incorpore o que for válido ao Git principal e remova a cópia física.

Em 13/10/2026, as cópias inventariadas foram comparadas e removidas. Qualquer agente que precise preservar uma tentativa deve usar commit ou branch no repositório principal, sem criar outro checkout, pasta de release ou worktree.

### 21/10/2026 — dois agentes de IA na mesma pasta, ao mesmo tempo

O proprietário pode ter mais de um agente (esta IA, outra IA como o Codex, ou os dois ao mesmo tempo) trabalhando em `D:\AdoceOnLine` na mesma sessão de trabalho. A fonte é sempre uma só — nunca duas versões do código — então a disciplina abaixo é obrigatória para qualquer agente que edite arquivos aqui:

1. **Antes de editar qualquer arquivo**, rode `git status`. Se houver alterações não commitadas que você não fez e não reconhece, **não são lixo** — são o trabalho do outro agente em andamento. Não descarte (`git checkout --`, `git reset --hard`, `git clean`) nem sobrescreva sem necessidade.
2. **Edite só os arquivos da sua tarefa.** Se precisar mudar um arquivo que já tem alteração não commitada de outro agente, preserve o conteúdo dele: leia o arquivo atual (que já inclui a mudança alheia), aplique sua edição em cima, nunca restaure uma versão antiga por cima do trabalho do outro.
3. **Antes de publicar (`npm run release:prod`) ou de aplicar migração em produção**, isole: `git stash push -u` nos arquivos que não são da sua tarefa (liste-os explicitamente, nunca `git stash` sem `--`), confira com `git status` que a árvore ficou só com o seu trabalho, publique, depois `git stash pop` para devolver o que estava solto. Se der conflito no pop (porque você mudou um arquivo que também estava no stash), resolva preservando as duas mudanças — nunca descarte uma das duas silenciosamente; se o conflito for sobre a mesma lógica/funcionalidade, avise o proprietário em vez de decidir sozinho qual versão vale.
4. **Nunca deixe uma pilha grande de alterações não commitadas por muito tempo.** Assim que uma tarefa sua estiver pronta e validada, commit. Isso reduz a chance de colisão com o outro agente e torna qualquer conflito visível no `git diff`/merge em vez de silencioso.
5. **Nunca invente um commit em nome do outro agente nem reescreva o histórico dele** (sem `commit --amend` ou rebase em commits que você não fez).
6. Este repositório tem três remotos configurados (`git remote -v`): `adoce-oficial` (`github.com/AdoceBrigaderia/adoce-club`), `fonte-oficial` (`github.com/RMBPS/adoce-club`) e `origin` (`github.com/RMBPS/clube-adoce`), além de várias branches `codex/...` antigas, algumas só locais, outras só em um remoto. Nenhum agente deve dar `push`, criar branch remota ou mudar remotos sem autorização explícita do proprietário — isso ainda não foi esclarecido com ele e pode apontar pro lugar errado.
