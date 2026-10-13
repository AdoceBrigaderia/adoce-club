---
title: Operação e administração
description: Atendimento, gestão do conteúdo, clientes, equipe, campanhas e auditoria.
status: Em implementação prioritária
---

# Operação e administração

## Planejamento compartilhado de compras — 11/10/2026

O planejamento mantém as quantidades de tortas G por sabor e por dia, em semanas independentes de segunda-feira a domingo. A tabela mostra sabor, sete dias com suas datas, total por sabor e total de cada dia. O menu **Selecionar semana** apresenta semanas completas agrupadas por mês e ano, como **Outubro — semana 1 · 05/10 a 11/10** e **Outubro — semana 2 · 12/10 a 18/10**. A semana pertence ao mês de sua segunda-feira; o intervalo continua completo quando atravessa o mês ou o ano. É possível voltar à semana vigente, avançar e programar semanas futuras. Cada semana fica salva até a gestão alterá-la. **Copiar semana anterior como modelo** transfere sabores, quantidades e extras para os dias equivalentes, sem sobrescrever uma semana já cadastrada e sem copiar o estoque informado. Quantidades antigas ainda sem dia aparecem como **A distribuir** e são distribuídas ao preencher dias, sem duplicar o total. Quantidades, seleção, extras e estoque informado são compartilhados no banco entre os aparelhos da gestão; alterações de campos diferentes preservam uma à outra. A tela informa carregamento, salvamento e falhas, atualiza o planejamento a cada cinco segundos e ao retornar à janela. Os dados são exclusivos de proprietários e gerentes. O estoque informado serve ao planejamento, sem alterar o estoque operacional.

O total de tortas fica visível durante a rolagem. **Selecionar itens das tortas** apresenta apenas a composição dos sabores planejados, incluindo preparações e descartáveis, com os itens necessários inicialmente selecionados. **Itens extras** é um menu separado e mostra campos apenas para os extras escolhidos. O estoque atual é subtraído antes do arredondamento dos pacotes; compras nunca ficam negativas. Pacotes usam a embalagem de referência cadastrada ou, na ausência, a embalagem externa da última compra.

**Imprimir lista de compras** envia à fila existente do tablet uma lista térmica de 32 colunas com total de tortas, intervalo da semana e, por produto, estoque atual, quantidade a comprar, pacotes e últimos preços líquidos por kg (ou litro/unidade) e pela embalagem da última compra, sem fórmulas. O cupom usa formato compacto de lista: caixa de conferência por produto, quantidade a comprar e pacotes na mesma linha, estoque e preços unitários. Não imprime data da última compra nem valor total por item. Quando a embalagem da última compra é diferente da embalagem de referência, o conteúdo é indicado para evitar confusão; preços ausentes ficam explicitamente pendentes. Massa é apresentada em kg, volume em litros e descartáveis em unidades. A tela oferece prévia do cupom. **Imprimir cardápio da semana** imprime os sabores de cada dia preenchido, sem expor estoque, quantidades de produção ou custos. Lista de compras e cardápio incluem a logo oficial convertida para impressão térmica monocromática. A logo exige o aplicativo Android atualizado, que reconhece o marcador da fila e imprime raster ESC/POS; versões antigas não devem receber trabalhos com esse marcador. Planejamento com composição inválida bloqueia impressão para evitar uma lista incompleta; ausência de tamanho de pacote é explicitamente indicada. Envio à fila não confirma impressão física.

Insumos e embalagens mostram automaticamente as tortas que os utilizam, inclusive por preparações. A análise utiliza as versões atuais das fichas, seguindo as versões exatas de preparações nelas vinculadas. Itens sem tortas vinculadas são diferenciados dos itens sem uso em nenhuma composição atual. Há filtro e ordenação de itens sem uso; notas, itens, preparações, fichas e planejamento oferecem ordenação. Custos incompletos aparecem primeiro nas fichas e preparações, com destaque visual e detalhes das pendências.

