---
title: Status da publicação
description: Estado atual dos ambientes públicos, domínios, autenticação e recursos liberados.
status: Produção em evolução
---

# Status da publicação

## 21/10/2026 — cardápio da semana ligado ao planejamento real + disponibilidade por lote

A home pública e a página completa de fatias passam a sempre mostrar abas Seg–Dom (antes só apareciam quando hoje estava sem produção). A aba de hoje usa a grade real (`flavor_availability` + pedido instantâneo); as demais mostram uma prévia por lote com link de reserva no WhatsApp e um aviso explicando que é reserva, com o horário real de liberação.

Disponibilidade pública de fatias passa a ser alimentada por `flavor_availability_batches` (lotes com horário e quantidade), não mais só pelo registro agregado do dia. Novas funções no Supabase:

- `manager_import_shopping_plan_availability(start,end)` — importa o planejamento de compras (Operação → Compras e Estoque → Planejar compras) para lotes públicos: 13 fatias por torta marcada, liberação às 18h. Reimportar remove lotes de sabores que saíram do planejamento (marca `imported_from_shopping_plan` para diferenciar de lotes manuais), pulando os que já têm fatia reservada.
- `get_public_flavor_availability_batches_range(start,end)` — versão por período da função que já alimentava "hoje", usada pelo cardápio da semana.
- `manager_clear_availability_week(start,end)` — remove de uma vez todos os lotes de um período (botão "Limpar semana inteira" em Operação → Produtos → Produção de hoje).

A tela Operação → Produtos → Produção de hoje ganhou seletor de dia (antes só mostrava hoje, sem jeito de ver/editar/excluir fatias de outros dias já importadas) e um bloco "Ver semana inteira" com tabela sabor × dia.

Validado automaticamente (tsc -b + suíte de testes) e visualmente em produção (desktop), inclusive testando a importação real contra o planejamento da semana de 19–25/10. Celular não foi conferido nesta sessão.

**Migrações aplicadas direto em produção via MCP do Supabase** (não só preparadas localmente): `20261019160000_import_shopping_plan_availability_batches.sql`, `20261019161500_public_flavor_availability_batches_range.sql`, `20261021120000_shopping_plan_import_reconciles_removals.sql`, `20261021180000_manager_clear_availability_week.sql`. Todas já estão nos arquivos de migração do repositório.

**Pendente combinado com o proprietário, ainda não iniciado:** campo de cor da massa nas fichas técnicas + coluna "massa predominante" e ordenação na tabela de planejamento, checkbox de dia obrigatório com aviso de mínimo de sabores/massa branca, botão "Salvar planejamento" com rascunho (hoje o planejamento salva a cada clique, sem botão), e sincronização automática do planejamento salvo com o cardápio público (substituindo a importação manual), incluindo cancelamento de reserva/baixa de estoque do dia anterior mediante segunda confirmação.

## 17/10/2026 — sessão de ajustes: home pública, tablet, regressão e achados pendentes na Operação

**Tablet sincronizado com a produção.** O app Android "Operação Adoce" (`android/`) estava com o build desatualizado em relação ao `dist` atual. Rodado `npm run build` + `npx cap sync android`, confirmado hash do bundle idêntico, e instalado o APK de debug no tablet físico (`4AK32N636`) via `adb install`. Validado: carrega e autentica normalmente.

**Home pública redesenhada e publicada.** A página inicial (`/`) deixou de mostrar só 3 fatias com hero institucional e passou a abrir direto com a grade de todas as fatias "disponíveis hoje" (data por extenso, título "Sabores de nossas fatias de hoje"), cada card com preço + estoque/reservado, um selo único verde "Disponível hoje" / vermelho "Indisponível" (os dois corações antigos — um "favoritar" sem efeito visível, outro decorativo — foram removidos), botão único "Toque para pedir", link "Conhecer todas as nossas delícias Adoce" para o catálogo completo e a seção Encomendar logo abaixo. Implementado em `src/AdoceHomeCatalog.tsx` (nova) e `src/AdoceHoje.tsx` (prop `compact`, reaproveitada também pela página completa `/adoce-hoje`, que ganhou o mesmo padrão de selo e botão). Validado automaticamente (961 testes, `tsc -b`) e visualmente (computador e celular). Confirmado no domínio oficial.

