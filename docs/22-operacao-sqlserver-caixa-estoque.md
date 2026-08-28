---
title: Operação real, SQL Server, caixa, estoque e pedidos
description: Especificação executável da Adoce Operação, preservando o motor de custos e preparando uma arquitetura econômica com SQL Server.
status: Plano aprovado para implementação por fases
---

# Operação real, SQL Server, caixa, estoque e pedidos

## 1. Decisão executiva

É tecnicamente viável operar a Adoce com **SQL Server em uma máquina virtual na nuvem**, sem Supabase, desde que o navegador nunca se conecte diretamente ao banco. A configuração mínima segura é:

```text
Site/PWA Next.js
      |
      | HTTPS / JSON
      v
API ASP.NET Core 10 + Identity + autorização por permissão
      |                         |
      | TLS/rede privada        +--> storage de objetos para fotos e comprovantes
      v
SQL Server 2025 Express ou Standard
      |
      +--> backups criptografados fora da VM + restauração ensaiada
```

Recomendação para começar gastando menos:

1. uma VM pequena com Windows Server ou Linux compatível, SQL Server 2025 Express e API ASP.NET Core;
2. proxy HTTPS gerenciado por IIS, Caddy ou Nginx;
3. porta do SQL Server fechada para a internet e liberada somente para a API pela rede local, firewall ou túnel privado;
4. arquivos em storage de objetos compatível com S3, Azure Blob ou equivalente, nunca em `VARBINARY(MAX)` como regra geral;
5. frontend estático/SSR no provedor atual, comunicando-se apenas com a API;
6. backup full diário, diferencial periódico e log a cada 10–15 minutos quando a edição/modelo de recuperação permitir;
7. observabilidade, antivírus/EDR, atualizações e alerta de espaço, CPU, memória, backup e erro da API.

O SQL Server Express 2025 admite banco relacional de até 50 GB, usa no máximo 4 cores e aproximadamente 1,4 GB de buffer pool. É suficiente para o piloto e uma loja pequena, mas imagens não devem consumir esse limite. A edição Developer não pode ser usada em produção. Se o volume, concorrência ou disponibilidade exigirem mais recursos, a migração natural é SQL Server Standard, Azure SQL ou outro serviço gerenciado compatível.

### 1.1 O que o SQL Server substitui e o que não substitui

| Necessidade | SQL Server sozinho resolve? | Componente necessário |
|---|---|---|
| Clientes, produtos, pedidos, estoque, reservas, caixa e auditoria | Sim | Modelo relacional, procedures e transações |
| API segura para site/app | Não | ASP.NET Core |
| Cadastro, login, senha, MFA e reset | Não sozinho | ASP.NET Core Identity e provedor de e-mail/WhatsApp |
| Upload e entrega de imagens | Não é a melhor opção | Storage de objetos + CDN/URLs assinadas |
| Realtime/notificações | Não | SignalR, polling controlado ou fila |
| Filas, retentativas e WhatsApp | Não | Worker/Hosted Service e tabela outbox |
| Backups, patching e alta disponibilidade | Não automaticamente em VM própria | Rotinas operacionais e monitoramento |
| RLS semelhante ao Supabase | Parcialmente | Row-Level Security do SQL Server + autorização obrigatória na API |

### 1.2 Comparação realista

| Critério | SQL Server em VM própria | Supabase |
|---|---|---|
| Custo inicial | Pode ser baixo se a VM e a licença Express já existem | Free reduz custo do piloto; Pro inclui serviços gerenciados |
| Trabalho operacional | Alto: SO, SQL, firewall, backup, restauração, disponibilidade | Menor: banco, Auth, Storage e APIs integrados |
| Controle | Alto | Alto no banco, menor na infraestrutura gerenciada |
| Autenticação | Precisa ser construída/configurada | Auth pronto e integrado |
| Storage | Externo ou autogerido | Integrado |
| Realtime | SignalR/fila/polling | Integrado |
| Escala inicial | Boa para uma loja | Boa e rápida de implantar |
| Risco principal | Administração insuficiente da VM e perda de backup | Limites/custos do plano e dependência da plataforma |
| Migração futura | Boa se API isolar o banco | Boa se domínio não depender diretamente do SDK no frontend |

**Decisão recomendada:** adotar arquitetura portável por API. O frontend não conhece SQL Server nem Supabase. No piloto, o adaptador pode continuar lendo o Supabase existente enquanto o banco SQL Server é construído e reconciliado. A troca da fonte ocorre por módulo e por feature flag, nunca por uma migração “tudo de uma vez”.

## 2. Evidências preservadas da calculadora de custos

Foram analisados diretamente como fontes principais:

- `D:\adoce_calculadora_custos_offline_novo_visual.html`;
- `D:\adoce-custos-backup.json`.

O JSON foi parseado integralmente; do HTML foram extraídos a estrutura de telas, o armazenamento, os campos e as funções de cálculo relevantes. O backup contém 12 categorias, 44 ingredientes, 9 receitas-base, 13 preparações, 1 torta final, 9 itens de patrimônio e parâmetros operacionais. Os dados ficam atualmente em `localStorage` e o HTML oferece importação/exportação JSON.

### 2.1 Entidades que não podem ser achatadas

| Entidade atual | Conteúdo preservado |
|---|---|
| Ingrediente | nome, categoria, marca/fornecedor, preço avulso, conteúdo, unidade, unidades por caixa e preço da caixa |
| Receita-base | tipo, itens, rendimento, unidade, quantidade física, derivação, receita de origem e tempos de equipamento/gás |
| Preparação | receitas-base consumidas, ingredientes diretos, rendimento e quantidade física |
| Torta/sabor | camadas, recheios, coberturas, itens diretos, embalagens, extras, margem, preço praticado e rendimentos por tamanho/canal |
| Custos de operação | energia, gás, refrigeração, mão de obra, pró-labore, embalagem, materiais, depreciação, manutenção, infraestrutura e deslocamentos |
| Patrimônio | categoria, quantidade, data/valor de compra, vida útil, residual, situação, uso, reserva e observações |

### 2.2 Fórmulas que passam a ser contrato de domínio

1. `custo_unitario = min(preco_avulso / conteudo, preco_caixa / (unidades_caixa * conteudo))`.
2. Receita derivada usa fator por percentual, quantidade física ou divisor.
3. Custo da receita = ingredientes + energia/gás próprios ou proporcionais à receita de origem.
4. Custo por rendimento = custo da receita / rendimento.
5. Preparação = bases consumidas por rendimento/quantidade + ingredientes diretos.
6. Produto/torta = camadas + preparações + diretos + custos operacionais + embalagem + extras + rateios.
7. Rateio mensal usa produção mensal e inclui refrigeração, pessoas, patrimônio, infraestrutura e deslocamento.
8. Perdas, energia adicional e fixos percentuais incidem sobre o custo de ingredientes conforme a regra atual.
9. `preco_sugerido = custo_total * (1 + margem_desejada) / (1 - taxa_canal)`.
10. `margem_real = (preco_praticado * (1 - taxa_canal) - custo_total) / preco_praticado`.

Nenhum cálculo histórico será recalculado silenciosamente quando preço de ingrediente ou parâmetro mudar. Pedido, produção e orçamento armazenam um **snapshot versionado** dos custos, rendimentos e preços usados naquele momento.

## 3. O que estava faltando na ideia inicial

1. **Estados ortogonais:** pedido, pagamento, separação/entrega e alteração precisam de campos separados; um único status não representa “confirmado, parcialmente pago e parcialmente retirado”.
2. **Livro-razão de estoque:** “quantidade disponível” é projeção; toda entrada, reserva, venda, sobra, perda, doação ou reversão precisa gerar movimento imutável.
3. **Lote e validade:** a fatia precisa conhecer lote, data de produção, disponibilidade, validade e destino de sobra.
4. **Concorrência:** duas pessoas podem vender a última fatia. Reserva exige transação, bloqueio curto, `rowversion`, idempotência e regra `livre >= solicitado` no banco.
5. **Preço histórico:** item de pedido guarda nome, tamanho, preço, taxa, custo e composição resumidos; não depende do cadastro atual para explicar uma venda antiga.
6. **Parcialidade real:** entrega/retirada parcial exige remessas e quantidade atendida por item, não apenas um status no pedido.
7. **Comunicação comprovável:** abrir `wa.me` comprova tentativa de abertura, não envio ou leitura. O sistema deve registrar `prepared`, `open_attempted`, `user_confirmed_sent`, `delivered` apenas quando houver API/webhook.
8. **Alteração em duas fases:** mudança relevante nasce como proposta, reserva provisoriamente a diferença de estoque, gera comunicação e só então é aplicada/aprovada.
9. **Caixa físico separado de vendas:** Mercado Pago, Pix e cartão não alteram o dinheiro da gaveta. Devem conciliar venda bruta, taxa, líquido e liquidação separadamente.
10. **Sobras valorizadas em duas bases:** custo e preço de venda. O fechamento operacional não deve tratar potencial de venda como dinheiro recebido.
11. **Reabertura de caixa:** exige nova versão do fechamento, motivo, permissão elevada e vínculo com o fechamento substituído.
12. **Orçamento:** solicitação, proposta e pedido são entidades/estágios distintos; clicar no WhatsApp não cria venda confirmada.
13. **LGPD e retenção:** endereço, aniversário, foto e observações têm finalidade, acesso mínimo, retenção e anonimização definidos.
14. **Recuperação segura:** “senha padrão” só pode ser temporária, aleatória, expirar rapidamente e obrigar troca; nunca uma senha fixa para todos.
15. **Migração sem quebra:** precisamos de IDs de origem, reconciliação por contagem/hash, execução repetível e rollback por módulo.

## 4. Princípios invioláveis

