# Ligar o catálogo da Adoce ao WhatsApp e ao Instagram
**Guia passo a passo para o Rubens** · 07/08/2026

> Leia primeiro a seção 0. Ela muda a ordem das coisas.

---

## 0. ANTES DE TUDO: sua produção está 3 semanas atrás do código

Descobri isso conferindo o banco de produção:

- Migrações no seu computador: **151**
- Migrações aplicadas em produção: **58**
- **93 migrações nunca foram aplicadas em produção**
- Última aplicada: **23/07/2026**

Ou seja: tudo que foi construído de **24/07 até hoje** existe só no código. Entre o que **não está** no banco de produção:

| O que | Migração |
|---|---|
| Catálogo Meta (a integração que você quer) | `meta_catalog_sync` |
| Base do canal Instagram | `instagram_channel_foundation` |
| WhatsApp Cloud / OTP | `whatsapp_cloud_otp` |
| **Fechamento de permissões `anon`** | `anon_grants_hardening` |
| **Bloqueio explícito de tabelas internas** | `backend_only_tables_explicit_deny` |
| **Limite de requisições nos endpoints públicos** | `public_endpoint_rate_limits` |
| **Trava de funções sensíveis** | `lock_sensitive_function_execute` |
| Matriz de permissão da equipe | `staff_permission_matrix` |
| LGPD / privacidade (≈25 migrações) | `privacy_*` |
| Custos, precificação, lucratividade | `costing_*`, `product_profitability_*` |
| Montador de bolo, produtos configuráveis | `cake_builder_*`, `unified_configurable_products` |
| Caixa e conciliação | `business_structure_and_cash`, `cash_reconciliation_queue` |

**Isto explica os alertas de segurança do relatório anterior.** As correções foram escritas — só nunca chegaram no banco. E explica por que o pedido no site parou em 25/07: o código em produção provavelmente está chamando funções e tabelas que lá não existem.

**Portanto: nada de Meta antes de resolver isto.** Sincronizar catálogo com um banco desatualizado só espalha o problema.

### A ordem certa

1. **Sincronizar homologação** com as 151 migrações → testar → confirmar que tudo funciona
2. **Aplicar em produção** as 93 pendentes, em lotes, com backup antes
3. **Só então** ligar a Meta

Eu conduzo os passos 1 e 2. O passo 3 precisa de você — é o que está descrito abaixo.

---

## PARTE A — O que só você pode fazer (contas Meta)

Nada aqui é código. É conta, cadastro e aprovação. Leva de 3 dias a 3 semanas, e a maior parte é espera da Meta. **Comece por isso enquanto eu arrumo o banco** — assim as duas coisas correm em paralelo.

### Passo 1 — Conta comercial na Meta (Meta Business Suite)

1. Acesse `business.facebook.com`
2. Se já existe uma conta comercial da Adoce, use essa. Se não: **Criar conta** → nome "Adoce Brigaderia", seu nome, seu e-mail comercial.
3. Em **Configurações do negócio → Informações do negócio**, preencha CNPJ, endereço e telefone da Adoce.
   - ⚠️ Precisa bater com o que está na Receita. A Meta confere isso na verificação.
4. Vá em **Central de Segurança** → inicie a **verificação do negócio**. Vão pedir documento do CNPJ e comprovante de endereço.
   - Esta etapa é a mais lenta (pode levar de 2 dias a 2 semanas). Comece hoje.

**Me avise quando terminar** e me passe o **ID da conta comercial** (aparece em Configurações do negócio → Informações do negócio, um número longo).

> ✅ **Concluído em 07/08:** empresa **Verificada** na Central de Segurança.
> **ID do portfólio empresarial:** `1180557051818355` → é a variável `META_BUSINESS_ID`.
> ⚠️ **Pendência de segurança:** a autenticação de dois fatores do portfólio está como **"Ninguém"**. Este portfólio vai controlar catálogo, Instagram, WhatsApp e, em breve, pagamentos. Recomendo mudar para "Todos" em Configurações → Central de Segurança.

---

### Passo 2 — Página do Facebook + Instagram profissional vinculados