Na área **Hoje**, o sistema pergunta se a gestão deseja trazer o planejamento de compras. A prévia permite escolher data, horário e sabores; converte tortas em fatias pelo rendimento inteiro da ficha G vigente, sem presumir rendimento. A criação exige confirmação explícita e é atômica. Mudanças no planejamento ou na ficha após a prévia exigem atualização. Sabores com estoque, reservas ou lotes existentes são preservados; repetição da importação não duplica lotes. Apenas proprietários e gerentes acessam o planejamento e a importação. O planejamento por si só não cria disponibilidade nem altera as vendas.

Estado: implementado localmente e validado automaticamente e visualmente com dados simulados em computador, celular e tablet, incluindo dois aparelhos simultâneos, persistência por semana, cópia, estoque, falha de conexão, filtros, cardápio, confirmação de lotes e impressão na fila simulada. A logo passou na verificação de bytes; o aplicativo Android compilou, sem instalação no tablet. Permissões e gravação no banco verificadas em transação revertida. Autorização de publicação recebida do proprietário em 11/10/2026. As três migrações de planejamento compartilhado, semanas e sugestão de lotes foram aplicadas e verificadas em produção. A entrega web passou em 900 testes e validação visual em computador, celular e tablet; a conferência do domínio oficial é obrigatória após o deploy. O aplicativo Android com logo foi compilado, mas a instalação no tablet e a impressão física permanecem pendentes.


## Pagamento recebido e retirada online — 10/10/2026

O atendimento oferece dois caminhos visíveis: **Ainda não pagou — Confirmar separação e enviar cobrança** e **Já pagou — Confirmar pagamento e liberar retirada**. O primeiro confirma a separação e solicita o pagamento. O segundo confirma o pagamento informado pela equipe, inclusive quando o pedido já está em separação, e avisa que a cliente pode buscar ou enviar o Uber sem reenviar cobrança. Confirmação financeira, baixa das unidades reservadas, carimbos das fatias pagas e resgate da fidelidade acontecem na mesma transação. O pedido online termina essa ação como **Pronto para retirada**, pois o motorista ou cliente ainda vai buscá-lo; a entrega continua sendo registrada quando a retirada acontece. Avisos intermediários ainda pendentes são substituídos pelo aviso final, evitando solicitar pagamento depois de o recebimento ter sido confirmado. Repetir a ação em um pedido já pronto e pago não lança outra compra nem resgata outro prêmio. Depois de o pagamento estar aprovado, a ação de enviar cobrança não aparece.

O aviso final informa que a cliente pode enviar o Uber ou buscar o pedido e utiliza o endereço gravado no próprio pedido. Uma exceção informada pela equipe não altera o endereço dos demais pedidos. Para FAT-20261010-0620, o proprietário definiu **Rua Odíllio Filho, 227**. Endereço atualizado no pedido de produção; correção da função, botão e mensagem preparada localmente, com publicação e validação completa ainda pendentes.

## Seleção de fidelidade no pedido online — 10/10/2026

O atendimento deve conseguir escolher qual unidade já existente no pedido será a fatia premiada antes de confirmar o pagamento, inclusive quando a separação já começou. A escolha mantém o estoque reservado e as caldas da unidade, recalcula o total das fatias pagas e preserva a auditoria. Durante a separação, a seleção utiliza uma fatia existente; não acrescenta outra fatia ao pedido. Pedidos pagos ou encerrados não permitem essa alteração. O prêmio somente é resgatado ao confirmar o pagamento.

Estado desta correção: interface e migração preparadas localmente, testes focados e TypeScript validados; publicação e validação visual ainda pendentes. O pedido FAT-20261010-0620 foi corrigido diretamente em produção por solicitação do proprietário, com Red Velvet como prêmio e total de R$ 32,00.

## Consumos fixos das fichas de tortas — 08/10/2026