- Produção, homologação e desenvolvimento possuem bancos, chaves, buckets e usuários distintos.
- Cliente nunca recebe rota, métrica, nota interna, custo, margem, estoque reservado por terceiros ou link administrativo.
- SQL Server não aceita conexão da internet pública; a API usa credencial própria com permissão mínima.
- Valores monetários usam `decimal(19,4)`; quantidades usam `decimal(19,6)`; nunca `float` ou `money`.
- Datas operacionais usam `date` e `time`; eventos usam `datetime2(3)` em UTC e guardam o fuso da loja na configuração.
- Chaves usam `uniqueidentifier` com `NEWSEQUENTIALID()` ou `bigint` identity em ledger de alto volume.
- Toda tabela mutável relevante possui `rowversion`, `CreatedAt`, `CreatedBy`, `UpdatedAt` e `UpdatedBy` quando aplicável.
- Ledger financeiro, estoque, auditoria, consentimento e histórico não são apagados; correções criam reversão vinculada.
- Toda operação externa ou repetível recebe `Idempotency-Key`.
- Toda mudança de preço/composição gera versão; não sobrescreve a versão usada por vendas anteriores.
- Foto é opcional e recebe fallback visual real da marca.

## 5. Arquitetura recomendada

### 5.1 Componentes

| Componente | Tecnologia sugerida | Responsabilidade |
|---|---|---|
| Web/PWA | Next.js/React existente | site, Clube e operação responsiva |
| API | ASP.NET Core 10 | contratos, validação, autenticação, autorização e transações |
| Persistência | EF Core para cadastros; Dapper/procedures para estoque/caixa crítico | acesso ao SQL Server sem SQL no navegador |
| Banco | SQL Server 2025 Express inicial | fonte transacional principal |
| Auth | ASP.NET Core Identity | hash de senha, bloqueio, tokens e papéis |
| Worker | .NET Worker/Hosted Service | outbox, mensagens, thumbnails, expirações e reconciliação |
| Arquivos | storage de objetos | imagens, avatares e comprovantes |
| Cache/limites | memória distribuída ou Redis quando necessário | rate limit, sessão e respostas curtas |
| Observabilidade | OpenTelemetry + coletor/log central | traces, métricas e logs mascarados |

### 5.2 Rede e segurança da VM

- Expor somente `443/TCP` no proxy da API e acesso administrativo por VPN/túnel com MFA.
- Bloquear `1433/TCP` externamente. A API usa `localhost`, rede privada ou security group específico.
- Conta do serviço sem privilégios de administrador; login SQL exclusivo da aplicação, sem `sysadmin`, `db_owner` ou `sa`.
- TLS obrigatório entre proxy/API e entre API/banco quando não estiverem no mesmo host.
- Segredos em cofre/variáveis protegidas; nunca em repositório, bundle ou `NEXT_PUBLIC_*`.
- Defender/EDR, atualizações mensais com janela definida, alerta de reinício pendente e varredura de vulnerabilidade.
- Backups criptografados em conta/storage diferente da VM; retenção sugerida: 7 diários, 5 semanais e 12 mensais, ajustada à política legal.
- Ensaio de restauração mensal em ambiente isolado; backup sem restore testado não conta como backup validado.

### 5.3 Fotos e anexos

Metadados ficam em `files.StoredFiles`; bytes ficam no storage de objetos. Fluxo:

1. frontend pede autorização à API;
2. API valida permissão, MIME, extensão, tamanho e finalidade;
3. upload vai para chave opaca `environment/store/entity/id/version.ext`;
4. worker remove metadados EXIF, verifica malware e cria variantes WebP/AVIF;
5. somente após aprovação o arquivo vira ativo;
6. privado usa URL assinada curta; produto público usa URL CDN sem revelar caminho interno.

Limites iniciais: produto 8 MB, avatar 4 MB, comprovante 10 MB; JPEG/PNG/WebP/HEIC convertidos no servidor. Nunca confiar apenas no `Content-Type` enviado pelo navegador.

### 5.4 Autenticação, reset e acesso direto

- senha armazenada apenas pelo Identity com hash forte e parâmetros atualizáveis;
- bloqueio progressivo após tentativas falhas; rate limit por conta, IP e dispositivo;
- colaborador: senha + MFA obrigatório para administrador e recomendado para caixa;
- cliente: senha, código de uso único ou link direto de uso único;
- reset por link: token aleatório, hash no banco, uso único, expiração de 15–30 minutos;
- acesso direto a um pedido: token aleatório com escopo `order:read` ou `order:change_request`, sem criar sessão administrativa;
- senha temporária: aleatória, expira em até 30 minutos, `MustChangePassword=1`, sessões anteriores revogadas conforme opção escolhida;
- toda emissão registra ator, motivo, canal, IP/dispositivo, expiração e resultado, sem gravar token/senha em claro.

## 6. Arquitetura de informação da Adoce Operação

Não usar quatorze abas horizontais competindo. A navegação agrupa tarefas reais:

```text
Início
Vender
  Pedidos de hoje
  Novo pedido de balcão
  Pré-reservas e encomendas
Produzir
  Produção do dia
  Estoque e lotes
  Cardápio semanal
Caixa
  Abertura
  Movimentos
  Fechamento
Relacionar
  Clientes e Clube
  Orçamentos
Gerenciar
  Produtos e custos
  Colaboradores e permissões
  Relatórios, auditoria e configurações
```

No tablet horizontal: rail lateral de 88 px, cabeçalho compacto, conteúdo em duas colunas e painel de detalhes lateral. No iPhone: barra inferior com **Início, Pedidos, Produção, Caixa e Mais**; formulários e detalhes ocupam uma tela por vez. Alvos de toque mínimos de 44×44 px, campos de operação com 48–52 px, sem depender de hover ou cor.

### 6.1 Componentes globais

- `OperationStatusBar`: loja, caixa, conexão, sincronização e operador.
- `PriorityQueue`: pendências ordenadas por risco e horário.
- `EntitySearch`: nome, telefone, número, QR e filtros.
- `StatusChip`: ícone + texto + cor.
- `MoneySummary`: bruto, taxa, líquido e situação.
- `InventoryCounter`: disponível, reservado, separado e livre.
- `AuditDrawer`: quem/quando/antes/depois/motivo.
- `WhatsAppHandoff`: mensagem, destinatário, abrir, confirmar envio e registrar falha.
- `ActionGuard`: reautenticação, motivo e confirmação para ações críticas.
- `OfflineBanner`: leitura limitada; proíbe confirmação transacional offline.

### 6.2 Estados obrigatórios em todas as telas

`loading`, `empty`, `partial`, `stale`, `offline`, `forbidden`, `not-found`, `conflict`, `validation-error`, `server-error`, `success`, `saving`, `saved`, `pending-communication` e `retrying`. Mensagens devem dizer o que ocorreu e o próximo passo; não usar somente “erro inesperado”.

## 7. Catálogo executável de telas

### OP-00 — Login da equipe

Campos: celular/e-mail, senha, manter conectado em aparelho particular. Ações: entrar, recuperar acesso, trocar senha temporária. Validações: formato, mínimo de senha, bloqueio, conta ativa, vínculo de colaborador e permissão. Erros não revelam se a conta existe. Após 5 falhas, atraso progressivo e desafio adicional. Sessão de caixa nunca é compartilhada entre colaboradores.

### OP-10 — Início da operação

Mostra somente indicadores acionáveis: caixa, pedidos vencendo, pagamentos pendentes, pedidos a separar, pré-reservas, estoque livre/reservado, sobras, perdas e divergências. Cada cartão abre a fila já filtrada. Estado vazio: “Nenhuma pendência para agora” + próxima ação útil. Não mostrar faturamento histórico a perfil restrito.

### OP-20 — Pedidos de hoje

Tablet: lista por etapa à esquerda e ficha do pedido à direita. Celular: filtros em chips e navegação lista → detalhe. Filtros: atraso, origem, tipo, pagamento, atendimento, horário, retirada/entrega e cliente. Ações rápidas: confirmar, separar, pronto, receber, entregar/retirar, falar no WhatsApp. Nenhuma ação muda dois domínios implicitamente: “Pago” não significa “entregue”.

### OP-21 — Detalhe e edição de pedido

Cabeçalho: número, tipo, horário, cliente, WhatsApp e alertas. Blocos: itens, totais, pagamento, atendimento, comunicações, histórico e notas internas. Edição abre uma proposta comparando antes/depois; calcula valor e estoque; pede motivo; gera mensagem; aplica automaticamente somente se política permitir e comunicação for registrada.

### OP-22 — Novo pedido de balcão

Fluxo de três passos: identificar/seguir sem Clube; montar itens; receber e confirmar. Busca rápida por telefone/QR, produtos filtrados por estoque livre, modificadores grandes, total sempre visível e botão “Confirmar venda” bloqueado até forma/valor de pagamento serem válidos. Deve aceitar venda anônima sem criar cliente falso.

### OP-30 — Pré-reservas e encomendas

Filas separadas por `pendente`, `confirmar hoje`, `confirmada`, `expirando`, `recusada` e `convertida`. Mostra validade da reserva, estoque bloqueado, pagamento antecipado, data/horário e contato. Confirmar converte para pedido em transação única; recusar libera estoque e exige motivo/comunicação.

### OP-31 — Orçamentos

Solicitação → proposta → negociação → aceita/recusada/expirada → pedido. Campos de bolo/docinho/tábua são estruturados, não apenas observação. O WhatsApp é canal de conversa, mas versão, preço, validade e aceite da proposta ficam no sistema.

### OP-40 — Produção do dia

Planejado, produzido, liberado, reservado, vendido e restante por sabor/lote. Cadastro do lote: produto/tamanho, quantidade de tortas, fatias por torta, quantidade resultante, produzido em, libera em, validade, custo snapshot e responsável. Divergência entre quantidade calculada e informada exige motivo.

