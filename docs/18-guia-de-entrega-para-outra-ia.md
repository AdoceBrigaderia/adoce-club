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

> Compare documentação, código, banco e interface. Não trate afirmações históricas como evidência atual. Preserve a separação entre cliente e operação. Classifique cada conclusão como implementada, automaticamente validada, visualmente validada, funcionalmente validada, confirmada em produção, parcial ou bloqueada. Não publique sem autorização.

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

## Proibições

- Não corrigir dados reais de forma destrutiva sem autorização.
- Não afirmar conclusão usando apenas build.
- Não confundir prévia com produção.
- Não editar manualmente o HTML consolidado.
- Não colocar linguagem, métricas ou rotinas da equipe no site público.


### 08/10/2026 — fonte única determinada pelo proprietário

Todo desenvolvimento, teste, revisão e publicação deste site deve usar exclusivamente `D:\AdoceOnLine`. É proibido criar outra cópia completa, pasta de release, réplica ou worktree para atualizar o produto. Histórico deve ser preservado no Git da pasta principal. A pasta `android` é um componente do mesmo produto, não outra fonte de desenvolvimento.

Os comandos de desenvolvimento, testes, verificação, compilação e publicação verificam o caminho canônico antes de continuar. Cópias completas internas e cópias irmãs do mesmo projeto no volume da fonte oficial bloqueiam a validação. Uma marca de desativação não autoriza manter fonte paralela: compare o conteúdo, incorpore o que for válido ao Git principal e remova a cópia física.

Em 13/10/2026, as cópias inventariadas foram comparadas e removidas. Qualquer agente que precise preservar uma tentativa deve usar commit ou branch no repositório principal, sem criar outro checkout, pasta de release ou worktree.
