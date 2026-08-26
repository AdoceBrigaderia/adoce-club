---
title: Especificação executável da operação e autenticação por WhatsApp
description: Telas, permissões, estados, regras, arquitetura, contratos de API, dados, segurança e aceite para tablet e iPhone.
status: Fundação local implementada e desativada; homologação externa e publicação pendentes
---

# Especificação executável da operação e autenticação por WhatsApp

## 1. Objetivo, escopo e leitura obrigatória

Este capítulo é o contrato de implementação da **Adoce Operação** e do cadastro/login de clientes pelo WhatsApp. Ele deve ser usado junto dos capítulos oficiais sobre regras de negócio, operação, dados, segurança, catálogo, arquitetura de informação, marca, auditoria e estado real.

O objetivo não é redesenhar o produto do zero. A implementação deve preservar os componentes, cores, tipografia, linguagem e padrões já existentes, corrigindo hierarquia, descoberta e comportamento responsivo.

Legenda de execução:

- **ATUAL**: existe no repositório; ainda precisa ser confrontado com o ambiente de destino.
- **AJUSTAR**: existe parcialmente, mas não satisfaz este contrato.
- **NOVO**: precisa ser implementado.
- **EXTERNO**: depende de Meta, Supabase, Netlify, DNS, aparelho ou conta configurada.

Esta especificação não autoriza deploy, migração remota, envio real, alteração de credenciais nem mudança de dados de clientes.

## 2. Limites invioláveis

1. Site público, Clube Adoce, Adoce Hoje e Adoce Operação são superfícies distintas.
2. Cliente não recebe métricas, rotinas, termos operacionais, cadastros de equipe, auditoria ou dados de terceiros.
3. Chaves `service_role`, Secret Key, App Secret, access token permanente da Meta e verify token existem somente no servidor.
4. Toda mutação sensível é autorizada no servidor; esconder botão não é autorização.
5. Tabelas expostas pela Data API usam RLS, privilégios mínimos e políticas testadas.
6. Exclusões preservam histórico obrigatório de forma anonimizada e auditável.
7. Consentimento legal e consentimento promocional são eventos separados. Receber um OTP transacional não concede marketing.
8. O número de telefone é normalizado em E.164, mas só é considerado controlado pelo cliente depois da verificação do OTP.
9. A equipe nunca vê senha definitiva. Senha provisória é apenas fallback de contingência e deve expirar.
10. Nenhuma resposta de API revela se um telefone pertence ou não a uma conta, salvo dentro de sessão administrativa autorizada.

## 3. Base de dispositivos e comportamento responsivo

### 3.1 Matriz obrigatória

| Classe | Viewport de automação | Uso | Navegação |
|---|---:|---|---|
| Tablet 10,4 polegadas horizontal | 1280 × 800 CSS px | principal da operação | menu lateral persistente e área de trabalho |
| Tablet mínimo horizontal | 1024 × 600 CSS px | tolerância operacional | menu lateral compacto; sem corte horizontal |
| iPhone 17 vertical | 402 × 874 CSS px como viewport de referência; validar também no aparelho real | operação rápida e cliente | barra inferior e uma coluna |
| iPhone compacto de regressão | 390 × 844 CSS px | menor largura suportada | barra inferior e folhas de ação |
| Computador | 1440 × 900 CSS px | administração extensa | menu lateral e painéis amplos |

A especificação física oficial do iPhone 17 informa tela de 6,3 polegadas e 2622 × 1206 pixels. Automação web usa pixels CSS; o aparelho real e uma captura no Safari são a autoridade para safe areas, teclado, zoom e barras do navegador.

### 3.2 Regras globais

- Alvo de toque mínimo: 44 × 44 px no iPhone e 48 × 48 px no tablet operacional.
- Respeitar `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`.
- Nunca depender apenas de `hover`, cor ou gesto oculto.
- Formulários no iPhone usam uma coluna, rótulo persistente e botão principal fixo apenas quando não cobrir conteúdo ou teclado.
- Modais críticos no tablet têm largura entre 560 e 720 px; no iPhone viram tela cheia ou bottom sheet com título, fechar e ação sempre visíveis.
- Tabelas viram cartões sem perder rótulos; dados essenciais não dependem de rolagem horizontal.
- Em tablet acima de 1180 px, lista e detalhe podem coexistir. Abaixo disso, o detalhe abre em rota/painel próprio.
- A barra inferior do iPhone contém **Início, Vendas, Agenda, Clientes e Mais**. O item ativo usa `aria-current="page"`.
- O foco volta ao elemento disparador ao fechar modal. Escape fecha apenas ações reversíveis.
- Status de carregamento usa skeleton quando preserva geometria e texto curto quando a ação bloqueia.
- Toda ação assíncrona é idempotente ou desabilita repetição enquanto está em andamento.

## 4. Papéis e autorização

| Capacidade | owner | manager | attendant | viewer | cliente |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver painel e alertas da operação | ✓ | ✓ | ✓ | ✓ | — |
| Buscar/abrir cliente | ✓ | ✓ | ✓ | ✓ leitura | próprio cadastro |
| Cadastrar cliente no balcão | ✓ | ✓ | ✓ | — | autoatendimento |
| Registrar compra/carimbo | ✓ | ✓ | ✓ | — | — |
| Entregar recompensa | ✓ | ✓ | ✓ | — | — |
| Editar nome/telefone do cliente | ✓ | ✓ | limitado por fluxo verificado | — | próprio cadastro verificado |
| Redefinir acesso de cliente | ✓ | ✓ | — | — | recuperação própria |
| Excluir/anomizar cliente | ✓ | ✓ com motivo | — | — | solicitar conta própria |
| Corrigir carimbos | ✓ | — | — | — | — |
| Vendas, agenda, pedidos e CRM | ✓ | ✓ | execução atribuída | leitura permitida | pedido próprio |
| Catálogo, disponibilidade e comunicação | ✓ | ✓ | — | leitura | — |
| Financeiro e caixa | ✓ | ✓ conforme loja | caixa atribuído | — | — |
| Equipe e permissões | ✓ | leitura limitada | — | — | — |
| Restauração de produção | ✓ | — | — | — | — |