### OP-41 — Estoque e lotes

Visões “Agora”, “Hoje” e “Próximos dias”. Não editar saldo diretamente: ações geram movimento `ADJUSTMENT`, `LOSS`, `LEFTOVER`, `DONATION`, `INTERNAL_CONSUMPTION`, `EXCHANGE` ou `REWARD`. Mostrar físico, reservado, separado e livre. Estoque livre nunca pode ficar negativo.

### OP-42 — Cardápio semanal

Calendário semanal com dia/data, local, horários, sabores, lote/tortas/fatias, preço, reserva, limite e corte. Publicação tem rascunho e versão publicada. Alterar item já reservado cria impacto e não publica até resolver as reservas afetadas.

### OP-50 — Abertura de caixa

Assistente em quatro passos: conferência da sessão anterior; dinheiro inicial; produção/sobras; pré-reservas e separação. Ao confirmar, grava snapshot operacional, assinatura do responsável e status `OPEN`. Duas sessões abertas para a mesma loja/caixa são proibidas.

### OP-51 — Movimentos de caixa

Ações grandes: venda, recebimento, sangria, retirada/despesa e reforço. Permuta, prêmio, doação, consumo, sobra e perda são baixas operacionais/estoque; somente criam movimento financeiro quando houver dinheiro. Anexo é opcional, mas motivo e autorização seguem política por tipo/valor.

### OP-52 — Fechamento de caixa

Assistente em seis passos: produção/estoque; dinheiro contado; pagamentos; baixas; sobras/perdas; conferência e assinatura. Mostra três reconciliações independentes: estoque, vendas/pagamentos e dinheiro físico. Divergência não é apagada: fecha como `CLOSED_WITH_VARIANCE` ou retorna para correção autorizada.

### OP-60 — Produtos e custos

Editor em seções: básico, venda, tamanhos, composição, custo, preços por canal, imagens e histórico. A foto é opcional. Alterar composição cria nova versão. Publicar preço exige vigência. O cálculo exibe origem de cada valor e avisa ingrediente sem preço, unidade incompatível, rendimento zero e margem abaixo do mínimo.

### OP-61 — Ingredientes, receitas e preparações

Replica todos os campos da calculadora, acrescentando versão, vigência, fornecedor, perda e conversão de unidade. O sistema impede ciclo de receita derivada e composição recursiva. Importação do JSON oferece prévia, relatório de conflitos e execução idempotente.

### OP-70 — Clientes e Clube

Busca completa e paginada. Ficha: contato, endereços, pedidos, reservas, Clube, consentimentos, notas internas, acesso e auditoria. Ações sensíveis ficam em “Acesso e segurança”, com permissão e motivo. Cliente desativado continua no histórico e não pode fazer novo pedido autenticado.

### OP-71 — Colaboradores

Dados, foto opcional, papel, permissões adicionais/revogadas, lojas, status, MFA, sessões e histórico. Reset, revogação de sessões, mudança de papel e desativação exigem reautenticação do administrador e auditoria.

### OP-80 — Relatórios e auditoria

Relatórios por período, loja, canal, método, produto e colaborador. Exportação é auditada. Auditoria permite filtro por entidade/ação/ator e comparação antes/depois, mas nunca exibe senha, token, chave, OTP ou dados de cartão.

### OP-90 — Configurações

Horários, locais, meios/taxas de pagamento, políticas de reserva/alteração, destinatários de WhatsApp, templates e limites de autorização. Toda configuração possui vigência e histórico. Mudança global exibe impacto antes de salvar.

## 8. Fluxos operacionais

### 8.1 Abertura de caixa

1. Colaborador autenticado escolhe loja e caixa físico.
2. API verifica permissão, sessão anterior e exclusividade.
3. Sistema mostra fechamento anterior, pendências e divergências não resolvidas.
4. Operador conta fundo inicial por denominação ou informa total com justificativa configurável.
5. Sistema carrega lotes liberados, sobras válidas e produção esperada.
6. Operador confirma quantidades físicas; diferenças geram ajustes pendentes de autorização.
7. Pré-reservas/pedidos são agrupados por horário e mostram bloqueio de estoque, pagamento e separação.
8. Operador marca o que já está fisicamente separado.
9. API grava `CashOpening`, snapshot de inventário, sessão `OPEN` e auditoria em uma transação.
10. Dashboard passa a mostrar a sessão ativa e responsável.

### 8.2 Fechamento de caixa

1. Bloquear novas ações do próprio caixa por poucos segundos, sem parar pedidos de outros dispositivos.
2. Conferir produção inicial + entradas + sobras recebidas.
3. Conferir vendidos, reservados, separados, sobras finais e baixas por lote.
4. Contar dinheiro físico; informar retiradas, reforços e despesas.
5. Importar/conferir Pix, cartão, Mercado Pago e outros por valor bruto, taxa e líquido.
6. Calcular reconciliação de estoque:
   `inicial + entradas - vendido - sobra_transferida - perda - doacao - consumo - permuta - premio = fisico_final`.
7. Calcular gaveta:
   `esperado = abertura + recebimentos_em_dinheiro + reforcos - sangrias - despesas_em_dinheiro`.
8. `diferenca_gaveta = contado - esperado`.
9. Calcular vendas/pagamentos separadamente:
   `vendas_brutas = pagamentos_aplicados + contas_a_receber + estornos/ajustes compatíveis`.
10. Exigir motivo e aprovação quando tolerância for excedida.
11. Gerar snapshot, relatório WhatsApp e hash do fechamento.
12. Fechar como `CLOSED` ou `CLOSED_WITH_VARIANCE`; reabertura cria nova versão.

O valor potencial da produção (por exemplo, 91 fatias × R$ 16) é uma **valoração de estoque**, não faturamento. Só vira venda quando um item de pedido é confirmado. Mercado Pago deve guardar bruto, taxa e líquido; comparar valor líquido diretamente com venda bruta cria falsa divergência.

### 8.3 Pedido e alteração

1. Pedido nasce como `DRAFT` ou `AWAITING_CONFIRMATION` conforme o canal.
2. Cada item valida produto/tamanho, regra comercial, preço vigente e estoque.
3. Reserva de estoque usa transação e expiração; confirmação converte hold em reserva firme.
4. Pagamento e atendimento evoluem independentemente.
5. Alteração cria `OrderChange` com versão base, itens antes/depois, diferença e impacto de estoque.
6. Se cliente pode alterar automaticamente e não há aumento de risco/valor, aplicar após registro de comunicação.
7. Nos demais casos, ficar `AWAITING_APPROVAL`; loja aprova ou recusa com motivo.
8. Aprovação aplica em uma transação: versões, estoque, pagamento pendente/reembolso e histórico.
9. Cancelamento reverte reservas por movimento vinculado, nunca por exclusão.
10. Entrega/retirada parcial cria `Fulfillment` e quantidades atendidas por item.

### 8.4 Pré-reserva

1. Cliente escolhe data/menu e quantidade dentro do limite.
2. Sistema cria `Reservation=PENDING`, hold de estoque e `ExpiresAt`.
3. Loja recebe fila ordenada por corte/horário.
4. Confirmar valida novamente disponibilidade e política de pagamento.
5. Conversão para pedido é atômica e idempotente; `ConvertedOrderId` impede duplicação.
6. Recusa/expiração/cancelamento libera hold e gera comunicação.
7. Na abertura do caixa, reservas confirmadas aparecem por horário e status de separação.

### 8.5 Cardápio semanal

1. Criar semana em rascunho a partir de modelo opcional.
2. Informar dia/data/local/janelas.
3. Adicionar produto/tamanho/sabor, tortas, fatias por torta, total e preço.
4. Definir limite e corte da pré-reserva sem exceder produção planejada.
5. Validar sobreposição, preço, horário e estoque planejado.
6. Pré-visualizar tablet/celular e impacto no site.
7. Publicar versão; a anterior fica histórica.
8. Mudança posterior avalia reservas afetadas e exige comunicação.

### 8.6 WhatsApp obrigatório em alteração

1. API grava proposta e `CommunicationEvent=PREPARED` na mesma transação.
2. Retorna URL `https://wa.me/<numero>?text=<mensagem>` sem dados internos.
3. Frontend registra `OPEN_ATTEMPTED` antes de abrir outra janela.
4. Ao voltar, usuário confirma “Enviei” ou “Não consegui enviar”.
5. Automação futura atualiza `ACCEPTED/SENT/DELIVERED/READ` pelo webhook.
6. Alteração não automática só é aplicada após `USER_CONFIRMED_SENT` ou entrega confirmada pela API.
7. Falha deixa a proposta pendente, preserva reserva temporária e oferece copiar mensagem/ligar.

## 9. Cadastro completo de produto

### 9.1 Campos obrigatórios

Nome, categoria, tipo, unidade de venda, status, ao menos uma modalidade comercial, regra de quantidade, preço vigente ou “somente orçamento”, canal/loja, composição versionada quando o produto tiver custo calculável e responsável pela publicação.

### 9.2 Campos opcionais

Foto, descrição, observações públicas/internas, destaque, ordem, tamanhos, adicionais, entrega, embalagem específica, validade, peso e código externo.

### 9.3 Modalidades

`IMMEDIATE`, `PRE_RESERVATION`, `ORDER`, `QUOTE_ONLY`. Um produto pode ter mais de uma, mas cada modalidade possui preço, prazo, mínimo, incremento, máximo, antecipação, retirada, entrega, parcialidade e política de alteração próprias.

### 9.4 Tamanhos e rendimentos

`SLICE`, `P`, `M`, `G` são dados configuráveis, não colunas fixas. Cada tamanho guarda rendimento de encomenda, festival/venda direta, fatias por torta, unidade, peso opcional e vigência. Isso preserva os campos atuais sem impedir novos tamanhos.

### 9.5 Composição

