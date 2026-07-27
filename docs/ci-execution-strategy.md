# Estratégia de execução do CI da reestruturação

Esta estratégia vale somente para a branch `reestruturacao/ux-crm-operacao-imagens-v1`.
Produção continua proibida sem aprovação expressa.

## Motivo da alteração

A branch possuía três workflows pesados acionados simultaneamente por `push` e por
`pull_request`. Como a mesma branch já está ligada a um PR aberto, cada commit podia
iniciar até seis execuções redundantes, além de novas tentativas e cancelamentos.

A nova estrutura mantém a cobertura técnica e reduz execuções duplicadas.

## Gate automático

O workflow `Portal quality gate` é o único gate automático da branch. Ele é iniciado
uma vez por `push` relevante e executa:

- TypeScript;
- testes unitários e contratuais;
- testes das auditorias;
- auditoria de imagens;
- auditoria da fronteira BFF;
- build;
- gate de segurança do build.

O gatilho não usa `pull_request`, evitando duplicidade com o mesmo commit. Alterações
restritas a documentação não iniciam o gate pesado, e a execução anterior da branch é
cancelada quando chega um commit mais recente.

## Gate completo de marco

O workflow `Verificar reestruturação` é manual e exige o SHA exato do marco. Ele
preserva diagnósticos detalhados e o build para inspeção. Deve ser executado:

1. no fechamento de um marco amplo;
2. antes de publicar homologação;
3. depois de corrigir uma falha relevante de segurança, banco ou autenticação;
4. antes da comparação final com produção.

## Playwright

O workflow `Playwright mobile e tablet` é manual e exige o SHA exato do marco visual.
Deve ser executado após mudanças relevantes de interface, no fechamento de marco e
contra o preview isolado de homologação.

## Continuidade

Falha de runner, ausência de etapas ou falta de logs não interrompe o desenvolvimento.
A execução deve ser repetida até três vezes e as tarefas independentes devem continuar.
Nenhum marco é declarado aprovado sem evidência dos testes correspondentes.
