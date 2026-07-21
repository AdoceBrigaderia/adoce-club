# Método econômico de publicação

## Objetivo

Evitar que a produção seja usada como ambiente de teste e reduzir publicações que consomem créditos da Netlify. Uma versão só chega ao domínio oficial depois de estar funcional, visualmente aprovada e com os dados reais conferidos.

## Regra principal

Produção é a última etapa. Ajustes, tentativas, comparação de opções e correções acontecem primeiro no computador. A prévia on-line é usada apenas quando Rubens ou Beth precisam validar em outro aparelho. Depois da aprovação, é feita uma única publicação em produção.

## Fluxo obrigatório

1. **Definir o pacote da entrega:** reunir os pedidos relacionados antes de começar e registrar o que será alterado.
2. **Trabalhar localmente:** desenvolver e revisar sem publicar a cada ajuste.
3. **Passar pelo portão automático:** executar `npm run release:check`. O comando bloqueia a publicação se testes, verificação do código, documentação ou compilação falharem.
4. **Validar a experiência:** conferir computador e celular, textos, links, imagens, horários, permissões, estados vazios, mensagens de erro e dados da operação.
5. **Usar homologação somente quando necessário:** executar `npm run release:preview` quando a aprovação depender de acesso remoto ou de um aparelho real. A implantação da prévia não consome créditos de implantação, mas seu tráfego ainda pode consumir requisições e banda.
6. **Agrupar correções:** se algo for reprovado, voltar ao ambiente local e corrigir todos os pontos antes de gerar outra prévia.
7. **Publicar uma vez:** após aprovação final, executar `npm run release:prod`.
8. **Fazer conferência pós-publicação:** abrir o domínio oficial, testar apenas os caminhos críticos e consultar os registros de erro. Essa conferência não gera outro deploy.

## Critérios mínimos de aprovação

- Todos os testes automatizados aprovados.
- Verificação de tipos e compilação aprovadas.
- Nenhum erro ou alerta novo no navegador.
- Funcionamento conferido no computador e no celular.
- Imagens sem cortes ruins, deformações ou arquivos excessivamente pesados.
- Textos claros, acolhedores e coerentes com a operação real.
- Links de WhatsApp, redes sociais e navegação testados.
- Datas, horários, valores, quantidades e disponibilidade conferidos.
- Área pública sem informações internas da operação.
- Área administrativa protegida e acessível somente à equipe autorizada.
- Aprovação expressa de Rubens para mudanças comerciais ou visuais relevantes.

## Política de frequência

- Correção urgente que impede venda, login ou operação: publicação assim que o pacote corretivo for validado.
- Ajustes comuns: agrupar em uma janela de publicação, preferencialmente uma ou duas vezes por semana.
- Mudanças grandes: uma prévia final para aprovação e uma publicação em produção.
- Pequenos textos e detalhes visuais: acumular para o próximo pacote, salvo quando causarem informação errada ao cliente.

## Economia além dos deploys

- Comprimir fotos e vídeos antes de hospedá-los.
- Preferir WebP ou AVIF para imagens do site.
- Usar vídeos do Instagram por link quando não prejudicar a experiência.
- Evitar funções da Netlify para tarefas que podem ser resolvidas diretamente pelo navegador e pelo Supabase com segurança.
- Manter respostas de funções pequenas e rápidas.
- Evitar atualizações automáticas agressivas e consultas repetidas sem necessidade.
- Acompanhar semanalmente produção, banda, requisições e computação na área de uso da Netlify.

## Responsabilidade da validação

O Codex deve informar claramente se a versão está apenas implementada, validada localmente, em homologação ou publicada. Nunca deve declarar uma mudança como disponível aos clientes sem confirmar o domínio oficial depois da publicação.