Componente pode apontar para ingrediente, receita, preparação, embalagem, adicional ou recurso operacional. Guarda quantidade, unidade, modo `YIELD/PHYSICAL_QUANTITY/FIXED`, rendimento usado, perda, custo unitário e proporcional do snapshot. Validação impede ciclo e mistura de unidades sem conversão cadastrada.

### 9.6 Preços

Guardar separadamente custo calculado, margem desejada, preço mínimo, recomendado e final manual. O preço comercial é por canal, loja, tamanho e vigência. Sobrescrever manualmente exige motivo quando fica abaixo do mínimo. Histórico nunca é apagado.

## 10. Página pública de produtos sob orçamento

Rotas limpas e indexáveis: `/docinhos`, `/bolos`, `/tabua-de-brigadeiro` e `/orcamento/[token]`. Cada card tem foto opcional com fallback, nome, descrição curta, opções resumidas e CTA “Pedir orçamento no WhatsApp”. O telefone da responsável vem de configuração pública própria e aparece em texto/link; nunca é chave secreta.

- Docinhos: mínimo 25, incremento 25, sabores e quantidade estruturados.
- Bolos: P/M/G com rendimento, preço indicativo opcional, data, sabor, quantidade e observação.
- Tábua: opções/tamanhos, foto, descrição e confirmação manual.

O clique cria uma `QuoteRequest` somente após consentimento do cliente e envio do formulário; abrir WhatsApp sozinho registra apenas interesse anônimo/analytics minimizado. Proposta aceita converte em pedido mantendo o vínculo e a versão.

## 11. Convenções do banco SQL Server

Schemas: `core`, `auth`, `crm`, `catalog`, `cost`, `production`, `inventory`, `sales`, `cash`, `messaging`, `files` e `audit`. Nomes abaixo são canônicos; a API oferece contratos estáveis independentemente do banco.

Campos comuns em cadastros mutáveis: `Id uniqueidentifier PK default NEWSEQUENTIALID()`, `StoreId uniqueidentifier` quando a entidade pertencer à loja, `CreatedAt datetime2(3)`, `CreatedBy uniqueidentifier NULL`, `UpdatedAt datetime2(3)`, `UpdatedBy uniqueidentifier NULL`, `RowVersion rowversion`, `IsActive bit`. Valores financeiros `decimal(19,4)` e quantidades `decimal(19,6)`. JSON usa `nvarchar(max) CHECK (ISJSON(coluna)=1)` para manter compatibilidade.

Índices filtrados usam `WHERE IsActive=1` ou `WHERE ArchivedAt IS NULL`. Telefones são normalizados para E.164 e indexados por hash/dado normalizado conforme finalidade. Busca por nome usa coluna normalizada e full-text apenas quando necessário.

### 11.1 Núcleo, identidade e segurança

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `core.Stores` | Loja/local: `Code varchar(30)`, `Name nvarchar(120)`, `TimeZoneId varchar(80)`, endereço e contatos públicos | `UQ(Code)`; fuso obrigatório; uma loja inicial não impede expansão |
| `auth.Users` | Identidade: `NormalizedUserName`, `Email`, `PhoneE164`, hashes/selos do Identity, `LockoutEnd`, `AccessFailedCount`, `MustChangePassword`, `LastAccessAt`, `Status` | únicos filtrados para telefone/e-mail; senha nunca em coluna própria; `Status IN (ACTIVE,LOCKED,INACTIVE,ANONYMIZED)` |
| `auth.UserSessions` | refresh token: `UserId`, `TokenHash binary(32)`, `DeviceHash`, `IssuedAt`, `ExpiresAt`, `RevokedAt`, `RevokedBy`, `LastSeenAt` | `FK User`; `UQ(TokenHash)`; índices `(UserId,RevokedAt,ExpiresAt)`; token em claro nunca persiste |
| `auth.PasswordResetTokens` | reset/troca: `UserId`, `TokenHash`, `Purpose`, `ExpiresAt`, `UsedAt`, `IssuedBy`, `Reason`, `DeliveryEventId` | uso único; índice `(UserId,Purpose,ExpiresAt)`; expiração obrigatória |
| `auth.DirectAccessTokens` | acesso escopado: `UserId NULL`, `EntityType`, `EntityId`, `Scope`, `TokenHash`, `ExpiresAt`, `UsedAt`, `MaxUses` | `UQ(TokenHash)`; escopo e entidade obrigatórios; nunca autoriza operação interna |
| `auth.Roles` | perfis: `Code`, `Name`, `Description`, `IsSystem` | `UQ(Code)` |
| `auth.Permissions` | ações granulares: `Code`, `Module`, `Description`, `RiskLevel` | `UQ(Code)`; código como `order.cancel` |
| `auth.RolePermissions` | concessão: `RoleId`, `PermissionId`, `Effect` | PK composta; `Effect IN (ALLOW,DENY)`; deny prevalece |
| `auth.UserRoles` | papéis por usuário/loja: `UserId`, `RoleId`, `StoreId`, `ValidFrom`, `ValidUntil` | único ativo por combinação; datas coerentes |
| `auth.UserPermissionOverrides` | exceções: `UserId`, `PermissionId`, `StoreId`, `Effect`, `Reason`, `ExpiresAt` | motivo e expiração para permissões elevadas temporárias |
| `auth.Collaborators` | perfil da equipe: `UserId`, `FullName`, `JobTitle`, `MobilePhoneE164`, `Email`, `AvatarFileId`, `HireDate`, `Notes`, `Status` | `UQ(UserId)`; avatar opcional; inativar revoga sessões |
| `auth.CollaboratorStoreAssignments` | vínculo com loja: `CollaboratorId`, `StoreId`, `IsPrimary` | PK composta; somente um principal filtrado |
| `auth.AccessHistory` | acessos: `UserId`, `OccurredAt`, `Result`, `IpHash`, `DeviceHash`, `UserAgentSummary`, `CorrelationId` | `bigint identity`; índices `(UserId,OccurredAt DESC)` e `(CorrelationId)`; retenção definida |

### 11.2 Clientes, consentimentos e Clube

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `crm.Customers` | `UserId NULL`, `FullName`, `NormalizedName`, `PhoneE164`, `Email`, `BirthDate`, `Origin`, `PreferredChannel`, `InternalNotes`, `Status`, `LastOrderAt` | telefone único filtrado conforme regra de unificação; índices nome/telefone/status; nascimento opcional |
| `crm.CustomerAddresses` | `CustomerId`, rótulo, CEP, logradouro, número, complemento, bairro, cidade, UF, referência, coordenadas opcionais, `IsDefault` | índice `(CustomerId,IsActive)`; um padrão por cliente; não apagar endereço usado, apenas arquivar |
| `crm.CustomerConsents` | evento append-only: `CustomerId`, `Channel`, `Purpose`, `LegalBasis`, `Granted`, `DocumentVersion`, `Source`, `EvidenceHash`, `OccurredAt` | índice `(CustomerId,Channel,Purpose,OccurredAt DESC)`; marketing separado de serviço/segurança |
| `crm.CustomerNotes` | `CustomerId`, `Text`, `Visibility`, `Category`, `AuthorId` | HTML não permitido; acesso por permissão; histórico imutável/correção vinculada |
| `crm.CustomerAccessActions` | reset, link, bloqueio: `CustomerId`, `Action`, `ActorId`, `Reason`, `TokenId NULL`, `Result`, `OccurredAt` | índice cliente/data; não guarda segredo |
| `crm.LoyaltyAccounts` | vínculo do Clube: `CustomerId/GroupId`, progresso, prêmios disponíveis, cartões concluídos, status | restrições impedem saldo negativo; movimentos são fonte, campos são projeção conferível |
| `crm.LoyaltyLedger` | carimbo/prêmio: `AccountId`, `Type`, `Quantity`, `OrderId`, `ReversalOfId`, `Reason`, `OccurredAt` | `bigint identity`; idempotência por origem; reversão em vez de delete |

### 11.3 Motor de custos preservado

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `cost.IngredientCategories` | categorias atuais e futuras: `Name`, `SortOrder` | nome único ativo |
| `cost.Units` | unidade e dimensão: `Code`, `Name`, `Dimension` | `UQ(Code)`; dimensões `MASS,VOLUME,COUNT,TIME,ENERGY` |
| `cost.UnitConversions` | `FromUnitId`, `ToUnitId`, `Factor`, vigência | fator > 0; única por par/vigência; proibir conversão entre dimensões sem regra explícita |
| `cost.Ingredients` | campos atuais: nome, categoria, marca/fornecedor padrão, conteúdo, unidade e status | índice nome/categoria; conteúdo > 0 quando comprável |
| `cost.IngredientPrices` | `IngredientId`, `SupplierName`, `PurchaseMode`, `PackagePrice`, `ContentQuantity`, `ContentUnitId`, `UnitsPerCase`, `CasePrice`, `EffectiveFrom/To` | check valores >=0; índice ingrediente/vigência; não sobrescrever preço histórico |
| `cost.Recipes` | identidade da receita: `Name`, `Type`, `Status` | nome/tipo indexado; versão ativa separada |
| `cost.RecipeVersions` | campos atuais: rendimento, unidade, quantidade física, modo própria/derivada, origem, derivação, observação e vigência | versão única; origem não pode ser a própria; apenas uma vigente |
| `cost.RecipeItems` | `RecipeVersionId`, `IngredientId`, `Quantity`, `UnitId`, `PackageFraction` | quantidade >=0; índice versão/ordem |
| `cost.RecipeOperations` | minutos de batedeira, forno, panela, refrigeração, gás e pessoas por versão | valores >=0; recurso pode substituir colunas futuras |
| `cost.Preparations` | nome, tipo e status | índice nome/tipo |
| `cost.PreparationVersions` | rendimento/unidade, quantidade física/unidade, observação e vigência | uma versão vigente; rendimento >0 |
| `cost.PreparationItems` | base receita/preparação ou ingrediente direto, `ConsumptionMode`, quantidade, unidade e ordem | exatamente uma referência preenchida; prevenir ciclos via procedure |
| `cost.Assets` | patrimônio atual: descrição, categoria, quantidade, compra, valor, vida útil, residual, situação, em uso/reserva e observação | checks de quantidade, residual 0–100 e vida útil >0 |
| `cost.AssetMaintenances` | `AssetId`, tipo, data, valor, fornecedor, observação e comprovante | índice ativo/data; valor >=0 |
| `cost.OperationCostParameters` | parâmetros versionados de energia, gás, pessoas, produção, fixos, perdas, taxas e deslocamentos em JSON tipado/colunas essenciais | `StoreId`, vigência, versão; validação na API e hash; somente uma vigente |
| `cost.ResourceAllocations` | recurso operacional por receita/produto: energia, tempo, gás, pessoa, depreciação, embalagem e rateio | quantidade >=0; unidade compatível |
| `cost.CostSnapshots` | resultado imutável: versão de composição, preços de insumo, operação, custo total/unidade/fatia/torta/tamanho, fórmula e hash | índice entidade/data; `UQ(EntityType,EntityVersionId,CalculationHash)` |

