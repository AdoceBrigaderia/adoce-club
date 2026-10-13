# Pedidos, Compras e Estoque, clientes e fidelidade

Data: 12/10/2026  
Estado: aprovado pelo proprietário para implementação, validação e publicação

## Objetivo

Reduzir o trabalho operacional diário reunindo vendas locais e pedidos online em uma única tela, identificando clientes sem duplicidade, aplicando corretamente fidelidade digital ou manual e separando custos, fichas e compras da Gestão contábil. Todas as tabelas do sistema devem manter seus títulos visíveis enquanto suas linhas estiverem na tela.

## Limites e princípios

- Trabalhar exclusivamente em `D:\AdoceOnLine`.
- Preservar alterações locais existentes e dados de produção.
- Manter clientes, dados pessoais e recursos internos restritos à Operação autenticada.
- Operações financeiras, baixa de estoque, criação de cliente, carimbos e resgates precisam ser idempotentes e auditáveis.
- Não apresentar controle de estoque de insumos como existente antes de ele ser implementado. O novo módulo pode nomear essa evolução, mas deve distinguir o que já funciona do que é futuro.
- Fidelidade digital do Clube Adoce e fidelidade manual externa são mutuamente exclusivas.

## 1. Módulo Compras e Estoque

Criar um módulo principal da Operação chamado **Compras e Estoque**, disponível para proprietário e gerente. No celular, o nome curto da navegação será **Compras**; dentro da tela o título completo será exibido.

O módulo reunirá:

1. Notas de compra;
2. Insumos e embalagens;
3. Preparações;
4. Fichas por sabor;
5. Planejamento de compras;
6. Estado futuro do estoque de insumos, claramente identificado como ainda não controlado pelo sistema.

`Custos e fichas` será removido das abas de Gestão. Gestão continuará responsável por vendas, recebimentos, caixas, despesas, DRE e relatórios.

Essa reorganização não altera os dados ou permissões atuais das fichas. Ela muda a entrada de navegação e a composição da interface.

## 2. Tabelas e cabeçalhos persistentes

Toda tabela interativa do site deve manter o cabeçalho visível enquanto ainda houver linhas daquela tabela na área visível.

- Em páginas da Operação, o cabeçalho ficará abaixo do cabeçalho e da navegação principal.
- Em tabelas com rolagem horizontal, títulos e células permanecerão alinhados durante o deslocamento.
- Em modais ou contêineres com rolagem própria, o cabeçalho acompanhará o contêiner correto.
- O cabeçalho desaparecerá ao terminar a tabela.
- No celular, tabelas transformadas em cartões continuarão mostrando o rótulo de cada valor, sem uma faixa flutuante isolada.
- Documentos destinados apenas à impressão não receberão cabeçalho flutuante na impressão.

A tabela de fichas terá títulos compactos, com quebra em até duas linhas, células mais estreitas e barra de rolagem horizontal acessível.

## 3. Fichas incompletas em modal

O botão **Abrir ficha** não deslocará mais a página. Ele abrirá a ficha em um modal sobre a listagem.

- O modal exibirá todas as pendências de cálculo.
- O primeiro componente relacionado à primeira pendência receberá foco e destaque.
- Quando a pendência for estrutural, o primeiro campo vazio ou inválido receberá foco.
- Fechar o modal devolverá o usuário à posição anterior da tabela.
- Salvar continuará criando uma nova versão, preservando o histórico.

## 4. Identificação correta do Oreo

Produção contém dois registros distintos:

- `BISCOITO OREO`, código `NF-326CBE290E90`, sem composição vinculada;
- `OREO`, código `INS-2368F543A84142BCBCA7E58D`, usado na ficha Oreo vigente em Misturas e Cobertura.

A aba de insumos deve explicar quando um cadastro sem uso possui outro item semelhante que é o registro efetivamente usado. Nome e código interno continuarão visíveis. Nenhum registro será unido, excluído ou substituído automaticamente nesta entrega.

## 5. Tela unificada de Pedidos

A área atualmente chamada **Presencial** será renomeada para **Pedidos** e reunirá venda local e acompanhamento dos pedidos online.

Na parte superior permanecerão seleção de fatias, carrinho, caldas, identificação e pagamento da venda local. Logo abaixo será exibida a fila de pedidos online que chegam ao sistema, reutilizando os estados e ações existentes de separação, pagamento, fidelidade, retirada e entrega.