Cada ficha de torta, existente ou nova, inclui as preparações **Desmoldante formas: 40 g** e **Irrigação: 300 ml** por torta inteira, independentemente do número de fatias. São componentes de preparação com custo proporcional ao rendimento cadastrado, não insumos novos. A gravação no banco garante uma ocorrência de cada consumo, sem duplicações. As fichas existentes recebem novas versões; versões anteriores e as receitas das preparações permanecem preservadas.

O botão **Salvar e criar nova**, ao lado de **Salvar nova versão**, grava a ficha em andamento e limpa o formulário somente após a confirmação de sucesso. O próximo sabor ou preparação começa com campos novos. Se houver erro de gravação, o preenchimento é mantido. O botão de salvar a versão permite continuar na ficha atual.

A lista de fichas apresenta **Preço de venda ideal** editável, com valor inicial de **R$ 18,00 por fatia**, e **Margem no preço ideal**. O preço ideal é salvo por sabor e tamanho ao sair do campo ou pressionar Enter e permanece ao criar novas versões da mesma ficha. Fichas novas começam em R$ 18,00. A margem usa o preço ideal menos o custo total por fatia e a taxa média estimada de pagamento, dividindo o resultado pelo preço ideal para obter o percentual. São os mesmos custos e taxa usados na margem do preço atual; sem custo completo ou taxa disponível, a margem permanece pendente. Esse valor interno não altera os preços de venda do catálogo. Apenas proprietários e gerentes podem consultar e alterar os preços ideais; alterações de valor ficam auditadas.

No computador, a área **Custos e fichas** utiliza a largura disponível da janela, com margens laterais proporcionais, para aproveitar monitores largos e apresentar mais colunas. Celular e tablet mantêm a organização responsiva e a rolagem da tabela quando necessária.

As margens do preço atual e do preço ideal descontam também a **taxa média estimada de pagamento**, editável e salva para todas as fichas. A estimativa inicial é **1%**, arredondada a partir do retrato fornecido pelo proprietário: R$ 4.494,00 em vendas e R$ 44,86 em taxas calculadas pelo relatório, equivalentes a 0,99821985% do faturamento. A ponderação inclui Pix, débito, crédito, dinheiro e desconto em folha, inclusive os meios sem tarifa. Esse percentual é uma projeção das fichas e não altera tarifas configuradas no caixa. A fórmula é `(venda × (1 − taxa média / 100) − custo total da fatia) / venda × 100`; o denominador é o preço bruto da fatia. O percentual deve ser revisto quando mudarem as tarifas contratadas ou a proporção dos meios de pagamento. Alterações da estimativa exigem gerente/proprietário e ficam auditadas.

Ao rolar a página no computador e no tablet, o cabeçalho da tabela de fichas permanece visível abaixo da navegação da operação, alinhado às colunas e acompanhando a rolagem horizontal. O cabeçalho flutuante desaparece quando a tabela termina. No celular, a tabela mantém os cartões com os nomes dos campos junto a cada valor.

Por solicitação do proprietário, **Chocolatudo Trufado** e **Chocolate com Castanha de Caju** foram removidos do cadastro, incluindo suas disponibilidades e referências de imagens. Esses sabores não tinham fichas técnicas nem itens de pedidos vinculados. **Doce de Leite Flocado** saiu do catálogo ativo; a exclusão definitiva depende da decisão sobre seus três itens históricos de pedidos. Também não havia ficha técnica cadastrada para esse sabor.

## Prioridade de implantação

Este capítulo entra no início da implantação porque permite que proprietários e gerentes mantenham o Adoce Hoje e a comunicação diária sem depender de uma nova publicação de código a cada mudança.

Ordem aprovada:

1. catálogo, descrição, preço e galeria de produtos;
2. disponibilidade diária, horários, locais e exceções;
3. promoções com período de validade, pré-visualização e auditoria;
4. preferências de comunicação no cadastro e no perfil do cliente;
5. central de notificações com segmentação, revisão e consentimento;
6. conclusão dos demais recursos administrativos e indicadores deste capítulo;
7. Apple Wallet e Google Wallet, mantendo o app/web como alternativa.