Regras:

- O JWT identifica a sessão; papel e escopo de loja vêm de `staff_members` e `staff_store_assignments`, nunca de `user_metadata`.
- Toda função sensível revalida usuário, papel, `active`, loja e estado do recurso.
- `owner` não pode ser removido ou rebaixado se for o último proprietário ativo.
- `viewer` nunca chama RPC de mutação.
- Operações destrutivas exigem confirmação explícita, motivo quando aplicável e evento de auditoria.

## 5. Arquitetura de informação da operação

### 5.1 Navegação principal

1. **Início**: resumo do turno, pendências e atalhos.
2. **Clientes & Clube**: busca, cadastro, ficha, carimbos, recompensas e acesso.
3. **Histórico do Clube**: lançamentos e correções.
4. **Vendas e pedidos**: balcão e pedidos digitais.
5. **Agenda e encomendas**: calendário, solicitações e produção comprometida.
6. **Pede Junto**: grupos, participantes, pagamentos e fechamento.
7. **Financeiro**: caixa, movimentos e conciliação.
8. **Produtos e serviços**: catálogo, preço, opções e mídia.
9. **Disponibilidade, horários e site**: estoque publicado, agenda e conteúdo operacional.
10. **Configurações globais**: canais, pagamentos e regras comerciais.
11. **Histórico e arquivados**.
12. **Equipe**.
13. **Restaurar produção**, somente owner.

### 5.2 Estados globais obrigatórios

| Estado | Comportamento e texto-base |
|---|---|
| carregando inicial | skeleton da estrutura; `aria-busy=true`; sem falso estado vazio |
| salvando | botão mostra “Salvando…” e mantém valores; impedir duplo envio |
| sucesso | confirmação contextual, por exemplo “Cadastro atualizado.”; foco permanece útil |
| validação | erro abaixo do campo e resumo no início para formulário longo |
| não autorizado | “Seu perfil não pode realizar esta ação.” sem ocultar causa técnica em log |
| sessão expirada | “Sua sessão expirou. Entre novamente para continuar.” e retorno seguro ao destino |
| rede indisponível | “Sem conexão. Nada foi perdido.”; oferecer tentar novamente |
| conflito | explicar o registro existente e oferecer abri-lo quando autorizado |
| vazio | explicar o que aparecerá e exibir ação adequada ao papel |
| falha inesperada | código de correlação copiável; nenhum stack trace ou dado pessoal |

## 6. Catálogo executável de telas da operação

Cada tela abaixo é critério de implementação e aceite. “Campos” inclui controles equivalentes como seleção, busca e alternância.

### OP-00 — Inicialização e restauração de sessão — AJUSTAR

- **Acesso:** todos.
- **Função:** carregar configuração pública, restaurar sessão e determinar superfície/papel.
- **Estados:** marca + “Preparando a Adoce Operação…”, indisponibilidade configuracional e sessão expirada.
- **Regra:** nunca renderizar operação antes de confirmar `staff_members.active`.
- **Tablet/iPhone:** tela central; sem salto para conteúdo protegido.

### OP-01 — Login da equipe — ATUAL/AJUSTAR

- **Campos:** celular com DDD; senha; mostrar/ocultar senha; manter conectado somente em aparelho privado.
- **Botões:** Entrar; Esqueci minha senha; voltar ao site.
- **Validações:** celular brasileiro válido; senha obrigatória; Enter envia uma vez.
- **Mensagens:** credenciais inválidas sempre genéricas; 429 informa tempo de espera; 503 informa indisponibilidade.
- **Sucesso:** cria sessão Supabase, consulta perfil operacional e abre destino original.
- **Segurança:** rate limit por IP/conta/dispositivo; não revelar existência do usuário.

### OP-02 — Recuperação e troca obrigatória de senha — ATUAL/AJUSTAR

- **Fluxos:** recuperação própria por canal validado; troca após senha temporária; redefinição administrativa separada.
- **Campos:** nova senha; confirmação; mostrar/ocultar.
- **Validação alvo:** mínimo 10 caracteres, bloquear senha conhecida/comprometida, nome, telefone e sequências óbvias; durante transição, não reduzir a regra existente sem migração comunicada.
- **Sucesso:** revogar senha temporária e sessões anteriores; registrar auditoria sem a senha.
- **Erro:** token expirado oferece novo envio; divergência entre senhas é mostrada antes da rede.

### OP-03 — Sem permissão, sessão expirada e conta inativa — AJUSTAR

- **Ações:** Entrar novamente; Voltar ao Início; Contatar responsável.
- **Regra:** conta inativa encerra sessão. Não mostrar qual papel seria necessário a usuários externos.

### OP-10 — Início da operação — ATUAL/AJUSTAR

- **Conteúdo:** saudação, loja/caixa/turno, pedidos novos, retiradas próximas, cadastros em análise, alertas, disponibilidade crítica e atalhos.
- **Ações:** Nova venda; Ler QR; Buscar cliente; Nova encomenda; Abrir caixa quando aplicável.
- **Vazio:** “Nenhuma pendência para este turno.”
- **Tablet:** grade de 2–4 colunas; alertas prioritários no topo.
- **iPhone:** lista vertical; no máximo quatro atalhos antes da dobra.

### OP-11 — Central de alertas — ATUAL/AJUSTAR

- **Filtros:** novos, lidos, tipo, loja e período.
- **Ações:** abrir origem; marcar lido; marcar todos lidos.
- **Regra:** alertas são derivados de eventos; não duplicar a cada recarga.

### OP-20 — Clientes & Clube: balcão e busca — ATUAL/AJUSTAR PRIORITÁRIO