**Incidente e correção: deploy isolado reverteu trabalho já publicado.** Para não publicar a integração clientes/pedidos/estoque/WhatsApp de 16/10/2026 (commits `5752741`…`6f95d90`, ainda sem a Task 6 de auditoria formal concluída em `docs/superpowers/plans/2026-10-16-operacao-integrada.md`), a home acima foi publicada isolada a partir do commit de 13/10 (`81cd767`). Isso presumia que nada daquela integração estava no ar — presunção errada: o histórico de deploys da Netlify mostrou **duas publicações em produção em 16/10/2026** (15h07 e 14h34, horário de Brasília) que nenhum documento registrou. Comparando os hashes das funções publicadas, `customer-profile-update`, `staff-create-customer`, `twilio-whatsapp-order` e `whatsapp-support` foram revertidas pelo deploy isolado. Corrigido publicando novamente a partir do `HEAD` completo do branch (release:check aprovado, 961 testes), restaurando o que estava no ar antes mais a home nova.

**Lição para qualquer entrega futura, nesta sessão ou em outra IA:** não confiar apenas em `docs/07-status-publicacao.md` ou no status de commits locais para decidir o que já está em produção. Antes de isolar um deploy ou presumir que algo "ainda não foi publicado", comparar o histórico real de deploys da Netlify (`netlify-cli api listSiteDeploys` / `getDeploy`, hash das funções) com o código local. Publicações diretas por `npm run release:prod` fora do fluxo documentado já aconteceram e não deixam rastro automático na documentação.

**Efeito colateral do incidente — edição completa de cadastro de clientes.** Ao investigar por que a Operação só permitia editar o nome do cliente, achou-se que a edição completa (telefone, e-mail, data de nascimento, canal, endereço) já estava implementada desde o commit `5752741` (`src/customer-profile-admin.ts`, `netlify/functions/customer-profile-update.ts`, `src/AccessApp.tsx`), mas nunca formalmente publicada. As colunas necessárias já existem em produção desde julho/2026; não falta migração. Com a correção da regressão acima (republicação do `HEAD` completo), essa edição completa **deve estar no ar** — pendente de confirmação visual do proprietário dentro da Operação.

**Achado pendente, sem correção aplicada — impressão divergente entre site online e tablet.** No tablet (app nativo), o recibo imprime completo e formatado via `NativeOperation.printOrder`. No navegador (computador), a **reimpressão** de uma comanda já usa o canal correto (pede para o próprio tablet imprimir via `server_request_order_reprint`, saindo idêntica). Mas a **impressão de um pedido novo/único** pelo navegador (`printSingleThermal` em `src/OperationInstantOrders.tsx`) cai num fallback diferente — `printOperation("thermal")`, que é só `window.print()` da tela, sem o layout do recibo. Correção proposta (replicar o mesmo canal da reimpressão) ainda não autorizada nem aplicada.

**Pequeno ajuste aplicado e validado — data nos pagamentos pendentes.** O modal "Pagamentos pendentes" do caixa (`src/CashSessionActions.tsx`) passou a mostrar a data do pedido ao lado do nome/número em cada item. Validado visualmente pelo proprietário.

## Correção de rota identificada em 07/10/2026

O endereço atual esperado para a equipe é `https://www.adocebrigaderia.com.br/operacao`, sem `#`. A verificação anterior do domínio mostrou que `/operacao` entregava a página inicial do site público. A correção de rotas foi implementada e validada automaticamente; a prévia hospedada foi conferida em computador, celular e tablet na tela de entrada da Operação, além das entradas públicas e do Clube. A validação autenticada da navegação interna e a conferência do domínio oficial após a publicação continuam necessárias. A tabela histórica de 18/07/2026 abaixo registra o endereço usado naquela data e não deve ser tratada como orientação atual.

## Segunda prioridade emergencial — cadastro rápido no Clube Adoce