### 11.4 Catálogo comercial

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `catalog.ProductCategories` | nome, slug, categoria pai, ordem, visibilidade e status | slug único; hierarquia sem ciclo |
| `catalog.Products` | nome, slug, descrição, tipo, categoria, destaques, observações, modalidade e status | slug único; índices categoria/status/ordem; foto não obrigatória |
| `catalog.ProductImages` | `ProductId`, `FileId`, `AltText`, `SortOrder`, `IsPrimary`, `Visibility` | uma primária ativa; arquivo aprovado |
| `catalog.ProductSizes` | tamanho configurável: código, nome, unidade, peso, rendimento encomenda/festival, fatias/torta e vigência | único por produto/código/vigência; rendimentos >0 |
| `catalog.ProductCompositions` | cabeçalho versionado: `ProductId`, `ProductSizeId NULL`, `Version`, `EffectiveFrom/To`, `Status`, `CostSnapshotId` | uma publicada vigente por produto/tamanho |
| `catalog.ProductCompositionItems` | item ingrediente/receita/preparação/embalagem/produto/recurso, quantidade, unidade, modo, rendimento, perda e ordem | exatamente uma origem; perda 0–100; ciclo proibido |
| `catalog.ProductSaleRules` | por modalidade/canal: mínimo, incremento, máximo, antecedência, antecipado, retirada, entrega, parcialidade, alteração, troca de calda e observação | `min <= max`; incremento >0; modalidade válida |
| `catalog.ProductPrices` | `ProductId`, tamanho, canal, loja, custo snapshot, mínimo, recomendado, final, moeda, taxa, vigência, motivo manual | único por combinação/vigência; preço >=0; sobreposição proibida |
| `catalog.OptionGroups` | caldas/adicionais: nome, obrigatório, mínimo/máximo, troca permitida | `min <= max`; grupo por produto/modalidade |
| `catalog.Options` | opção, produto/modificador, acréscimo, custo, disponibilidade e ordem | preço >=0; opção ativa referencia item ativo |
| `catalog.PaymentMethods` | código, nome, tipo, taxa percentual/fixa, requer comprovante, ativo e ordem | código único; taxa válida; corresponde ao cadastro solicitado de meios |

### 11.5 Cardápio, produção e estoque

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `production.WeeklyMenus` | loja, semana inicial, status, versão, publicado em/por e observação | único loja/semana/versão; status `DRAFT/PUBLISHED/ARCHIVED` |
| `production.WeeklyMenuDays` | menu, data, local, abre/fecha, disponibilidade e observação | único menu/data/local; horário coerente |
| `production.WeeklyMenuItems` | dia, produto/tamanho, sabor, tortas, fatias/torta, total, preço snapshot, aceita reserva, limite e corte | total calculável/conferível; limite <= total; índice data/produto |
| `production.ProductionBatches` | lote: loja, número, produto/tamanho, planejado/produzido/liberado, datas/horas, validade, status, custo snapshot e responsável | número único; quantidades não negativas; transições válidas |
| `production.ProductionItems` | componentes/saídas do lote, quantidade, unidade, perda de processo e observação | índice lote; rastreabilidade da composição usada |
| `inventory.InventoryLots` | projeção por lote/item: quantidade recebida, reservada, separada, vendida, saldo e `RowVersion` | único lote/item; `Free = OnHand-Reserved-Separated`; saldo não negativo |
| `inventory.StockMovements` | ledger: lote, produto, tipo, quantidade assinada, custo/preço snapshot, pedido/reserva/baixa, reversão, ator, motivo e data | `bigint identity`; índice lote/data e origem; idempotência; sem update/delete |
| `inventory.StockReservations` | hold: lote/item, pedido/reserva, quantidade, status, expiração e versão | índice expiração/status; reservado <= livre em procedure transacional |
| `inventory.Leftovers` | sobra: lote origem, data, quantidade, validade, destino/lote seguinte, custo e preço | vínculo ao movimento `LEFTOVER`; não duplicar saldo |
| `inventory.Losses` | perda: lote, quantidade, categoria, motivo, autorizado por, foto opcional | vínculo ao movimento `LOSS`; autorização por limite |
| `inventory.OperationalWriteOffs` | base de permuta, prêmio, doação e consumo: lote/item, tipo, quantidade, valor, beneficiário opcional, motivo e autorização | tipo obrigatório; vínculo ao movimento de estoque |
| `inventory.Donations` | extensão: `WriteOffId`, instituição/pessoa e finalidade | PK/FK um-para-um |
| `inventory.InternalConsumptions` | extensão: `WriteOffId`, colaborador/área | PK/FK um-para-um |
| `inventory.Rewards` | extensão: `WriteOffId`, cliente/conta/prêmio do Clube | PK/FK; idempotência com ledger do Clube |
| `inventory.Exchanges` | extensão: `WriteOffId`, contraparte, item/serviço recebido e valor estimado | PK/FK; não criar entrada de dinheiro |

### 11.6 Reservas, orçamentos, pedidos e atendimento

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `sales.Reservations` | número, cliente, menu/data/loja, status, expiração, retirada/entrega, antecipação, total e pedido convertido | número único; índice status/expiração/data; conversão única |
| `sales.ReservationItems` | reserva, menu item/produto/tamanho, quantidade, preço, estoque hold e observação | quantidade respeita mínimo/incremento; snapshot obrigatório |
| `sales.QuoteRequests` | cliente/contato, tipo, data desejada, campos estruturados, origem, status e responsável | número único; índice status/data; PII minimizada |
| `sales.QuoteProposals` | solicitação, versão, validade, subtotal/total, condições, status, aceita em e pedido convertido | versão única; aceite idempotente; proposta antiga imutável |
| `sales.Orders` | número, cliente opcional, tipo, origem, loja, lifecycle, payment, fulfillment e change status, datas, valores, notas públicas/internas e versão | número único; índices fila `(StoreId,ServiceDate,LifecycleStatus)`; checks de estados |
| `sales.OrderItems` | pedido, produto/tamanho, snapshot de nome/preço/custo, quantidade pedida/cancelada/atendida, finalidade e status | quantidades coerentes; índice pedido/ordem; item pago não é excluído |
| `sales.OrderItemModifiers` | item, grupo/opção, nome/preço/custo snapshot, quantidade | índice item; snapshot obrigatório |
| `sales.OrderChanges` | pedido, versão base, solicitante/ator, origem, tipo, motivo, antes/depois JSON, diferença, impacto, status e validade | índice pedido/status/data; versão base evita sobrescrita concorrente |
| `sales.OrderChangeItems` | mudança estruturada por item/campo, valor anterior/novo e estoque delta | auditável e comparável; sem segredo em JSON |
| `sales.OrderChangeMessages` | mudança, comunicação, template, mensagem gerada e status de confirmação | mensagem imutável; vínculo obrigatório para mudança relevante |
| `sales.OrderStatusHistory` | pedido, domínio (`LIFECYCLE/PAYMENT/FULFILLMENT/CHANGE`), anterior/novo, ator, motivo e data | append-only; transição validada na API/procedure |
| `sales.Fulfillments` | remessa/retirada: pedido, tipo, status, previsto/realizado, responsável, destinatário e prova opcional | índice pedido/status/horário; parcialidade explícita |
| `sales.FulfillmentItems` | atendimento, item, quantidade | soma atendida <= quantidade válida |
| `sales.Payments` | pedido, método, status, bruto, taxa, líquido, referência externa, pago/estornado e caixa | referência idempotente por provedor; valor >=0 |
| `sales.PaymentAllocations` | pagamento aplicado a pedido/item/parcela, valor | total alocado <= pagamento; permite pagamento parcial |
| `sales.Refunds` | pagamento, valor, motivo, status, referência e data | valor <= saldo estornável; autorização auditada |