- **Campos:** busca única por nome, telefone, código do membro ou QR; nome e sobrenome; WhatsApp com DDD para cadastro rápido.
- **Botões:** Ler QR; Cadastrar cliente; Buscar; **Abrir cadastro**; Registrar compra; Entregar recompensa.
- **Validações:** nome real com ao menos duas partes; telefone E.164 único; duplicidade abre o cadastro existente sem criar outro.
- **Estados:** resultados recentes; nenhum resultado; mais de um resultado; cadastro já existente; carregando; erro de busca.
- **Regra de descoberta:** a ação “Abrir cadastro” permanece visível em cada resultado; a ficha não pode depender de seção recolhida.
- **Tablet:** busca/lista à esquerda e ficha à direita quando houver largura.
- **iPhone:** resultados em cartões; ficha abre como tela; ação primária permanece alcançável com uma mão.

### OP-21 — Cadastro assistido no balcão — AJUSTAR

- **Campos:** nome e sobrenome; WhatsApp; confirmação verbal/visual dos Termos e Privacidade; marketing separado e desmarcado; origem.
- **Botões:** Enviar código pelo WhatsApp; Salvar para concluir depois; Cancelar.
- **Regra alvo:** preferir OTP do próprio cliente. Senha temporária só aparece quando fallback foi explicitamente escolhido e autorizado.
- **Sucesso:** “Código enviado para •••• 1234.” ou “Cadastro criado; falta confirmar o WhatsApp.”
- **Falha:** preservar rascunho local sem marcar número verificado.

### OP-22 — Leitor de QR — ATUAL/AJUSTAR

- **Controles:** permissão da câmera; vídeo; alternar câmera; lanterna quando suportada; campo para colar código; fechar.
- **Erros:** permissão negada, câmera indisponível, QR inválido, membro inativo ou QR expirado.
- **Regra:** QR opaco e assinado; nunca conter telefone, e-mail ou ID administrativo em claro.

### OP-23 — Ficha 360 do cliente — ATUAL/AJUSTAR PRIORITÁRIO

- **Resumo:** nome, telefone mascarado, status, código do membro, última visita, conta/cartão e alertas de cadastro.
- **Seções:** identidade; Clube e carimbos; recompensas; compras/pedidos; preferências/consentimentos; acesso e segurança; histórico.
- **Ações:** editar nome; iniciar troca verificada de telefone; registrar compra; entregar prêmio; gerar acesso de contingência; redefinir senha; desativar/excluir; corrigir carimbos (owner).
- **Regra:** alterações de nome/telefone não reescrevem registros históricos; telefone novo só substitui o anterior após OTP.
- **Vazio:** cada seção explica por que ainda não tem dados.

### OP-24 — Acesso e segurança do cliente — ATUAL/AJUSTAR

- **Mostra:** WhatsApp verificado/não verificado, último acesso, troca obrigatória, expiração do acesso temporário e sessões suspeitas resumidas.
- **Ações:** Enviar OTP; Redefinir acesso; Revogar sessões; Copiar instruções; Enviar no WhatsApp.
- **Confirmação:** nome do cliente, finalidade e impacto.
- **Regra:** nunca exibir hash, token, senha definitiva ou endereço completo de rede.

### OP-25 — Privacidade, desativação e exclusão — ATUAL/AJUSTAR

- **Campos:** motivo; confirmação digitando `EXCLUIR`; opção de apenas desativar quando aplicável.
- **Texto:** “O acesso e os dados pessoais serão removidos. O histórico obrigatório será preservado sem identificação pessoal.”
- **Regra:** reautenticação para owner/manager; anonimização transacional; relatório de resultado e auditoria.

### OP-26 — Histórico e correção do Clube — ATUAL

- **Filtros:** cliente, atendente, motivo e período.
- **Dados:** evento, delta, saldo resultante, data, ator e referência.
- **Correção:** somente owner; quantidade; motivo mínimo de 5 caracteres; cria reversão, nunca edita/apaga o lançamento original.

### OP-27 — Entrega de recompensa — ATUAL/AJUSTAR

- **Campos:** recompensa disponível; sabor/elegibilidade; adicional premium; forma de pagamento do adicional; motivo de exceção.
- **Regra:** transação única e idempotente; respeitar disponibilidade e vínculo do item.
- **Sucesso:** comprovante resumido e novo saldo.

### OP-30 — Vendas e caixa rápido — ATUAL/AJUSTAR

- **Campos:** cliente opcional/QR; itens; quantidades; variações; desconto autorizado; forma de pagamento; valor recebido; observação.
- **Ações:** Adicionar item; Suspender; Concluir; Cancelar; Imprimir/compartilhar comprovante.
- **Validações:** estoque, preço vigente, caixa aberto, total e pagamento.
- **Concorrência:** reserva/baixa e carimbos na mesma operação lógica; idempotency key por tentativa.
- **iPhone:** carrinho em tela própria; resumo fixo acima da safe area.

### OP-31 — Pedidos digitais — ATUAL/AJUSTAR

- **Filtros:** novo, confirmado, em preparo, pronto, retirado, cancelado, loja e horário.
- **Detalhe:** número, cliente, itens, pagamento, retirada, observações, histórico e responsável.
- **Ações:** aceitar; iniciar preparo; marcar pronto; concluir retirada; cancelar com motivo; falar no WhatsApp.
- **Regra:** transição de estado validada no banco; botão inválido não aparece e chamada inválida retorna 409.

### OP-40 — Agenda de encomendas — ATUAL/AJUSTAR

- **Visões:** dia, semana e lista; filtros por status, tipo e responsável.
- **Ações:** Nova solicitação; bloquear horário; abrir pedido; exportar/imprimir produção.
- **Tablet:** calendário + painel lateral de detalhe.
- **iPhone:** lista cronológica como padrão; calendário opcional.

### OP-41 — Nova/editar solicitação — ATUAL

- **Campos:** nome; WhatsApp; data/hora; produto/serviço; quantidade; detalhes; anexos; canal; status; responsável; preço/orçamento; sinal; observação interna.
- **Validações:** data futura quando nova, telefone, capacidade, produto ativo, limites de texto e arquivo.
- **Regra:** observação interna nunca aparece para o cliente.