O cadastro de um novo cliente foi reduzido para duas etapas: preencher nome, e-mail, WhatsApp e uma senha; depois, confirmar o código recebido por e-mail. Após a confirmação, o acesso definitivo é criado automaticamente e o cartão abre sem uma terceira tela de configuração.

Termos e Política de Privacidade permanecem obrigatórios, reunidos em uma única confirmação clara. Preferências promocionais e confirmação adicional do WhatsApp deixam de interromper o cadastro e continuam disponíveis dentro da área do cliente. Clientes já cadastrados preservam o acesso atual por celular e senha.

Estado atual: alteração implementada localmente e marcada para o próximo deploy emergencial. Antes da produção, é obrigatório validar com uma conta controlada o cadastro completo, o bloqueio de telefone duplicado, a chegada do código por e-mail, a abertura direta do cartão e o retorno posterior por celular e senha.

## Correção emergencial prioritária — formas de pagamento do pedido online

O próximo deploy emergencial deve restaurar, antes das demais entregas, a consulta pública das formas de pagamento do pedido de fatias. A configuração de produção possui Pix, cartão de crédito e cartão de débito ativos, mas a função `get_checkout_payment_methods()` perdeu a permissão do visitante público e deixou o campo obrigatório sem opções.

Estado atual: causa confirmada em produção e hotfix preparado localmente na migração `20260815135747_restore_public_checkout_payment_methods.sql`. O formulário também passa a informar a falha e oferecer nova tentativa, em vez de bloquear o cliente silenciosamente. A correção ainda não foi aplicada em produção.

No deploy emergencial, é obrigatório:

1. aplicar isoladamente a migração do hotfix, sem levar junto a funcionalidade maior de disponibilidade por horário;
2. confirmar que `anon` e `authenticated` possuem `EXECUTE`, mantendo `public` sem acesso herdado;
3. abrir o site oficial como visitante e confirmar que Pix, cartão de crédito e cartão de débito aparecem;
4. concluir um pedido controlado e validar sua entrada na fila da operação, sem registrar pagamento real;
5. executar `npm run release:check` antes da publicação e conferir novamente o domínio oficial depois dela.

## Prioridade da próxima publicação — disponibilidade de fatias por horário

Esta entrega está marcada como **prioridade para o próximo deploy**. Ela permite manter, para o mesmo sabor e dia, lotes com quantidades disponíveis imediatamente e lotes liberados em horários como 8h, 9h, 12h, 17h e 20h. O carrinho considera todas as fatias escolhidas e informa o primeiro horário em que o pedido completo poderá ser retirado.

Estado atual: código implementado, revisão da cadeia de pedido concluída, testes automáticos aprovados e interface validada localmente em computador e celular com dados simulados. Ainda não foi aplicada em produção.

Antes de entrar no próximo deploy, é obrigatório:

1. aplicar a migração `20260815110239_add_inventory_availability_batches.sql` em homologação;
2. cadastrar lotes por horário usando uma conta real da equipe;
3. concluir um pedido real contendo estoque imediato e futuro;
4. validar reserva, pagamento, cancelamento e devolução do estoque;
5. executar novamente `npm run release:check`;
6. obter autorização explícita antes da publicação em produção.

### 22/07/2026 — pedidos imediatos em homologação

Foi criada a fundação dos pedidos individuais de fatias para retirada. O cliente monta quantidades a partir do Adoce Hoje, recebe um número de pedido e continua o atendimento pelo WhatsApp. A operação ganhou uma fila própria de Vendas com confirmação, reserva transacional de estoque, pagamento manual, separação, retirada, cancelamento e histórico. O endereço de retirada fica registrado no pedido, evitando divergência quando houver mais de um local de atendimento.

O checkout automático permanece desligado até a configuração segura do Mercado Pago. Enquanto isso, nenhum estoque é reservado automaticamente sem que a equipe confirme a disponibilidade. Reservas confirmadas expiram e devolvem o estoque automaticamente. A interface operacional também recebeu uma disposição específica para tablets compactos, tomando o Galaxy Tab A7 Lite como primeiro aparelho de validação.

### 20/07/2026 — Pede Junto Adoce publicado