A identificação do cliente por nome ou telefone integra o atendimento.

## Papéis

| Papel        | Responsabilidades                                                       |
| ------------ | ----------------------------------------------------------------------- |
| Atendente    | Identificar, registrar compra, validar indicação e resgatar prêmio      |
| Gerente      | Tudo do atendente, ajustes, reversões, conteúdo e análises operacionais |
| Proprietário | Configurações, regras, usuários, auditoria, campanhas e governança      |

Cada funcionário usa uma conta individual. A área interna nunca pode ser acessada apenas por conhecer uma URL. Google e Facebook podem iniciar uma sessão para facilitar o acesso, mas a operação somente é liberada quando o identificador autenticado possui um vínculo ativo em `staff_members`. E-mail confirmado, nome ou outros metadados do provedor social nunca concedem função de equipe automaticamente.

## Atendimento

O fluxo principal deve concentrar:

- busca por nome ou telefone;
- confirmação da identidade sem expor dados além do necessário;
- registro de quantidade de itens elegíveis;
- seleção de prêmio principal ou Espalhe Doçura;
- confirmação automática de eventual convite pendente na primeira compra, sem digitação de código;
- confirmação do saldo anterior e do resultado;
- comprovante visual da operação.

## Clientes e grupos

A equipe autorizada poderá:

- localizar clientes e grupos;
- consultar cartões, prêmios e histórico;
- verificar participantes e seus acessos;
- bloquear e desbloquear conta;
- reenviar acesso ou convite;
- revogar sessão ou passe comprometido;
- realizar ajuste ou reversão com justificativa;
- atender solicitações de exportação ou anonimização de dados.

## Adoce Hoje

O painel deve oferecer edição simples para:

- status da loja física;
- status do atendimento presencial;
- status de pedidos online e encomendas;
- horários regulares e exceções;
- sabores do dia e disponibilidade;
- promoções, banners e comunicados;
- programação de publicação e retirada.

Recomendação: combinar horários automáticos com um controle manual de exceção e registrar quem alterou cada estado.

### Central Adoce

A primeira versão administrativa deve permitir, para proprietários e gerentes:

- cadastrar e editar produtos, categoria e preço;
- limitar nome a 80 caracteres, chamada curta a 90, descrição a 300 e ingredientes a 400;
- manter até seis fotos por produto, com uma foto principal;
- aceitar JPEG, PNG e WebP de até 4 MB e reduzir automaticamente para WebP com dimensão máxima de 1600 px;
- marcar disponibilidade de hoje como disponível, últimas unidades, esgotado, somente encomenda ou indisponível;
- configurar horários recorrentes e exceções por data;
- seguir a agenda automática ou pausar excepcionalmente um canal;
- criar promoções com início, fim, ativação e pausa;
- visualizar o resultado publicado no Adoce Hoje;
- registrar as alterações sensíveis na auditoria.

Na ausência de uma confirmação atual do banco, nenhum produto pode ser apresentado ao cliente como disponível. Encartes feitos para uma data específica não são usados como conteúdo permanente.

## Indicações

A administração poderá consultar:

- indicações aguardando primeira compra;
- confirmações e data da compra;
- indicador e indicado;
- bônus concedidos às duas partes;
- cancelamentos e reversões;
- alertas de duplicidade ou comportamento suspeito.

## Campanhas

Campanhas devem usar critérios auditáveis, por exemplo:

- número de cartões completados;
- prêmios disponíveis;
- tempo desde a última compra;
- número de indicações confirmadas;
- participação em grupo;
- consentimento de marketing válido.

O consentimento para participar do Clube Adoce não autoriza automaticamente mensagens promocionais.

### Preferências e envio seguro

Durante a conclusão do cadastro, o cliente escolhe de forma simples quais assuntos deseja receber: sabores, festival, promoções, novidades do Clube, prêmios e aniversário. As mesmas escolhas ficam editáveis no perfil.