### OP-42 — CRM de encomendas — ATUAL/AJUSTAR

- **Conteúdo:** cliente, solicitações, pedidos, anotações, próximo contato e consentimento de canal.
- **Ações:** registrar contato; agendar retorno; abrir WhatsApp; converter solicitação em pedido.
- **Regra:** abrir WhatsApp não autoriza campanha; registrar contato transacional com finalidade.

### OP-50 — Pede Junto — ATUAL/AJUSTAR

- **Lista:** nome, responsável, prazo, participantes, valor, pagamento e status.
- **Detalhe:** convite, participantes, itens, pagamentos, reserva, prazo e histórico.
- **Ações:** criar; compartilhar; fechar; estender dentro da política; cancelar; confirmar pagamento.
- **Regra:** fechamento é idempotente e não pode consumir disponibilidade duas vezes.

### OP-60 — Financeiro e sessões de caixa — ATUAL/AJUSTAR

- **Telas:** resumo; abrir caixa; movimentos; sangria/suprimento; fechar; divergências; conciliação.
- **Campos:** loja, caixa, saldo inicial, forma de pagamento, valor, motivo, comprovante e contagem final.
- **Regra:** uma sessão aberta por caixa; movimento não é apagado; correção cria contrapartida; divergência exige motivo.

### OP-70 — Produtos e serviços — ATUAL

- **Lista/filtros:** categoria, status, visibilidade, disponibilidade e erro de integração.
- **Edição:** título, descrição, tipo, categoria/subcategoria, preço, adicional, imagem original/derivadas, canais, ordem, ativo, WhatsApp, estoque e opções.
- **Validações:** preço não negativo, texto obrigatório, imagem válida, identificador único e coerência entre canal/estoque.
- **Regra:** publicar catálogo não altera preço histórico de pedidos.

### OP-80 — Disponibilidade e produção — ATUAL/AJUSTAR

- **Telas:** Adoce Hoje; disponibilidade por sabor; lotes; menu semanal; liberação; indisponibilidades.
- **Ações:** publicar, pausar, liberar lote, ajustar quantidade com motivo.
- **Regra:** pedido imediato usa estoque liberado; item planejado não é vendável antes da liberação.

### OP-81 — Horários e exceções — ATUAL

- **Campos:** canal, dia, abre, fecha; data de exceção; fechado; horário especial; mensagem pública.
- **Validação:** abertura anterior ao fechamento; sem sobreposição; exceção prevalece sobre recorrência.
- **Vazio:** canal sem faixa aparece fechado, com mensagem explícita na operação.

### OP-82 — Promoções e comunicações — ATUAL/AJUSTAR

- **Campos:** título, mensagem, tópico, canal, segmento, início, fim, agendamento e status.
- **Estados:** rascunho, aguardando aprovação, agendada, enviando, enviada, parcialmente falha, cancelada.
- **Regra:** disparo só para consentimento atual do canal/finalidade; autenticação e serviço não entram em audiência de marketing.

### OP-90 — Configurações globais — ATUAL/AJUSTAR

- **Conteúdo:** canais, loja/retirada, pagamentos, WhatsApp público, limites comerciais e flags de integração.
- **Regra:** segredo nunca é campo de retorno. UI mostra apenas “configurado/não configurado” e últimos quatro caracteres quando inevitável.

### OP-100 — Arquivo e auditoria — ATUAL/AJUSTAR

- **Filtros:** entidade, ação, ator, período, loja e correlação.
- **Regra:** leitura paginada; exportação autorizada e auditada; payload sensível mascarado.

### OP-110 — Equipe — ATUAL/AJUSTAR

- **Campos:** nome, celular/e-mail, papel, lojas/caixas, ativo, foto e troca obrigatória.
- **Ações:** convidar; editar escopo; desativar; redefinir acesso; revogar sessões.
- **Regra:** somente owner altera papéis; manager pode redefinir acesso dentro da política, mas não elevar privilégios.

### OP-120 — Restauração de produção — ATUAL/RESTRITO

- **Acesso:** owner com reautenticação recente.
- **Campos:** artefato/deploy conhecido, motivo, confirmação e plano de retorno.
- **Regra:** mostrar impacto antes da ação; nunca iniciar automaticamente; registrar identidade e resultado.

## 7. Jornada do cliente por WhatsApp

### WA-00 — Entrada

O cliente chega por QR, link oficial, convite, balcão ou `#entrar`. A URL aceita apenas parâmetros não sensíveis, como código de indicação opaco.

### WA-01 — Informar WhatsApp

- Campo com máscara brasileira e teclado telefônico.
- Texto: “Usaremos este número para confirmar que o cadastro é seu.”
- Botão: **Receber código no WhatsApp**.
- Link secundário: **Usar outra forma de acesso**.
- Erros locais: “Informe um celular com DDD.”

### WA-02 — Pré-checagem e consentimentos

- Termos do Clube e Política de Privacidade são obrigatórios para cadastro, com links e versões.
- “Quero receber novidades e promoções pelo WhatsApp” é opcional, desmarcado e revogável.
- Para login de conta já criada, não repetir aceite legal como condição; apresentar atualização documental quando necessária.

### WA-03 — Envio do OTP

- O servidor aplica CAPTCHA adaptativo, rate limits e idempotência.
- Supabase Auth gera OTP de seis dígitos.
- O Send SMS Hook entrega esse OTP por **template de autenticação aprovado** da WhatsApp Cloud API.
- Tela mostra telefone mascarado, seis campos ou campo único acessível, expiração e contador de reenvio.
- Texto: “Enviamos um código para o WhatsApp terminado em 1234.”

### WA-04 — Verificação

- Colar o código completo é aceito; avanço de foco não bloqueia leitor de tela.
- Código inválido: “Código incorreto. Confira e tente novamente.”
- Expirado: “Este código expirou. Peça um novo.”
- Bloqueado: “Muitas tentativas. Aguarde antes de pedir outro código.”
- A API não informa se a conta era nova ou existente antes da verificação.