### 11.7 Caixa e conciliação

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `cash.CashRegisters` | caixa físico: loja, código, nome e status | único loja/código |
| `cash.CashSessions` | caixa, número, responsável, status, abertura/fechamento, valores esperado/contado/diferença e versão | índice caixa/status; único `OPEN` por caixa; `rowversion` |
| `cash.CashOpenings` | sessão, fundo inicial, contagem por denominação JSON, snapshot de estoque/reservas e assinatura | `UQ(SessionId)`; snapshot imutável |
| `cash.CashMovements` | sessão, tipo, valor, método, pedido/pagamento/cliente/produto, descrição, status, ator e reversão | `bigint identity`; índice sessão/data/tipo; sem delete; valor >0 |
| `cash.CashWithdrawals` | extensão de movimento: destinatário, categoria de despesa, comprovante e autorização | PK/FK para movimento `WITHDRAWAL/EXPENSE` |
| `cash.CashClosings` | sessão, versão, totais de produção/venda/pagamento/baixa/sobra, contado, diferença, tolerância, status, observação, hash e responsável | único sessão/versão; fechamento substituído aponta para nova versão |
| `cash.CashReconciliationLines` | fechamento, domínio, código, esperado, identificado, diferença e referência | índice fechamento/domínio; explica cada soma |
| `cash.PaymentMethodClosings` | fechamento, método, bruto, taxa, líquido, recebido e diferença | único fechamento/método |
| `cash.WriteOffs` | visão financeira opcional de baixa sem caixa; referencia `OperationalWriteOffId` e valor de varejo | não duplica movimento de estoque nem cria recebimento |
| `cash.CashReopenings` | fechamento anterior, motivo, autorizado por, reaberto em e nova sessão/versão | permissão elevada; vínculo obrigatório |

### 11.8 WhatsApp, arquivos, auditoria e confiabilidade

| Tabela | Objetivo e campos específicos | Chaves, índices e integridade |
|---|---|---|
| `messaging.MessageTemplates` | código, evento, canal, versão, corpo, variáveis permitidas, ativo e vigência | único código/versão; template validado; sem segredo |
| `messaging.CommunicationEvents` | entidade, destinatário mascarado/hash, template, conteúdo gerado, status, ator, preparado/aberto/enviado/entregue/lido e provedor | índices entidade/data e status; telefone completo criptografado apenas se necessário |
| `messaging.OutboxMessages` | evento transacional, tipo, payload mínimo, tentativas, próxima tentativa, bloqueio e conclusão | índice filtrado pendentes; consumidor idempotente |
| `files.StoredFiles` | chave do objeto, finalidade, entidade, MIME detectado, tamanho, hash, visibilidade, status, variantes e uploader | `UQ(StorageKey)` e hash; arquivo só ativa após validação |
| `audit.AuditLogs` | ator/papel, tela, ação, entidade, antes/depois, motivo, correlação, IP/dispositivo hash e data | `bigint identity`; índices entidade/data, ator/data, correlação; append-only |
| `audit.SecurityEvents` | login, bloqueio, reset, elevação, exportação e risco | dados sensíveis mascarados; retenção e alerta |
| `audit.IdempotencyKeys` | escopo, chave, request hash, status, response hash/payload mínimo e expiração | PK `(Scope,Key)`; mesma chave com payload diferente falha |
| `audit.SchemaMigrations` | versão, checksum, aplicada em/por e resultado | versão e checksum únicos; ferramenta de migração controla |

## 12. Compatibilidade com o banco existente

Não criar tabelas duplicadas no Supabase atual. O mapeamento de transição é:

| Atual | Canônico SQL Server | Estratégia |
|---|---|---|
| `profiles` | `auth.Users` + `crm.Customers` | separar identidade e perfil mantendo `SourceId` |
| `staff_members`, `staff_private_profiles`, `staff_store_assignments` | `auth.Collaborators`, papéis e vínculos | preservar IDs e papéis `owner/manager/attendant/viewer` |
| `commercial_products`, opções e mídias | `catalog.Products`, preços, regras, opções e imagens | importar sem perder slug/ordem/visibilidade |
| `costing_*` e `commercial_product_costing_settings` | schemas `cost` + composição/preço | comparar com JSON e escolher versão por data, não sobrescrever |
| `flavors`, `flavor_availability`, `flavor_availability_batches` | produto/sabor + lote/inventário | manter regra de disponibilidade por horário e reserva transacional |
| `weekly_service_menu*` | `production.WeeklyMenus*` | preservar recorrência e versões publicadas |
| `instant_orders` e itens/caldas | `sales.Orders`, itens e modificadores | importar snapshots e status por domínios |
| `service_requests` | `QuoteRequests/Reservations/Orders` conforme tipo | classificar, não converter tudo automaticamente |
| `cash_registers`, `cash_sessions`, `cash_movements`, reconciliação | schema `cash` | reconciliar saldos e manter histórico original |
| `audit_events`, `consent_events` | `audit.AuditLogs`, `crm.CustomerConsents` | append-only, com `SourceId` e checksum |

Cada tabela migrada recebe `SourceSystem varchar(30)`, `SourceId nvarchar(100)` e `ImportedAt` em tabela de mapa ou staging, não necessariamente no domínio final. A migração executa: staging → validação → transformação → contagens/somas/hash → aceite → cutover por feature flag. Dual-write só é permitido temporariamente via outbox e precisa de reconciliador; não implementar dual-write direto no frontend.

## 13. Estados e máquinas de transição

### 13.1 Pedido — estados separados