O produto anterior de pedido coletivo foi substituído pelo Pede Junto Adoce em todo o site. A experiência permite sala compartilhada sem limite coletivo de fatias, entrega grátis liberada na quinta unidade, continuidade do grupo após a meta, escolha separada por participante e pagamento individual. A operação recebeu controle de estoque, reservas, participantes, links do Mercado Pago e evolução do pedido. O banco e o frontend foram publicados, e o fluxo real foi validado com dez fatias em computador, tablet e celular. O grupo e o estoque criados exclusivamente para o teste foram removidos após a conferência.

## Estado em 18/07/2026

O Clube Adoce já ultrapassou a fase de página estática. A estrutura institucional, o ambiente do cliente e a operação da equipe estão publicados, com dados reais no Supabase e autenticação definitiva por e-mail.

| Ambiente | Endereço | Estado atual |
| --- | --- | --- |
| Site oficial | `https://www.adocebrigaderia.com.br` | Publicado com HTTPS |
| Clube Adoce — cliente | `https://www.adocebrigaderia.com.br/#entrar` | Publicado; `clube.adocebrigaderia.com.br` aguarda registro DNS |
| Adoce Operação — equipe | `https://www.adocebrigaderia.com.br/#operacao` | Publicado; `operacao.adocebrigaderia.com.br` aguarda registro DNS |
| Autenticação por e-mail | `auth.adocebrigaderia.com.br` | Domínio verificado e remetente ativo |
| Backend e banco de dados | Supabase, região de São Paulo | Produção ativa no plano Free |

O domínio principal e os subdomínios utilizam HTTPS. O DNS permanece administrado no Registro.br, e a aplicação web é entregue pela Netlify.

## Recursos já disponíveis

- cadastro e acesso do cliente por código enviado por e-mail;
- conclusão obrigatória do perfil antes da liberação completa do cartão;
- cartão fidelidade principal com uma fatia igual a um carimbo;
- conclusão automática do cartão ao atingir 14 carimbos;
- prêmio acumulável, sem obrigar retirada imediata;
- resgate de fatia tradicional ou premium mediante pagamento da diferença;
- cartão exclusivo de indicações **Espalhe Doçura**;
- convite por link pessoal, com vínculo automático da indicação;
- QR Code do cliente e busca alternativa por parte do nome, telefone ou e-mail;
- registro de compras e resgates pela equipe;
- histórico e auditoria das movimentações;
- perfis de Proprietário, Gerente e Atendimento;
- página pública **Adoce Hoje** com catálogo, disponibilidade e canais de atendimento;
- instalação como aplicativo web no Android e no iPhone, respeitando as orientações próprias de cada sistema;
- administração do Adoce Hoje pela equipe, incluindo produtos, fotos, disponibilidade, horários, canais e promoções.

## Em evolução e ainda não anunciado como concluído

- Apple Wallet e Google Wallet como acesso principal ao cartão;
- Cartão em Grupo para casais, famílias e grupos de amigos;
- notificações de sabores, horários e promoções conforme as preferências do cliente;
- integração de autenticação e comunicação pelo WhatsApp;
- ampliação das rotinas administrativas e relatórios do CRM;
- revisão contínua de responsividade, acessibilidade e experiência em diferentes aparelhos.

## Histórico resumido

### 14/07/2026 — apresentação institucional

Foi publicada a primeira apresentação oficial na direção visual **Chocolate Depois das Oito**, com domínio próprio ainda em configuração.

### 16/07/2026 — piloto funcional

O primeiro piloto com dados reais validou cadastro, carimbos, conclusão de cartão, prêmio acumulável e resgate sem interromper o ciclo seguinte.

### 17/07/2026 — autenticação e operação reais

O domínio de envio foi verificado no Resend, o SMTP foi integrado ao Supabase e o acesso definitivo por código de e-mail entrou em funcionamento. Cliente, operação, Adoce Hoje, QR Code e indicações passaram a ser testados em situação real.

### 18/07/2026 — administração do Adoce Hoje

A operação recebeu os recursos para administrar produtos, várias fotos por sabor, disponibilidade, horários, canais e promoções sem depender de uma alteração manual no código a cada atualização cotidiana.