### WA-05 — Completar cadastro

- Somente para perfil incompleto: nome e sobrenome; data de nascimento opcional e finalidade explícita; indicação opcional; preferências opcionais.
- Telefone aparece verificado e bloqueado para edição direta.
- Botão: **Abrir meu Cartão Clube Adoce**.
- Cadastro e consentimentos são concluídos em transação/RPC idempotente.

### WA-06 — Sessão e destino

- `verifyOtp({ phone, token, type: "sms" })` retorna a sessão Supabase.
- Cliente novo vai a WA-05; cliente completo vai ao Cartão; convite de grupo volta ao fluxo do convite.
- A sessão usa access token curto e refresh token rotativo. Logout revoga o token disponível; “Sair de todos os aparelhos” revoga as demais sessões.

### WA-07 — Número já vinculado, troca e recuperação

- Após OTP válido, a conta existente é aberta; não criar perfil duplicado.
- Troca de telefone exige sessão recente + OTP no novo número; risco elevado pode exigir confirmação adicional no número anterior ou revisão administrativa.
- Se o telefone não puder ser usado, oferecer recuperação por e-mail já verificado ou atendimento humano com checklist de identidade. Nunca alterar telefone apenas por conversa no WhatsApp.

### WA-08 — Fallback

Ordem:

1. reenviar WhatsApp respeitando cooldown;
2. enviar SMS pelo provedor secundário, se configurado e aceito;
3. e-mail verificado com OTP/link mágico;
4. atendimento humano, que cria pendência — não confirmação automática;
5. senha temporária administrativa somente em contingência, com expiração curta, troca obrigatória e revogação de sessões.

Mensagens de fallback não devem revelar se o telefone está cadastrado.

## 8. Arquitetura técnica recomendada

```text
Cliente/Operação
  -> BFF de autenticação (origem, CAPTCHA, rate limit, auditoria)
  -> Supabase Auth signInWithOtp(phone)
  -> Supabase Send SMS Hook assinado
  -> adaptador WhatsApp no servidor
  -> Meta WhatsApp Cloud API / template AUTHENTICATION
  -> cliente recebe OTP
  -> BFF/Supabase verifyOtp(phone, token, type=sms)
  -> sessão Supabase
  -> RPC transacional de perfil, consentimentos e Clube

Meta webhook
  -> validação GET do verify token
  -> validação HMAC X-Hub-Signature-256
  -> idempotência por wamid/evento
  -> status sent/delivered/read/failed
  -> log operacional sem conteúdo/OTP
```

### 8.1 Por que este desenho é obrigatório

- Evita inventar sessão: o Supabase cria a sessão após `verifyOtp`.
- O código nasce e é verificado pelo mesmo provedor de identidade.
- O Send SMS Hook suporta canal alternativo como WhatsApp e fallback.
- Link mágico de telefone não é o fluxo adotado; magic link fica restrito ao e-mail verificado.
- O fluxo legado em `whatsapp_auth_challenges` pode servir à confirmação adicional e telemetria durante migração, mas não deve competir como segundo emissor/verificador de OTP de login.

### 8.2 Componentes

1. `src/AdoceEntrar.tsx` e `src/services/auth.ts` — máquina de estados atual e criação da sessão no cliente; integração nova protegida por feature flag.
2. `netlify/functions/auth-whatsapp-start.ts` — pré-checagem, validação server-side, idempotência inicial, rate limit e solicitação do OTP ao Supabase.
3. `netlify/functions/auth-whatsapp-verify.ts` — vínculo desafio/telefone, `verifyOtp`, auditoria mínima e resposta de sessão reduzida.
4. `netlify/functions/supabase-send-sms-hook.ts` — valida assinatura e replay do hook, chama a Meta e retorna 2xx somente após aceitação.
5. `netlify/functions/_shared/whatsapp-auth.ts` — utilitários internos; não é publicado como endpoint.
6. `supabase/migrations/20260821092506_whatsapp_auth_hook_foundation.sql` — desafios e telemetria em schema privado, com RPCs restritas à `service_role`.
7. `netlify/functions/meta-whatsapp-webhook.ts` — alvo pendente: evoluir para status de saída e manter compatibilidade de confirmação existente até a migração.
8. RPC `customer_complete_registration_v3` — alvo pendente: perfil, consentimentos, indicação e conta em transação.

## 9. Contratos de API

Todas as respostas usam `Cache-Control: no-store`, `Content-Type: application/json`, `request_id` e erros sem PII. `Idempotency-Key` é obrigatório em mutações.

### POST `/api/auth/whatsapp/start`

```json
{
  "phone": "+5585999999999",
  "intent": "signup_or_login",
  "captcha_token": "opaque",
  "legal": {
    "terms_version": "1.0",
    "privacy_version": "1.0"
  }
}
```

Resposta 202:

```json
{
  "request_id": "uuid",
  "challenge_id": "uuid-opaco",
  "masked_phone": "+55 •• •••••-1234",
  "expires_in": 600,
  "resend_after": 60,
  "next": "verify"
}
```

Erros: 400 formato; 403 origem/CAPTCHA; 409 conflito de estado; 429 com `retry_after`; 502 provedor; 503 configuração/circuit breaker. A resposta funcional deve ser equivalente para conta existente e inexistente.

### POST `/api/auth/whatsapp/verify`

```json
{
  "challenge_id": "uuid-opaco",
  "phone": "+5585999999999",
  "code": "123456"
}
```

Resposta 200:

```json
{
  "request_id": "uuid",
  "session": {
    "access_token": "jwt",
    "refresh_token": "opaque",
    "expires_in": 3600
  },
  "profile_state": "complete",
  "next": "club_card"
}
```

Tokens só aparecem nesta resposta HTTPS e nunca em log. Alternativamente, o cliente pode verificar diretamente com a chave publicável depois da pré-checagem, desde que a auditoria e os limites continuem garantidos.

### POST `/api/auth/whatsapp/resend`