| Domínio | Estados |
|---|---|
| `LifecycleStatus` | `DRAFT`, `AWAITING_CONFIRMATION`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `PARTIALLY_PAID`, `PAID`, `PAID_IN_ADVANCE`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CANCELLED` |
| `FulfillmentStatus` | `NOT_STARTED`, `PICKING`, `PICKED`, `PARTIALLY_FULFILLED`, `READY`, `FULFILLED`, `CANCELLED` |
| `ChangeStatus` | `NONE`, `CHANGED`, `AWAITING_APPROVAL`, `APPROVED`, `REFUSED`, `EXPIRED` |
| `OrderType` | `IMMEDIATE`, `PRE_RESERVATION`, `ORDER`, `QUOTE_CONVERSION`, `PEDE_JUNTO` |
| `FulfillmentType` | `PICKUP`, `DELIVERY`, `MIXED` |

Os rótulos solicitados são apresentados como combinação: “em separação” = fulfillment `PICKING`; “separado” = `PICKED/READY`; “entregue parcial” ou “retirado parcial” = `PARTIALLY_FULFILLED` + tipo; “alterado” = change `CHANGED`; “aguardando aprovação” = change `AWAITING_APPROVAL`.

Transições proibidas: cancelar item atendido sem devolução; entregar/retirar acima da quantidade válida; marcar pronto sem pagamento quando a política exigir; reduzir item pago sem gerar crédito/reembolso; reabrir concluído sem permissão e motivo.

### 13.2 Pré-reserva

`PENDING → CONFIRMED → CONVERTED`; saídas alternativas `REFUSED`, `EXPIRED`, `CANCELLED`. Só `PENDING/CONFIRMED` bloqueiam estoque conforme política. `CONVERTED` exige `ConvertedOrderId` único.

### 13.3 Caixa

`NOT_OPEN → OPEN → RECONCILING → CLOSED` ou `CLOSED_WITH_VARIANCE`. `REOPENED` é evento e cria nova versão/sessão controlada; não altera silenciosamente o fechamento anterior.

### 13.4 Produção e estoque

Lote: `PLANNED`, `IN_PRODUCTION`, `PRODUCED`, `RELEASED`, `CLOSED`, `CANCELLED`. Movimento/destino: `AVAILABLE`, `RESERVED`, `SEPARATED`, `SOLD`, `FULFILLED`, `LEFTOVER`, `LOSS`, `INTERNAL_CONSUMPTION`, `DONATION`, `EXCHANGE`, `REWARD`, `RETURNED`, `ADJUSTMENT`.

## 14. Regras de negócio críticas

1. Estoque livre = físico – reservas – separado; cálculo e validação ocorrem no banco na mesma transação.
2. Pedido público usa número e token opaco; nunca busca por telefone sem autenticação.
3. Alteração usa versão base e falha com `409 CONFLICT` se o pedido mudou desde a abertura da tela.
4. Valores do pedido são recalculados no servidor a partir de snapshots vigentes; total enviado pelo cliente não é confiável.
5. Preço abaixo do mínimo exige permissão `product.override_min_price` e motivo.
6. Item premiado referencia prêmio válido e não pontua novamente.
7. Permuta, prêmio, consumo e doação baixam estoque, mas não criam recebimento.
8. Sobra mantém lote/validade; item vencido não volta a disponível.
9. Pagamento antecipado não confirma automaticamente reserva que dependa de aprovação manual; cria prioridade/alerta.
10. Cancelamento após pagamento abre fluxo de reembolso/crédito e mantém histórico.
11. Parcialidade só existe com `Fulfillment` e quantidades por item.
12. Orçamento expirado não converte sem nova versão/aceite.
13. Cliente pode alterar somente dentro da janela, campos e limites configurados; aumento de valor/prazo ou falta de estoque exige aprovação.
14. Abrir WhatsApp não equivale a mensagem entregue; interface usa linguagem “WhatsApp aberto” até confirmação/webhook.
15. Caixa fechado é imutável; reabertura exige administrador, motivo, reautenticação e versão.
16. Baixa com valor/quantidade acima do limite do papel solicita segunda aprovação.
17. Cada venda, reserva, alteração e webhook é idempotente.
18. Exclusão de cliente é bloqueio/anonimização conforme retenção; histórico fiscal e auditoria permanecem minimizados.

## 15. Permissões por perfil

Legenda: **S** permitido; **L** permitido com limite/regra; **A** exige aprovação superior; **N** negado.

| Ação | Administrador | Operação | Caixa | Produção | Atendimento | Restrito |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver dashboard operacional | S | S | S | L | L | L |
| Abrir caixa | S | S | S | N | N | N |
| Fechar caixa | S | S | S | N | N | N |
| Reabrir caixa | S | A | N | N | N | N |
| Lançar venda/pagamento | S | S | S | N | L | N |
| Alterar pedido não pago | S | S | L | N | L | N |
| Alterar item pago | S | A | A | N | N | N |
| Cancelar pedido | S | S | A | N | A | N |
| Confirmar pré-reserva | S | S | L | N | L | N |
| Produzir/liberar lote | S | S | N | S | N | N |
| Ajustar estoque | S | S | A | L | N | N |
| Registrar perda/permuta/prêmio | S | S | A | L | N | N |
| Editar produto/composição | S | L | N | L | N | N |
| Publicar preço/cardápio | S | S | N | L | N | N |
| Ver custo/margem | S | S | N | L | N | N |
| Editar cliente | S | S | L | N | S | N |
| Resetar cliente | S | L | N | N | A | N |
| Gerir colaborador/papel | S | N | N | N | N | N |
| Ver/exportar auditoria | S | L | N | N | N | N |

Permissão é aplicada na API e, quando útil, em procedure/política do banco. Esconder botão não autoriza nem protege ação. Papéis atuais são mapeados: `owner → Administrador`, `manager → Operação`, `attendant → Atendimento` e `viewer → Restrito`; novos papéis Caixa e Produção são adicionados sem mudar os existentes.

## 16. Validações e mensagens

### 16.1 Produto/custo

- Nome obrigatório, 2–120 caracteres; slug único.
- Ingrediente comprável exige conteúdo/unidade e ao menos um preço válido para cálculo.
- Rendimento e divisor maiores que zero.
- Receita/preparação derivada não pode formar ciclo.
- Unidade incompatível: “Cadastre uma conversão entre g e kg antes de usar este item.”
- Sem preço: cálculo fica `INCOMPLETE`, não zero silencioso.
- Margem real negativa/abaixo do piso mostra alerta e exige justificativa ao publicar.
- Foto vazia é válida; arquivo inválido não impede salvar os demais dados como rascunho.

### 16.2 Pedido/reserva

- Telefone normalizado; nome obrigatório para pedido remoto e opcional para balcão anônimo.
- Quantidade respeita mínimo, incremento, máximo e estoque.
- Data/horário dentro do cardápio e corte.
- Calda obrigatória quando grupo exige escolha.
- Conflito: “Este pedido mudou em outro aparelho. Atualizamos os dados; revise antes de tentar novamente.”
- Estoque: “Restam 3 fatias livres; 2 estão reservadas para outros pedidos.”
- Reserva expirada: preservar formulário e oferecer recalcular disponibilidade.

### 16.3 Caixa

- Uma sessão aberta por caixa; abertura >=0.
- Movimento >0; tipo, descrição e responsável obrigatórios.
- Sangria/retirada não pode exceder gaveta estimada sem aprovação/motivo.
- Fechamento exige contagem, revisão de pendências e tratamento das divergências.
- Mensagem: “A diferença de R$ 12,00 ficará registrada. Informe o motivo ou volte para conferir.”

### 16.4 Acesso

- Resposta genérica para credencial/reset.
- Token expirado/consumido não é reutilizado.
- Administrador não pode remover seu próprio último papel administrativo.
- Desativar colaborador revoga sessões e bloqueia caixas/ações em andamento com handoff explícito.

## 17. Contratos mínimos da API

Base `/api/v2`; HTTPS, JSON, `Correlation-Id`, `Idempotency-Key` em comandos e ETag/`rowVersion` em alterações concorrentes. Erro padrão:

```json
{
  "error": {
    "code": "INVENTORY_CONFLICT",
    "message": "A quantidade disponível mudou. Revise o pedido.",
    "fieldErrors": [{ "field": "items[0].quantity", "message": "Máximo atual: 3" }],
    "correlationId": "opaque"
  }
}
```

### 17.1 Endpoints

| Método/rota | Função e permissão |
|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | sessão segura |
| `POST /auth/password/forgot`, `/reset`, `/temporary` | reset e senha temporária auditados |
| `POST /auth/direct-access` | link escopado; equipe autorizada |
| `GET/POST/PATCH /products` | catálogo; escrita `product.edit` |
| `POST /products/{id}/versions/{version}/publish` | composição/preço versionado |
| `POST /cost/import/preview` e `/commit` | importar JSON idempotente |
| `GET/POST /weekly-menus`, `POST /{id}/publish` | cardápio e versão |
| `POST /production/batches`, `/release`, `/close` | produção por lote |
| `GET /inventory/availability` | agora/hoje/futuro |
| `POST /inventory/movements` | ajustes/baixas com permissão |
| `POST /reservations`, `/{id}/confirm|refuse|cancel|convert` | máquina de pré-reserva |
| `POST /quotes`, `/{id}/proposals`, `/proposals/{id}/accept` | orçamento versionado |
| `GET/POST /orders`, `GET /orders/{number}` | pedido e detalhe |
| `POST /orders/{id}/changes` | proposta de alteração |
| `POST /order-changes/{id}/approve|refuse|confirm-communication` | aprovação e WhatsApp |
| `POST /orders/{id}/payments` e `/refunds` | pagamento/reembolso |
| `POST /orders/{id}/fulfillments` | retirada/entrega total ou parcial |
| `POST /cash-sessions/open`, `/{id}/movements`, `/{id}/reconcile`, `/{id}/close`, `/{id}/reopen` | caixa |
| `GET/POST/PATCH /customers`, `/collaborators` | cadastros e segurança |
| `POST /files/upload-authorizations`, `/files/{id}/complete` | upload validado |
| `GET/PATCH /message-templates`, `POST /communications/{id}/open-attempt` | templates/comunicação |
| `GET /audit` | auditoria por permissão |

### 17.2 Exemplo — alteração de pedido

```json
POST /api/v2/orders/{orderId}/changes
Idempotency-Key: uuid
If-Match: "rowVersionBase64"

{
  "reason": "Cliente pediu troca de calda",
  "items": [
    { "orderItemId": "uuid", "quantity": 2, "modifiers": [{ "optionId": "uuid" }] }
  ],
  "requestedBy": "STORE",
  "communicationChannel": "WHATSAPP"
}
```

Resposta `202`: comparação antes/depois, diferença, estoque provisório, `changeId`, mensagem e `whatsappUrl`. Nenhum dado administrativo entra na URL pública.

### 17.3 Exemplo — abertura

```json
POST /api/v2/cash-sessions/open
{
  "registerId": "uuid",
  "openingAmount": 500.00,
  "denominations": [{ "value": 50, "quantity": 10 }],
  "inventoryChecks": [{ "lotId": "uuid", "counted": 12 }],
  "reservationChecks": [{ "reservationId": "uuid", "separated": true }]
}
```

### 17.4 Exemplo — fechamento

```json
POST /api/v2/cash-sessions/{id}/close
{
  "rowVersion": "base64",
  "cashCounted": 573.00,
  "paymentMethodTotals": [
    { "method": "CASH", "gross": 175.00, "fee": 0, "net": 175.00 },
    { "method": "MERCADO_PAGO", "gross": 1200.00, "fee": 33.11, "net": 1166.89 }
  ],
  "leftovers": [{ "inventoryLotId": "uuid", "quantity": 6 }],
  "varianceReason": null
}
```

Servidor recalcula todos os totais; não confia nas somas enviadas.

## 18. Templates editáveis de WhatsApp

Variáveis são allowlist e escapadas. Links públicos têm token opaco e expiração.

### Confirmação de pedido

```text
Olá, {{primeiro_nome}}! O pedido {{numero}} foi confirmado.
Retirada/entrega: {{data_hora}}
Itens: {{resumo_itens}}
Total: {{total}}
Acompanhe: {{link_publico}}
```

### Loja alterou pedido

```text
Olá, {{primeiro_nome}}. Atualizamos o pedido {{numero}}.
Antes: {{resumo_antes}}
Depois: {{resumo_depois}}
Diferença: {{diferenca}}
Status: {{status}}
{{texto_confirmacao}}
Pedido atualizado: {{link_publico}}
```

### Cliente solicitou alteração

```text
Solicitação de alteração — pedido {{numero}}
Cliente: {{cliente}}
Antes: {{resumo_antes}}
Solicitado: {{resumo_depois}}
Diferença prevista: {{diferenca}}
Analisar na operação: {{link_administrativo}}
```

### Pré-reserva confirmada/recusada

```text
Olá, {{primeiro_nome}}! Sua pré-reserva {{numero}} foi {{resultado}}.
Data/horário: {{data_hora}}
Itens: {{resumo_itens}}
{{orientacao_pagamento}}
Detalhes: {{link_publico}}
```

### Pedido separado/pronto/parcial

```text
Olá, {{primeiro_nome}}! O pedido {{numero}} está {{situacao}}.
Separado agora: {{resumo_atendido}}
Pendente: {{resumo_pendente}}
Retirada/entrega: {{data_hora}}
```

### Reset ou acesso direto

```text
Olá, {{primeiro_nome}}. A Adoce gerou um acesso seguro solicitado por você/equipe.
Use até {{expira_em}}: {{link}}
Se você não pediu, ignore e fale conosco pelo número oficial.
```

### Orçamento

```text
Olá! Gostaria de solicitar orçamento para {{tipo_produto}}.
Data: {{data}}
Quantidade/tamanho: {{quantidade_tamanho}}
Sabores: {{sabores}}
Observações: {{observacoes}}
Solicitação: {{numero}}
```

### Fechamento

```text
FECHAMENTO DE CAIXA — {{data}}

1. Produção disponível
{{producao}}
Sobras anteriores: {{sobras_anteriores}}
Valor potencial: {{valor_potencial}}

2. Caixa físico
Abertura: {{caixa_inicial}}
Retiradas: {{retiradas}}
Reforços: {{reforcos}}
Contado: {{caixa_final}}
Entrada em dinheiro: {{entrada_dinheiro}}

3. Recebimentos
Dinheiro: {{dinheiro}}
Mercado Pago: bruto {{mp_bruto}} | taxa {{mp_taxa}} | líquido {{mp_liquido}}
Pix: {{pix}}
Cartão: {{cartao}}
Outros: {{outros}}
Total bruto recebido: {{total_bruto}}