A antiga opção **WhatsApp particular** será removida. **WhatsApp oficial** continuará disponível para conversas e atendimento do canal oficial, sem duplicar o formulário de lançamento manual.

Os campos do pedido local aparecerão nesta ordem:

1. Clube Adoce;
2. Celular;
3. Nome e sobrenome.

Celular e nome são opcionais quando a venda não será vinculada ao Clube. Ao preencher qualquer um deles para cadastro, ambos precisam estar válidos antes da finalização.

## 6. Seleção e pesquisa de clientes

O controle **Clube Adoce** abrirá uma lista pesquisável com todos os clientes autorizados para aquela operação, ordenados alfabeticamente. A seleção preencherá celular e nome e vinculará a venda.

Ao digitar um celular válido, o sistema pesquisará o cadastro após uma pequena pausa:

- se encontrar um cliente, preencherá o nome e mostrará progresso, recompensas disponíveis e previsão de carimbos da venda;
- se não encontrar, manterá o celular digitado e aguardará nome e sobrenome;
- ao finalizar uma venda com celular e nome válidos e ainda inexistentes, criará o cadastro, vinculará a venda e lançará os carimbos das fatias pagas;
- repetição da mesma finalização não poderá criar outra conta nem lançar carimbos novamente.

## 7. Cliente já cadastrado no módulo Clientes

Encontrar um telefone já cadastrado não é erro.

- Durante o cadastro rápido, um telefone válido será pesquisado no cadastro completo, não somente na lista parcial carregada.
- Ao encontrar correspondência, o formulário de novo cliente será fechado e o perfil existente será aberto automaticamente.
- Se a duplicidade for detectada apenas pelo servidor no momento de salvar, o retorno será tratado da mesma forma usando o `profileId` retornado.
- Abrir o perfil não lança carimbo. Carimbos dependem da conclusão explícita da venda ou da ação operacional própria.
- Mensagens técnicas extensas serão reservadas para falhas reais.

## 8. Fidelidade digital e manual

### Cliente identificado no Clube Adoce

- A opção **Fidelidade manual** ficará desabilitada.
- As fatias pagas da venda gerarão carimbos digitais.
- Se houver recompensa digital disponível, o sistema perguntará qual unidade já existente no carrinho será gratuita.
- A unidade escolhida preservará sabor e calda, não será cobrada e consumirá uma recompensa apenas na finalização.
- As demais unidades pagas continuarão gerando carimbos.

### Cliente não identificado

- A opção **Fidelidade manual** ficará habilitada no carrinho.
- Ao marcá-la, a operadora escolherá exatamente uma unidade existente do carrinho como gratuita pelo programa externo.
- A unidade gratuita não será cobrada, mas terá baixa normal de estoque.
- Não haverá criação de cliente, carimbo digital ou resgate digital.

Se um cliente for identificado ou criado enquanto a fidelidade manual estiver selecionada, o sistema limpará a seleção manual e exigirá confirmação da fidelidade digital aplicável.

## 9. Transação e segurança operacional

A finalização deve tratar, em uma transação protegida ou fluxo servidor equivalente:

- revalidação de estoque e reservas;
- criação ou identificação do cliente;
- vínculo da venda;
- escolha da unidade gratuita;
- cálculo das unidades cobradas;
- alocação dos pagamentos;
- baixa de estoque;
- carimbos das unidades pagas;
- resgate digital, quando aplicável;
- auditoria e idempotência.

Falha em qualquer etapa não deve deixar cliente, pontos, pagamento ou estoque parcialmente gravados. A interface preservará o carrinho e permitirá nova tentativa com a mesma chave idempotente.

## 10. Validação e publicação

Antes da publicação:

- testes unitários e de regressão dos cálculos e estados;
- testes de integração das funções de venda, cadastro, carimbos e recompensa;
- TypeScript e build;
- validação visual e interativa em computador, celular e tablet conectado;
- console sem erros relevantes;
- `npm run release:check` completo;
- regeneração de `docs/clube-adoce-documentacao.html` quando a documentação oficial for atualizada.

Depois da publicação:

- conferir o domínio oficial sem iniciar outro deploy;
- validar a versão servida;
- testar um fluxo autenticado sem criar venda ou cliente real desnecessário;
- distinguir claramente publicação web, eventual APK compilado, instalação no tablet e aceite operacional.

O proprietário autorizou a publicação em 12/10/2026, condicionada à aprovação dos gates acima.