Recebe `challenge_id`, novo CAPTCHA quando exigido e nova `Idempotency-Key`. Responde 202 com novos tempos ou 429.

### POST `/api/customer/registration/complete`

Requer Bearer válido.

```json
{
  "full_name": "Maria da Silva",
  "terms_version": "1.0",
  "privacy_version": "1.0",
  "marketing_whatsapp": false,
  "referral_code": "ABC123"
}
```

Resposta 200 inclui apenas IDs próprios, nome, telefone mascarado, consentimentos atuais e próximo destino.

### POST `/api/hooks/supabase/send-sms`

- Valida assinatura Standard Webhooks do Supabase, timestamp e replay.
- Aceita somente evento esperado e telefone E.164.
- Extrai OTP apenas em memória.
- Envia template `AUTHENTICATION` aprovado, com botão “Copiar código” e expiração alinhada.
- Não persiste OTP nem corpo completo.
- Retorna 200 vazio após aceitação; erro não-2xx aciona política de fallback controlada.

### GET/POST `/api/meta-whatsapp-webhook`

- GET compara `hub.verify_token` em tempo constante e devolve `hub.challenge`.
- POST limita tamanho, valida `X-Hub-Signature-256`, `object=whatsapp_business_account` e conta configurada.
- Persiste/atualiza status idempotentemente por `wamid`.
- Responde 200 rapidamente; processamento pesado vai para fila.

## 10. Rate limit e prevenção de abuso

Limites locais iniciais, configuráveis e mais restritivos que o provedor:

| Chave | Janela | Limite | Reação |
|---|---:|---:|---|
| telefone HMAC | 15 min | 3 envios | 429 até fim da janela |
| telefone HMAC | 24 h | 10 envios | revisão/cooldown ampliado |
| IP HMAC | 15 min | 20 envios | CAPTCHA obrigatório/bloqueio |
| dispositivo HMAC | 1 h | 10 telefones distintos | bloqueio de enumeração |
| desafio | validade | 5 verificações | desafio bloqueado |
| reenvio | por desafio | 60 s | contador visível |

Regras adicionais:

- OTP: seis dígitos, uso único, TTL alvo de 10 minutos, invalidado ao emitir novo código.
- Hash de telefone/IP para limites usa HMAC-SHA-256 com pepper rotacionável, não SHA-256 simples.
- CAPTCHA adaptativo no primeiro sinal de risco; sempre em rajada, ASN suspeito ou muitos números.
- Comparação de códigos e assinaturas em tempo constante quando aplicável.
- Circuit breaker após falhas repetidas do provedor; mostrar fallback sem loop de reenvio.
- Idempotência impede duas mensagens para a mesma ação repetida.
- Nenhum log contém OTP, token, senha, conteúdo integral da mensagem ou telefone completo.

## 11. Dados e migração

### 11.1 Reutilizar e endurecer

- `profiles`: identidade do cliente; acrescentar/confirmar `phone_e164`, `phone_verified_at`, `whatsapp_verified_at`, `account_status`, `auth_upgraded_at`, `must_change_password` e datas de anonimização conforme migrações existentes.
- `consent_events`: histórico append-only; não transformar em único booleano.
- `notification_preferences`: preferência atual de produto, derivada do último consentimento válido.
- `staff_members` e `staff_store_assignments`: autorização interna.
- `audit_events`: trilha de ações relevantes.
- `whatsapp_auth_challenges`: manter para fluxo legado/risk checks durante migração; marcar versão do emissor para não validar um OTP no verificador errado.

### 11.2 Novas tabelas privadas

```sql
create table private.auth_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  phone_hmac text not null,
  phone_last4 text not null,
  channel text not null check (channel in ('whatsapp','sms','email')),
  provider text not null,
  provider_message_id text null,
  template_name text null,
  status text not null check (status in ('requested','accepted','sent','delivered','read','failed')),
  error_code text null,
  latency_ms integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index auth_delivery_provider_message_uidx
  on private.auth_delivery_attempts(provider, provider_message_id)
  where provider_message_id is not null;
create index auth_delivery_phone_created_idx
  on private.auth_delivery_attempts(phone_hmac, created_at desc);

create table private.auth_rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_type text not null,
  bucket_hmac text not null,
  action text not null,
  allowed boolean not null,
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create index auth_rate_limit_bucket_created_idx
  on private.auth_rate_limit_events(bucket_type, bucket_hmac, created_at desc);
```

Essas tabelas não recebem grants para `anon` ou `authenticated`. A retenção é definida por política; eventos técnicos detalhados não permanecem indefinidamente.

### 11.3 Consentimento

Evoluir `consent_events` de modo compatível para registrar `channel`, `purpose`, `legal_basis`, `document_version`, `source`, `actor_user_id`, `evidence_digest`, `granted_at` e `revoked_at`, ou criar `contact_consent_events` append-only. Finalidades mínimas: `club_terms`, `privacy_notice`, `security`, `service_updates`, `marketing`.

Índice recomendado: `(profile_id, channel, purpose, created_at desc)`. A consulta de audiência seleciona o evento mais recente concedido e sem revogação posterior.

### 11.4 Migração sem quebra

1. Inventariar usuários Auth e perfis duplicados por telefone normalizado; não mesclar automaticamente.
2. Adicionar colunas/tabelas e testes de RLS sem ativar envio.
3. Implantar hook e endpoints com feature flag desligada.
4. Provar em homologação com número de teste e dados fictícios.
5. Migrar um grupo controlado; manter login atual como fallback.
6. Só depois desativar o OTP legado; preservar auditoria e rollback.

### 11.5 Estado da fundação em produção em 21/08/2026