4. Baixas sem dinheiro
Permutas: {{permutas}}
Premiações: {{premiacoes}}
Doações: {{doacoes}}
Consumo interno: {{consumo}}
Perdas/cancelamentos: {{perdas_cancelamentos}}

5. Sobras para o próximo dia
{{sobras_finais}}

6. Conferência
Diferença de estoque: {{diferenca_estoque}}
Diferença de vendas/pagamentos: {{diferenca_vendas}}
Diferença da gaveta: {{diferenca_gaveta}}
Observações: {{observacoes}}
Responsável: {{responsavel}}
```

## 19. UX responsiva e acessibilidade

### Tablet 10,4 horizontal

- densidade de operação, não de planilha: lista 38%, detalhe 62%; painel crítico fixo sem esconder conteúdo;
- atalhos de teclado opcionais, mas tudo operável por toque;
- modais destrutivos no máximo 640 px e foco preso corretamente;
- tabelas só quando comparação exige colunas; caso contrário, lista com rótulos;
- contador/CTA principal permanece visível sem cobrir a última linha.

### iPhone

- uma tarefa principal por tela; sem reduzir tabela de desktop;
- barra inferior respeita safe area; teclado não cobre total/confirmar;
- ações destrutivas fora do alcance de toque acidental e com segundo passo;
- filtros em sheet, resumo em accordion e histórico paginado;
- telefonar/WhatsApp usa número mascarado e confirmação de destinatário.

### Acessibilidade

- contraste WCAG AA como alvo; foco visível; ordem semântica e labels reais;
- estados comunicados por texto/ícone e `aria-live`, não só cor;
- alvos mínimos 44 px; zoom 200% e reflow sem perda;
- erros associados ao campo e resumo no topo;
- leitores de tela anunciam mudança de estoque, total, status e confirmação;
- motion reduzido e nenhuma contagem regressiva sem alternativa.

## 20. Testes obrigatórios

### Banco/backend

- custo avulso/caixa, derivação, rendimento, unidades, perdas, taxas e snapshots;
- concorrência na última fatia; deadlock/retry; idempotência e `rowversion`;
- reserva confirmar/expirar/recusar/converter sem duplicar ou vazar saldo;
- todos os status e transições proibidas;
- pagamento parcial, múltiplos meios, estorno e arredondamento;
- parcialidade por item; cancelamento/reversão;
- abertura/fechamento, tolerância, reabertura e três reconciliações;
- permissões por papel/loja e elevação horizontal;
- reset/link expirado, usado, revogado e replay;
- upload MIME falso, arquivo grande, malware e URL privada;
- backup restaurado e integridade (`DBCC CHECKDB`) no destino isolado.

### Frontend/E2E

- jornadas em 320, 360, 375, 390, 402, 412, 430, 768, 1024 e 1280 px;
- tablet 10,4 horizontal e iPhone/Safari real nas jornadas críticas;
- loading, vazio, lento, offline, 401, 403, 404, 409, 422, 429 e 500;
- teclado, leitor de tela, foco, modais, sheets, rolagem e conteúdo longo;
- pedido antes/depois, WhatsApp bloqueado, popup bloqueado e retorno à tela;
- persistência após reload e ausência de duplicidade por duplo toque;
- perfil sem permissão não vê nem executa ação por chamada direta.

### Segurança

- SQL injection, XSS em nomes/observações, CSRF, CORS, SSRF em arquivos e path traversal;
- enumeração de conta, brute force, fixation/replay de sessão e token roubado;
- IDOR em cliente/pedido/arquivo/loja;
- segredo/source map/env no bundle e log com PII;
- banco inacessível externamente; usuário da API sem privilégio elevado;
- restore do backup, rotação de segredo e revogação de colaborador.

## 21. Plano de implementação sem quebra

### Fase 0 — Caracterização

- congelar contratos atuais com testes;
- inventariar schema/migrações/ambientes;
- validar calculadora com casos dourados e exportar hash do JSON;
- definir RPO/RTO, VM, edição/licença e storage.

### Fase 1 — Fundação SQL Server/API

- infraestrutura privada, migrations, Identity, papéis, auditoria, outbox, arquivos e observabilidade;
- sem tráfego de cliente; restore testado.

### Fase 2 — Motor de custos e catálogo

- importar ingredientes/receitas/preparações/tortas/patrimônio;
- reproduzir fórmulas com testes de paridade centavo a centavo;
- produtos, tamanhos, composição e preços versionados.

### Fase 3 — Cardápio, produção e estoque

- cardápio versionado, lotes, ledger, disponibilidade e reservas concorrentes;
- shadow read comparando resultados com fonte atual.

### Fase 4 — Clientes, colaboradores e acesso

- migração controlada, Identity, reset/link, papéis, consentimentos e auditoria;
- nenhum dado real em homologação.

### Fase 5 — Pedidos e pré-reservas

- pedidos, alterações, pagamentos, fulfillment parcial e WhatsApp manual rastreável;
- cutover por feature flag e rollback por módulo.

### Fase 6 — Caixa real

- abertura, movimentos, baixas, sobras, fechamento, relatório e reabertura;
- validar com três fechamentos reais reproduzidos em dados fake, incluindo 21/08/2026.

### Fase 7 — Orçamento público

- docinhos, bolos e tábua; proposta versionada e WhatsApp da responsável.

### Fase 8 — Piloto fechado

- um turno completo em homologação com usuários fake; tablet e iPhone reais;
- simular internet lenta, popup bloqueado, falha do WhatsApp e divergência.

### Fase 9 — Migração/cutover

- backup, staging, reconciliação por contagem/soma/hash, janela, rollback ensaiado;
- explicar risco e obter autorização explícita antes de produção.

## 22. Checklist executável

### Produto e custos

- [ ] Importação preserva todos os campos do HTML/JSON.
- [ ] Casos dourados comprovam paridade das fórmulas.
- [ ] Ingrediente sem preço não vira custo zero.
- [ ] Versões e snapshots preservam histórico.
- [ ] Foto de produto permanece opcional.
- [ ] Preço por canal/tamanho/vigência e margem real funcionam.

### Estoque e produção

- [ ] Todo saldo é explicável pelo ledger.
- [ ] Lote, liberação, validade e sobra são rastreáveis.
- [ ] Última unidade não pode ser vendida duas vezes.
- [ ] Reserva expira/libera corretamente.
- [ ] Baixas não geram dinheiro indevido.

### Pedido e reserva

- [ ] Estados de pedido/pagamento/atendimento/alteração são separados.
- [ ] Antes/depois, ator, motivo e diferença ficam imutáveis.
- [ ] WhatsApp gera evento obrigatório e fallback.
- [ ] Parcialidade funciona por item.
- [ ] Cancelamento pago gera reembolso/crédito auditado.
- [ ] Pré-reserva tem vida própria e conversão idempotente.

### Caixa

- [ ] Abertura confere sessão anterior, fundo, produção e reservas.
- [ ] Dinheiro físico não se mistura com pagamentos digitais.
- [ ] Bruto, taxa e líquido são separados.
- [ ] Estoque, vendas e gaveta conciliam independentemente.
- [ ] Fechamento divergente não é mascarado.
- [ ] Reabertura cria versão e aprovação.
- [ ] Relatório WhatsApp reproduz os cálculos reais.

### Pessoas, segurança e LGPD

- [ ] Cada colaborador possui conta individual e menor privilégio.
- [ ] Reset temporário expira e obriga troca.
- [ ] Tokens são hash, uso único e escopados.
- [ ] Banco não está exposto na internet.
- [ ] Backups criptografados foram restaurados.
- [ ] Uploads foram inspecionados e privados quando necessário.
- [ ] Consentimentos e retenção estão documentados.
- [ ] Auditoria não contém senha, token, OTP ou chave.

### UX e aceite

- [ ] Ações comuns exigem no máximo poucos toques e não dependem de hover.
- [ ] Todos os estados globais foram implementados.
- [ ] Operação passou no tablet 10,4 horizontal.
- [ ] Cliente/operação passaram no iPhone/Safari real.
- [ ] Console/rede sem erros relevantes.
- [ ] `npm run release:check` passou.
- [ ] Migração e rollback foram ensaiados.
- [ ] Produção só será alterada com autorização explícita.

## 23. Fontes técnicas atuais

- Microsoft Learn — SQL Server 2025 elevou o limite do Express para 50 GB: <https://learn.microsoft.com/en-us/sql/sql-server/what-s-new-in-sql-server-2025?view=sql-server-ver17>.
- Microsoft Learn — edições e limites de CPU/memória/armazenamento: <https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2025?view=sql-server-ver17>.
- Microsoft Learn — proteção do SQL Server, firewall, TLS, criptografia, papéis e auditoria: <https://learn.microsoft.com/en-us/sql/relational-databases/security/secure-sql-server?view=sql-server-ver17>.
- Microsoft Learn — recuperação point-in-time e sequência de backups: <https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/restore-a-sql-server-database-to-a-point-in-time-full-recovery-model?view=sql-server-ver17>.
- Microsoft Learn — ASP.NET Core Identity, confirmação e recuperação: <https://learn.microsoft.com/en-us/aspnet/core/security/authentication/accconfirm?view=aspnetcore-10.0>.
- Supabase — comparação de planos e quotas atuais: <https://supabase.com/pricing>.

## 24. Classificação desta entrega

- Arquivos de custo e backup: **inspecionados e incorporados ao contrato**.
- Documentação, migrações e superfícies de código atuais: **inventariadas neste escopo**.
- Arquitetura SQL Server e especificação: **documentadas, ainda não implementadas**.
- Banco SQL Server/VM/API: **dependentes da escolha e provisionamento da infraestrutura**.
- Auditoria visual da tela atual: **bloqueada nesta sessão pela indisponibilidade do navegador integrado**; não foi substituída por afirmação sem evidência.
- Produção e homologação: **não alteradas por este capítulo**.