E-mail, notificação do aparelho e WhatsApp são autorizações independentes. A escolha do cliente não substitui a permissão técnica do aparelho nem a configuração do provedor. Comunicações administrativas essenciais sobre acesso e segurança permanecem separadas das mensagens promocionais.

A central administrativa começa com rascunho, agendamento, histórico e cancelamento. Um disparo real somente é liberado depois que o respectivo provedor estiver configurado, o consentimento estiver válido e a campanha tiver passado por revisão.

## Indicadores iniciais

- clientes ativos;
- adesões e instalações na Wallet;
- compras e carimbos emitidos;
- ciclos completados;
- prêmios emitidos e resgatados;
- tempo médio entre prêmio e resgate;
- indicações iniciadas e convertidas;
- taxa de retorno por faixa de cartões completos;
- operações revertidas e ajustes manuais;
- atualização e visualização dos sabores do dia.

## Auditoria

Toda operação sensível registra:

- identificador único;
- tipo de operação;
- data e hora;
- conta, cartão e participante afetados;
- saldo ou estado anterior e posterior;
- funcionário, dispositivo ou serviço responsável;
- loja ou canal;
- justificativa e referência da operação original, quando aplicável.

Movimentações não são editadas nem apagadas. Correções produzem novos registros vinculados.

## Impressão de vendas presenciais no caixa

Na finalização da venda presencial, a opção **Imprimir cupom** começa desmarcada. O cupom somente é enviado quando a operadora marca a opção. Após concluir, a escolha volta a ficar desmarcada para a próxima venda. O botão **Reimprimir vendas de hoje**, no presencial, permite solicitar a impressão posteriormente e mostra apenas vendas do mesmo caixa e loja registradas no dia de Fortaleza. A lista é paginada e exclui cancelados e expirados. Os ouvintes de pedidos novos no navegador e no aplicativo Android não imprimem automaticamente vendas do canal operacional; solicitações explícitas de impressão continuam disponíveis.

## Fechamento rápido do caixa presencial

- **Dinheiro:** o valor recebido começa preenchido com o total, já considerando desconto. A operadora só o altera para registrar o dinheiro recebido e calcular o troco; **Finalizar venda** salva e volta aos sabores.
- **Pix, crédito, débito e desconto em folha:** após conferir o recebimento, um toque na forma ativa registra o total e encerra a venda. Não há campo de valor nem confirmação adicional.
- **Duas ou mais formas:** a operadora escolhe cada forma e digita seu valor. Adicionar o pagamento que cobre o total encerra automaticamente. Excesso em Pix ou cartão é recusado; excesso em dinheiro vira troco. O modo exige pelo menos duas formas diferentes.
- A tela retorna à seleção de sabores assim que o banco confirma. Consulta do cupom, impressão opcional e cadastro no Clube prosseguem separadamente, sem bloquear o próximo pedido. Falhas de impressão informam o número da venda e permitem nova solicitação pela reimpressão.
- Pagamento pendente, fidelidade do cartão de papel, cadastro no Clube e consulta da chave Pix continuam disponíveis em etapas separadas. Cadastro e lançamento de carimbos da última venda ficam acessíveis no presencial, sem abrir automaticamente uma janela após cada venda.
- Quantidade, pagamento, reimpressão, cadastro, sangria, suprimento, perdas, despesas, conferência, pagamentos pendentes e fechamento usam janelas compactas. Listas e relatórios têm páginas em vez de crescer além da janela.
- Cliques repetidos são bloqueados durante o salvamento. Em caso de erro, o carrinho e a chave de idempotência ficam preservados para a nova tentativa.
# Ajuste de desktop aprovado em 11/10/2026

As seis áreas da Operação aproveitam a largura disponível a partir de 1.280 px. Hoje organiza ações principais, situação do tablet e impressora, indicadores e atalhos em colunas. Produtos usa grade adaptativa; Caixa, Clientes, Gestão e Configurações ampliam sua área útil. Celular e tablet abaixo desse limite mantêm os estilos existentes.