## Regra de publicação

### 08/10/2026 — regressão de custos: diagnóstico e recuperação local

A publicação `6ac682cbf7959b00a1aa902b`, realizada em 07/10/2026 às 14h35 (Brasília), contém o módulo simplificado de custos: consulta `manager_get_costing_technical_workspace`, sem o fluxo de notas fiscais e sem a lista de preparações cadastradas. O módulo completo permaneceu em `Clube Adoce Release WhatsApp 20260901`, cuja configuração aponta para o mesmo site Netlify da pasta principal. A divergência entre cópias permitiu publicar uma versão funcionalmente anterior. Os metadados indicam publicação por CLI e não identificam um commit; não permitem atribuir, por si, a execução a uma pessoa ou recuperar o diretório exato usado.

A consulta somente de leitura ao banco de produção em 08/10/2026 confirmou 27 preparações ativas, nenhuma preparação arquivada, 82 versões de receitas, 46 insumos, 5 fornecedores e 11 notas fiscais. Esses registros não foram excluídos pela recuperação. As funções necessárias à versão completa continuam presentes, com execução negada ao papel anônimo.

O módulo completo e suas dependências foram recuperados na pasta principal, preservando uma cópia dos arquivos anteriores. A compilação agora executa `scripts/verify-operation-release.mjs`, que bloqueia o pacote quando faltam referências obrigatórias de preparações, tempos, insumos, fornecedores, notas, edição e histórico. A verificação percorre apenas os arquivos alcançáveis pelo ponto de entrada; arquivos antigos soltos não podem satisfazer o bloqueio. Testes reproduzem a versão simplificada, a ausência de cada referência e a presença de um pacote antigo desconectado.

Essa barreira identifica a perda estrutural observada neste incidente; não comprova o funcionamento completo dos fluxos nem substitui homologação autenticada. A pasta principal `D:\AdoceOnLine` deve concentrar o código mantido e os comandos de publicação deste produto. Cópias de release não devem ser usadas como fontes independentes para publicar no mesmo site. Uma publicação direta que contorne a compilação também contorna essa barreira.

Estado: recuperação local com validação automatizada; publicação de produção e validação visual autenticada em computador, celular e tablet ainda pendentes. Não houve alteração de dados nem nova publicação durante o diagnóstico.

Novos recursos só devem ser apresentados ao público como disponíveis depois de passarem por validação funcional no ambiente de produção. Funcionalidades ainda em construção devem permanecer identificadas como próximas etapas, sem induzir o cliente a acreditar que já estão liberadas.

### 20/07/2026 — reforço de identidade e segurança em validação

Foi implementada a migração do acesso do cliente para celular e senha após a primeira confirmação por e-mail, com opção de manter a sessão e preparação para passkeys. Também foram criados controles protegidos para desativação, reativação, solicitação de exclusão e revisão de duplicidade, sempre com motivo, auditoria e estado da notificação ao cliente. Em 20/07/2026, as migrações foram aplicadas no projeto de produção, os 21 perfis existentes foram preservados e a chave segura do servidor foi configurada na Netlify. A entrega ainda depende da validação final dos fluxos nos domínios oficiais.

### 20/07/2026 — revisão comercial e imagens publicadas

As páginas comerciais foram reorganizadas para apresentar fotos reais sem deformação, usar uma única imagem principal nas categorias de serviço e separar corretamente Festas e Eventos, Adoce na Escola e Aluguel de Decoração. A Festa na Mesa foi direcionada para Mini Festas, dentro de Festas e Eventos. A operação recebeu controles para trocar fotos, textos, itens incluídos, regras, pacotes e valores. Pede Junto Adoce, Clube Adoce e o exemplo do Adoce Hoje também receberam imagens coerentes com cada proposta. A estrutura de mídias e os vínculos corretos das fotografias foram aplicados ao banco em 20/07/2026; resta a validação final após a publicação do frontend.

### 20/07/2026 — publicação e conferência final da vitrine