1. A Adoce precisa de uma **Página** do Facebook (não perfil pessoal). Se não tem, crie em `facebook.com/pages/create` — categoria "Confeitaria" ou "Padaria/Confeitaria".
2. No app do Instagram da Adoce: **Configurações → Tipo de conta → Mudar para conta profissional → Empresa**.
3. Ainda no Instagram: **Configurações → Central de Contas** → vincule à Página do Facebook da Adoce.
4. No Business Suite, em **Configurações do negócio → Contas → Contas do Instagram**, confirme que a conta da Adoce aparece ali.

**Me passe:** o **ID da conta do Instagram** (Business Suite → Contas do Instagram → clique na conta → o ID aparece na URL ou nos detalhes).

> ✅ **Já recebido em 07/08:** `@_adocebrigaderia_` · ID `17841462700532462` · propriedade de Adoce Brigaderia.
> Este é o valor da variável `META_INSTAGRAM_ACCOUNT_ID` no Passo 6.

---

### Passo 3 — Criar o Catálogo (Commerce Manager)

1. Acesse `business.facebook.com/commerce`
2. **Adicionar catálogo** → tipo **"Produtos"** → **"Fazer upload das informações do produto"** (não conecte plataforma; nós vamos enviar por API)
3. Nome: `Catálogo Adoce`
4. Vincule à conta comercial da Adoce.
5. Depois de criado, entre no catálogo → **Configurações** → copie o **ID do catálogo**.

**Me passe:** o **ID do catálogo**.

---

### Passo 4 — WhatsApp Business Platform (a parte que confunde)

⚠️ **Atenção, isso é o que mais gera confusão:** o **WhatsApp Business** que você usa no celular **não** sincroniza catálogo por API. Para o site alimentar o catálogo automaticamente, é preciso o **WhatsApp Business Platform (Cloud API)**, que é outra coisa.

Você tem duas opções:

| Opção | Como é | Quando escolher |
|---|---|---|
| **A — Manter o app do celular** | Você cadastra os produtos na mão no app. Sem API. | Se hoje são poucos produtos e mudam pouco. Custo zero, zero espera. |
| **B — Cloud API** | O site sincroniza sozinho. Exige verificação do negócio e número dedicado. | Se o cardápio muda toda semana (é o seu caso, com o Adoce Hoje). |

**Minha recomendação: B**, mas só depois do banco estar em dia. E o número precisa ser **um número que não esteja em uso no app do WhatsApp Business** — se migrar o número atual, você perde o app. Considere usar um chip novo só para isso.

Se for pela opção B:

1. Em `developers.facebook.com` → **Meus apps** → **Criar app** → tipo **"Empresa"** → vincule à conta comercial da Adoce.
2. No painel do app → **Adicionar produto** → **WhatsApp** → **Configurar**.
3. Em **Introdução**, adicione o número de telefone e confirme por SMS/ligação.
4. Anote o **ID do número de telefone** e o **ID da conta do WhatsApp Business (WABA)**.

**Me passe:** ID do número de telefone, ID do WABA — e me diga qual número você escolheu.

> ✅ **Já recebido em 07/08:** conta "Festival de fatias Adoce Brigaderia" · ID `28319993937602560` · tipo **Aplicativo WhatsApp Business**.
> ⚠️ Atenção ao tipo: este é o ativo do **app do celular**, não da Cloud API. Serve para o catálogo manual (opção A). Para a opção B é preciso criar uma conta do tipo **WhatsApp Business Platform** com número dedicado.

### Voltar atrás depois de migrar: é possível, mas custa caro

Se o número for migrado para a Cloud API e depois você quiser trazê-lo de volta para o app:

1. É preciso **remover o número da WABA** no Gerenciador de Negócios ("downgrade do número")
2. Só é permitido se o número **não enviou mensagens pagas nos últimos 30 dias**
3. **O histórico de conversas é perdido** — nas duas direções da migração
4. Espera de ~24h até o número ficar livre
5. Só então dá para registrar de novo no app

Ou seja: dá para desfazer, mas você passa pela interrupção duas vezes e perde as conversas nas duas. Por isso a recomendação continua sendo **começar direto com o chip novo**.

---

### Passo 5 — Permissões e token

1. Ainda em `developers.facebook.com`, no seu app → **Revisão do app → Permissões e recursos**
2. Solicite: `catalog_management`, `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`
   - Para Instagram Shopping depois: `instagram_basic`, `instagram_shopping_tag_products`