- A migração privada `20260821092506_whatsapp_auth_hook_foundation.sql` foi aplicada de forma isolada no projeto de produção, após simulação transacional com `ROLLBACK`.
- `private.whatsapp_auth_requests` vincula UUID opaco ao HMAC do telefone e validade; não guarda telefone ou OTP em claro.
- `private.auth_delivery_attempts` guarda apenas telemetria mínima de entrega, últimos quatro dígitos e identificador do provedor.
- A autoria do teste controlado é vinculada ao usuário da operação; o modo `pilot` exige sessão ativa e papel `owner` ou `manager` no servidor.
- A auditoria remota confirmou que as quatro funções auxiliares negam execução a `anon` e `authenticated` e concedem execução apenas à `service_role`.
- `WHATSAPP_AUTH_ENABLED=false`, `WHATSAPP_AUTH_ACCESS_MODE=disabled`, `VITE_WHATSAPP_AUTH_ENABLED=false` e `VITE_WHATSAPP_AUTH_PILOT_ENABLED=false` mantêm endpoints, fluxo público e tela operacional desligados por padrão.
- `supabase/rollbacks/20260821092506_whatsapp_auth_hook_foundation.rollback.sql` remove somente as quatro funções e as duas tabelas desta fundação, sem tocar o login atual do cliente.
- O login atual do cliente por celular/senha e recuperação existente permanece como fallback e não depende desta fundação.
- CAPTCHA adaptativo, limite diário/dispositivo, circuit breaker, fallback SMS, conclusão transacional do cadastro e status de entrega da Meta continuam pendentes antes de homologação completa.

## 12. Segurança e LGPD