A revisão comercial foi publicada no domínio principal e conferida em telas de computador e celular. Foram validados: imagens completas dos docinhos, foto única nos serviços, separação entre Eventos e Escola, apresentação anterior do pedido coletivo, exemplo ilustrativo do Adoce Hoje, login do cliente por celular e senha, linguagem própria da operação e funções protegidas no servidor. A inspeção não encontrou erros no navegador. A verificação de DNS confirmou que os subdomínios `clube` e `operacao` ainda precisam ser criados; até lá, as rotas oficiais permanecem disponíveis no domínio principal.

### 19/07/2026 — catálogo, agenda e CRM

Foi publicada a base de produção para pedidos por encomenda, produtos e preços administráveis, recheios e adicionais com acréscimos, pré-reservas de 48 horas, conflitos de agenda, bloqueios manuais, histórico de solicitações, notas e tarefas de relacionamento. A página pública separa o Festival de Fatias das encomendas e eventos. O acesso assistido da operação passou a gerar link direto de autenticação, mantendo o código como alternativa. Também foi exportado o kit visual completo para o anúncio oficial do site em Instagram, Facebook e WhatsApp.


### 08/10/2026 — consolidação ampliada da Operação

Além de custos, foram reunidos na pasta principal os fluxos de caixa, gestão, histórico, comunicação e suporte que estavam divergentes na cópia de release. As regras públicas mais recentes de rotas por caminho, Pix e retirada foram preservadas. Alterações ainda não instaladas da integração financeira de notas fiscais permanecem separadas como migração e registro de diferenças, sem instalação em produção.

A pasta de trabalho `D:\AdoceOnLine-NF` foi removida. A exclusão das demais pastas foi rejeitada pela revisão automática, que retornou apenas "blocked by policy". Vinte e duas cópias tiveram seus comandos desativados e vínculos locais de publicação retirados enquanto aguardam remoção física. Foi preparado `scripts/remover-copias-adoce.ps1`, com lista explícita e conferência dos caminhos, para executar a remoção já autorizada. O banco e os arquivos de dados da réplica foram preservados em arquivo privado dentro de `.git`, sem outra aplicação executável. Não houve nova publicação nem alteração do banco de produção.

### 13/10/2026 — fonte física única e reconstrução conferida

O inventário encontrou a fonte oficial, cópias de release, uma cópia externa completa, projetos antigos incorporados à pasta principal e artefatos de homologação. A cópia completa era de 06/10/2026 e continha módulos anteriores à Operação atual; nenhum código exclusivo válido ficou fora da fonte oficial. As cópias inventariadas, builds, APKs e capturas temporárias foram removidos. O projeto Android permanece dentro de `D:\AdoceOnLine` como parte do mesmo produto.

O verificador de fonte única passou a detectar também cópias irmãs completas no mesmo volume, além de cópias internas e execução fora do caminho canônico. A regra está fixada em `AGENTS.md`, neste guia e em teste automatizado. O código consolidado passou por 926 testes, verificação de tipos, build e verificação dos recursos obrigatórios da Operação.

No Supabase de produção, a edição de fichas no mesmo registro está ativa, não há referência de preparação presa a versão antiga e nenhuma tabela do esquema público está sem RLS. Os horários da migração remota diferem dos nomes locais porque as alterações foram registradas pelo ambiente de produção; a conferência foi feita pelo efeito real no banco. Alertas históricos dos consultores permanecem documentados e não foram alterados sem uma tarefa específica de segurança.

Antes da publicação desta consolidação, a produção apontava para o deploy `6ace29214895d942402da280`, de 13/10/2026. O nome do arquivo JavaScript diferia no build local sem as variáveis da Netlify; a compilação executada dentro do ambiente de produção gerou o mesmo ativo que já estava servido.

Publicação final: deploy de produção `6ace4076ba8c5ad86fbc383b`, concluído em 13/10/2026 a partir de `D:\AdoceOnLine`. A Netlify comparou 273 arquivos e 41 funções e não solicitou o envio de nenhum deles, comprovando que o pacote atômico já servido imediatamente antes era idêntico ao pacote gerado pela fonte consolidada. As rotas `/`, `/adoce-hoje`, `/entrar` e `/operacao` responderam HTTP 200 após a publicação.