Validação: 900 testes automáticos e release:check aprovados; seis telas conferidas em 1.920 px, ultralargo, 1.024 px e 390 px, sem transbordamento horizontal. Publicação autorizada pelo proprietário. Instalação Android e impressão física continuam pendentes de tablet conectado.

# Compras no tablet e dias selecionáveis — 11/10/2026

O planejamento oferece seleção de um dia por sabor, equivalente a uma torta G. Quantidades históricas maiores permanecem visíveis até revisão explícita. As tabelas de dias e custos possuem controles para deslocar suas colunas; a rolagem horizontal fica dentro da tabela, sem expandir a página.

O modo compras no tablet apresenta estoque e quantidade a comprar. A cotação recebe preço da embalagem inteira, número de unidades e peso ou volume de cada unidade. Para itens contados, o conteúdo é uma unidade. A comparação usa preço por kg, litro ou unidade da última compra registrada e calcula embalagens completas após desconto do estoque. Sem referência anterior, informa que não pode comparar. Cotação não altera notas, estoque ou custo cadastrado.

Os três campos de cotação ficam no planejamento compartilhado da semana, com acesso restrito à gestão e sincronização entre aparelhos. A interface depende de conexão; alteração pendente de gravação é indicada.

# Lista compacta durante as compras — revisão de 11/10/2026

O proprietário substituiu os cartões pela lista compacta: cada linha apresenta checkbox de item no carrinho, nome, quantidade a comprar, pacotes e estoque. O formulário e o resultado de comparação ficam em “Comparar preço”, recolhido inicialmente e expansível por item. Cotações existentes são preservadas. As marcações são compartilhadas por semana; copiar uma semana como modelo limpa o carrinho da nova semana. Implementação com validação automática; revisão visual e publicação desta revisão pendentes da conexão do navegador.

# Pedidos, Compras e Estoque e fidelidade no caixa — 12/10/2026

**Compras e Estoque** é um módulo principal restrito a gerente e proprietário. Ele reúne notas de compra, insumos e embalagens, preparações, fichas por sabor e planejamento. O sistema ainda não controla o estoque físico de insumos; essa limitação deve permanecer explícita. Gestão continua dedicada a vendas, recebimentos, caixas, despesas, resultado e relatórios.

Na tela **Pedidos**, a venda local permanece na parte superior e a fila de pedidos online aparece logo abaixo. O WhatsApp oficial continua como canal de atendimento; o antigo lançamento separado de WhatsApp particular foi removido. A identificação da venda local apresenta, nesta ordem, Clube Adoce, celular e nome e sobrenome. A pesquisa por telefone preenche o cliente existente; quando nome e telefone válidos ainda não existem, o cadastro e os carimbos das fatias pagas são feitos na conclusão.

Cliente identificado desabilita a fidelidade manual. Uma recompensa digital disponível ou a fidelidade manual externa exige escolher exatamente uma unidade já presente no carrinho. Essa unidade mantém sabor, calda e baixa física, recebe a regra de cortesia de até R$ 16 e as demais unidades pagas geram carimbos. A finalização usa chave idempotente e transação única para venda, unidade premiada, recompensa digital e carimbos do cliente já identificado.

Nas fichas, títulos compactos e rolagem horizontal preservam a leitura da tabela. **Abrir ficha** usa um modal e destaca a primeira pendência sem deslocar a página. Cabeçalhos de tabelas permanecem visíveis enquanto suas linhas estiverem na área visível, exceto tabelas transformadas em cartões no celular e impressão. Cadastros de insumos semelhantes permanecem separados; quando o item sem uso possui homônimo utilizado, a tela informa nome e código do registro efetivamente vinculado.

No cadastro rápido, telefone já existente abre automaticamente o perfil encontrado e não lança carimbo apenas por ter sido aberto.