- Minimização: coletar apenas dados necessários à finalidade declarada.
- Transparência: informar controlador, finalidade, canal, retenção e direitos em linguagem simples.
- Consentimento promocional: livre, específico, destacado, comprovável e revogável sem perder o Clube.
- Segurança/autenticação: registrar base e finalidade separadas do marketing; não condicionar serviço à propaganda.
- Direitos: permitir confirmação, acesso, correção, portabilidade quando aplicável, revogação, oposição e eliminação dentro das exceções legais.
- Retenção: definir prazo por classe; OTP não é retido, evento técnico é minimizado, histórico fiscal/antifraude segue obrigação própria.
- Incidente: correlação, contenção, avaliação, comunicação e evidência, sem apagar trilha.
- Operadores: Meta, Supabase, Netlify e provedor secundário devem constar no inventário de tratamento e contratos aplicáveis.
- Segredos: variáveis contextuais por ambiente, rotação, princípio do menor privilégio e nunca `VITE_*` para segredo.
- Cabeçalhos: CSP, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` e CORS allowlist.
- Sessão: armazenamento conforme SDK, refresh rotativo, revogação e reautenticação para ações sensíveis.
- Logs: mascarar PII, restringir acesso, definir retenção e auditar exportações.

## 13. Variáveis e configuração

Servidor:

```env
WHATSAPP_AUTH_ENABLED=false
WHATSAPP_AUTH_ROLLOUT_PERCENT=0
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_APP_SECRET=
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_GRAPH_VERSION=
META_WHATSAPP_AUTH_TEMPLATE=
META_WHATSAPP_AUTH_TEMPLATE_LANGUAGE=pt_BR
SUPABASE_SEND_SMS_HOOK_SECRET=
AUTH_RATE_LIMIT_HMAC_SECRET=
AUTH_FALLBACK_SMS_ENABLED=false
```

Regras:

- Tokens e secrets nunca usam prefixo `VITE_`.
- Variáveis são distintas em local, homologação e produção.
- O painel mostra presença e validade operacional, nunca valor.
- Versão da Graph API e nome do template são configuração, não literal espalhado no código.

## 14. Observabilidade e auditoria

Eventos mínimos:

- `auth.whatsapp.requested`, `rate_limited`, `provider_accepted`, `delivered`, `failed`, `verified`, `expired`, `blocked`, `fallback_selected`;
- `customer.registration_completed`, `phone_change_requested`, `phone_changed`, `consent_granted`, `consent_revoked`;
- `staff.customer_opened`, `customer_updated`, `access_reset`, `sessions_revoked`, `customer_anonymized`.

Campos permitidos: `request_id`, ator, entidade opaca, telefone HMAC/últimos quatro, papel, loja, status, código de erro, latência e timestamp. Proibidos: OTP, senha, token, App Secret, corpo completo, telefone completo e payload bruto indiscriminado.

Alertas: taxa de falha do hook, 429 anormal, aumento de OTP inválido, webhook sem assinatura, template rejeitado, filas antigas, circuito aberto e discrepância entre aceito/entregue.

## 15. Plano de testes obrigatório

### 15.1 Backend e banco

- normalização de telefone brasileiro com casos válidos/inválidos;
- assinatura do hook Supabase, timestamp expirado e replay;
- assinatura Meta válida/inválida e comparação em tempo constante;
- rate limit por telefone/IP/dispositivo, fronteira de janela e concorrência;
- OTP correto, incorreto, expirado, reutilizado, reenviado e cinco tentativas;
- idempotência de start, verify, cadastro, venda e recompensa;
- conta nova, existente, inativa, anonimizada e telefone duplicado;
- fallback sem enumeração;
- transação de perfil + consentimentos + conta do Clube;
- grants e RLS para `anon`, cliente, attendant, viewer, manager, owner e service role;
- `UPDATE` com política de `SELECT` correspondente;
- funções `security definer` com `search_path=''`, argumentos qualificados e grants explícitos;
- webhook duplicado, fora de ordem e status failed;
- nenhuma resposta/log contém segredo, OTP ou PII indevida.

### 15.2 Frontend

- testes de componentes para todos os estados da seção 5.2;
- máscara, colagem do OTP, teclado, autofill `one-time-code` e reenvio;
- foco, leitor de tela, labels, `aria-live`, Escape e retorno de foco;
- navegação completa por teclado;
- abertura direta da ficha por “Abrir cadastro”;
- busca por nome, telefone, código e QR;
- formulário preservado após erro de rede;
- sessão expirada durante ação e retomada segura;
- tabelas convertidas em cartões sem perda de rótulo.

### 15.3 E2E e visual

Executar jornadas completas nos viewports 1280×800, 1024×600, 402×874, 390×844 e 1440×900:

1. equipe entra, busca cliente, abre ficha e redefine acesso;
2. cliente novo recebe OTP real em homologação, verifica, conclui cadastro e abre cartão;
3. cliente existente entra sem duplicação;
4. código inválido/expirado e rate limit;
5. provedor falha e fallback aparece;
6. telefone duplicado/troca verificada;
7. venda com Clube, recompensa, histórico e correção autorizada;
8. pedido percorre os estados permitidos;
9. caixa abre, movimenta, fecha e concilia;
10. owner/manager/attendant/viewer veem apenas ações permitidas.

Validar textos, imagens, botões, modais, rolagem, teclado aberto, orientação, estados vazios, console e rede. No iPhone 17, repetir as jornadas críticas no Safari real e guardar capturas com safe area.

### 15.4 Segurança

- enumeração de contas por tempo, status e texto;
- brute force distribuído e troca de IP;
- CSRF/origem/CORS, XSS em nomes e observações, injeção e payload excessivo;
- token replay, refresh roubado, sessão revogada e elevação de papel;
- acesso horizontal a outro cliente/loja;
- exposição de source map, env e segredo em bundle;
- webhook falso, payload grande, JSON inválido e evento em massa;
- dependências, SAST, secret scanning e revisão manual das funções administrativas.

## 16. Fases de implementação para agentes

### Fase 0 — Inventário e testes de caracterização

- Confirmar código, schema, migrações aplicadas e variáveis por ambiente sem ler valores sensíveis.
- Criar testes das jornadas atuais antes de refatorar.
- Registrar divergências entre este contrato, documentação e ambiente.

### Fase 1 — Descoberta e ficha de cliente

- Consolidar OP-20 a OP-25.
- Preservar “Abrir cadastro” direto, redefinição server-side e permissões.
- Validar tablet/iPhone e fluxo autenticado.

### Fase 2 — Fundação de autenticação

- Criar tabelas privadas, rate limiter, feature flags e contratos.
- Configurar Send SMS Hook local/homologação.
- Implementar adaptador Meta e webhook idempotente.

### Fase 3 — UX do OTP e cadastro

- Implementar WA-00 a WA-08 como máquina de estados.
- Integrar `signInWithOtp`/`verifyOtp` e RPC transacional.
- Manter login atual como fallback controlado.

### Fase 4 — Operação completa

- Fechar lacunas OP-10 a OP-130 por prioridade operacional.
- Aplicar permissão no servidor, responsividade e estados globais.

### Fase 5 — Homologação externa

- Template `AUTHENTICATION` aprovado, número e token permanentes, webhook e hook configurados.
- Teste real request → WhatsApp recebido → OTP verificado → sessão → cadastro, sem expor o código na evidência.
- Testar falha e fallback.

### Fase 6 — Publicação controlada

- `npm run release:check` 100%.
- Matriz automática, funcional, visual, segurança, aparelhos reais e rollback aprovados.
- Explicar causa, mudança, risco e rollback ao responsável.
- Obter autorização explícita antes do deploy.
- Após deploy, verificar domínio oficial sem iniciar outro deploy.

## 17. Definition of Done e checklist final

- [ ] Estado real foi reconfirmado no destino; documentação não foi tratada como prova.
- [ ] Todas as telas aplicáveis têm loading, vazio, erro, sucesso, offline e permissão.
- [ ] Tablet 10,4 horizontal e iPhone 17 real passaram nas jornadas críticas.
- [ ] “Abrir cadastro” e “Redefinir senha” são descobertos sem seção escondida.
- [ ] OTP é gerado/verificado pelo Supabase e entregue pelo hook WhatsApp.
- [ ] Template de autenticação e credenciais estão aprovados no ambiente correto.
- [ ] Rate limit, CAPTCHA, idempotência, replay protection e circuit breaker passaram.
- [ ] Nenhum segredo, OTP, token ou PII indevida aparece em bundle, URL ou log.
- [ ] RLS/grants foram testados por papel e por loja.
- [ ] Consentimento legal, serviço, segurança e marketing estão separados e revogáveis.
- [ ] Cadastro duplicado, troca de telefone e fallback passaram.
- [ ] Webhook válido, inválido, duplicado, fora de ordem e falho passaram.
- [ ] Auditoria possui correlação sem conteúdo sensível.
- [ ] Testes unitários, integração, E2E, visuais, acessibilidade e segurança estão 100%.
- [ ] `npm run release:check` passou.
- [ ] Backup/rollback e feature flag de desligamento foram ensaiados.
- [ ] Responsável recebeu explicação pré-deploy e autorizou explicitamente.
- [ ] Domínio oficial foi validado após publicação.

## 18. Referências técnicas oficiais

- [Supabase — Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)
- [Supabase — Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase — Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Meta — template de autenticação com botão para copiar OTP](https://www.postman.com/meta/whatsapp-business-platform/request/qzriq9r/create-authentication-template-w-otp-copy-code-button)
- [Meta — payloads de webhook do WhatsApp](https://www.postman.com/meta/whatsapp-business-platform/folder/hyrslh5/webhook-payload-reference)
- [Apple — especificações do iPhone 17](https://www.apple.com/br/iphone-17/specs/)
- [Lei Geral de Proteção de Dados Pessoais](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

## 19. Classificação atual desta entrega

- Documento: **implementado e validado na geração da documentação** depois da execução do gerador.
- Descoberta e abertura do cadastro de cliente: **validada automaticamente no código local**; validação visual autenticada completa ainda pendente.
- Fundação OTP via Send SMS Hook: **implementada localmente, validada por testes focados e desligada por feature flags**.
- Migração SQL: **implementada, ainda não aplicada nem validada contra banco local/remoto**, pois a instância local do Postgres não estava disponível.
- Integração Meta/Supabase real, CAPTCHA, fallback, status de entrega, testes em aparelhos e publicação: **parcialmente implementados ou dependentes de configuração externa e autorização**.
- Produção: **não alterada e não validada por esta entrega**.