3. A Meta vai pedir um vídeo mostrando o uso e uma descrição. **Me chame nessa hora** — eu escrevo os textos e te digo exatamente o que gravar.
4. Depois de aprovado: **Configurações do app → Básico** → copie o **Segredo do app (App Secret)**
5. Gere um **token de acesso do sistema** (não o temporário de 1 hora):
   - Business Suite → **Configurações do negócio → Usuários → Usuários do sistema**
   - **Adicionar** → nome "Integração Site Adoce" → função **Administrador**
   - **Atribuir ativos** → marque o Catálogo Adoce, a Página, a conta do Instagram e o WABA, com controle total
   - **Gerar novo token** → selecione o app → marque as permissões acima → **sem expiração**
   - ⚠️ **Copie o token e guarde num lugar seguro. Ele aparece uma única vez.**

**Este token é uma senha da sua empresa.** Não cole em chat, e-mail ou documento. Você mesmo vai colá-lo direto no Netlify — eu te mostro onde no Passo 6, e eu nunca preciso vê-lo.

---

### Passo 6 — Colar as chaves no Netlify (você faz, eu acompanho)

1. `app.netlify.com` → projeto **adocebrigaderia**
2. **Site configuration → Environment variables**
3. Adicione uma a uma (**Add a variable → Add a single variable**, escopo *Functions*):

| Nome da variável | O que colar |
|---|---|
| `META_ACCESS_TOKEN` | o token do Passo 5 |
| `META_BUSINESS_ID` | ID da conta comercial (Passo 1) |
| `META_CATALOG_ID` | ID do catálogo (Passo 3) |
| `META_WABA_ID` | ID do WABA (Passo 4) |
| `META_PHONE_NUMBER_ID` | ID do número (Passo 4) |
| `META_GRAPH_API_VERSION` | `24.0` |
| `META_CATALOG_PRODUCT_BASE_URL` | `https://www.adocebrigaderia.com.br` |
| `META_WHATSAPP_APP_SECRET` | App Secret (Passo 5) |
| `META_WHATSAPP_VERIFY_TOKEN` | uma senha longa que **você inventa** (ex.: 30 caracteres aleatórios) — anote |
| `META_INSTAGRAM_ACCOUNT_ID` | ID do Instagram (Passo 2) |
| `META_INSTAGRAM_APP_SECRET` | mesmo App Secret |
| `META_INSTAGRAM_VERIFY_TOKEN` | outra senha longa que você inventa — anote |
| `META_ENVIRONMENT` | `production` |

4. **Não** marque nenhuma como pública e **nunca** use o prefixo `VITE_` nessas — `VITE_` vai parar dentro do navegador do cliente.

---

### Passo 7 — Ligar o webhook

1. `developers.facebook.com` → seu app → **WhatsApp → Configuração → Webhooks**
2. **URL de callback:** `https://www.adocebrigaderia.com.br/.netlify/functions/meta-whatsapp-webhook`
3. **Token de verificação:** o `META_WHATSAPP_VERIFY_TOKEN` que você inventou
4. **Verificar e salvar** → assine os campos `messages` e `message_template_status_update`
5. Para o Instagram, repita em **Instagram → Webhooks** com a URL `.../meta-instagram-webhook` e o token do Instagram.

Se der erro de verificação, me chame — eu leio os logs da função no Netlify e te digo o que está errado.

---

## PARTE B — O que eu faço

1. Sincronizar homologação com as 151 migrações e testar tudo
2. Aplicar as 93 migrações pendentes em produção, em lotes, com backup
3. Corrigir o vazamento de token no analytics e purgar os registros
4. Rodar a primeira sincronização do catálogo e conferir cada produto
5. Ajustar o catálogo para o formato que a Meta exige (foto quadrada, descrição, preço, disponibilidade)
6. Ligar as flags do Instagram uma a uma, testando cada uma

---

## Sua lista de hoje

- [ ] Passo 1 — verificação do negócio (**é a mais lenta, comece por ela**)
- [ ] Passo 2 — Página + Instagram profissional vinculados
- [ ] Passo 3 — criar o catálogo
- [ ] Decidir: opção A ou B do WhatsApp (**me diga qual**)

Os passos 5 a 7 só depois que o banco estiver em dia. Não pule a ordem.
