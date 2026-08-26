# Ligar o cartão do Clube Adoce à carteira do celular
**Guia passo a passo para o Rubens** · 07/08/2026

---

## 0. O que já existe

Boa notícia: **quase tudo.**

| Item | Situação |
|---|---|
| Tabela `customer_wallet_passes` | ✅ existe |
| Função `customer_prepare_google_wallet_pass` | ✅ existe |
| 15 imagens de progresso (0 a 14 carimbos) | ✅ **redesenhadas em 07/08** — fatia vira coração |
| Botão "Adicionar à carteira" na área do cliente | ⚠️ existe em **modo demonstração** |
| Credenciais do Google | ❌ falta — é o que este guia resolve |

O que falta é o cadastro da Adoce como **emissor** no Google, e as chaves.

---

## 1. Entenda o que você está criando

Um **cartão de fidelidade** (Loyalty Card) no Google Wallet. O cliente adiciona uma vez e ele fica no celular, junto com os cartões dele.

O que o cliente vê: a marca da Adoce, quantos carimbos tem, a faixa de corações e fatias, o código para a Beth escanear, e o nome dele.

O que ele **não** precisa: login, senha, abrir o site, procurar menu.

⚠️ **O que não vai funcionar:** ler o cartão por aproximação no tablet. Isso exige terminal certificado (Smart Tap), que é outro tipo de hardware. A leitura é pela **câmera, no código de barras** — como no Starbucks e nos supermercados. Funciona no Android e no iPhone.

---

## 2. O que só você pode fazer

### Passo 1 — Conta Google da empresa

Use uma conta Google **da Adoce**, não pessoal. Se não tiver, crie uma (`contato@adocebrigaderia.com.br` ou similar). Quem controlar essa conta controla os cartões de todos os clientes — não use conta pessoal que possa se perder.

### Passo 2 — Cadastro como emissor

1. Acesse `pay.google.com/business/console`
2. Entre com a conta da empresa
3. Procure **Google Wallet API** e solicite acesso
4. Preencha os dados da Adoce: razão social, CNPJ, endereço, site `https://www.adocebrigaderia.com.br`
5. Aceite os termos da API

Ao final você recebe um **Issuer ID** — um número longo. **É esse número que eu preciso.** Ele não é segredo, pode me passar normalmente.

⏳ A aprovação costuma levar de alguns dias a duas semanas. Comece cedo, como fizemos com a Meta.

### Passo 3 — Conta de serviço (a chave)

1. Acesse `console.cloud.google.com`
2. Crie um projeto chamado `Clube Adoce` (ou use um existente da empresa)
3. **APIs e serviços → Biblioteca** → procure **Google Wallet API** → **Ativar**
4. **IAM e Admin → Contas de serviço → Criar conta de serviço**
   - Nome: `cartao-clube-adoce`
5. Na conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova** → tipo **JSON**
6. Um arquivo `.json` será baixado

⚠️ **Esse arquivo é a chave da sua empresa.** Não me mande, não coloque em e-mail, não suba no GitHub. Você cola direto no Netlify no Passo 5.

### Passo 4 — Autorizar a conta de serviço

De volta em `pay.google.com/business/console`:

1. **Usuários** → **Convidar usuário**
2. Cole o e-mail da conta de serviço (está dentro do JSON, no campo `client_email`, e termina em `.iam.gserviceaccount.com`)
3. Permissão: **Desenvolvedor**

Sem esse passo, a chave existe mas não tem permissão para criar cartões.

### Passo 5 — Colar no Netlify

Projeto **adoce-homologacao** → Site configuration → Environment variables:

| Variável | Valor | Secreta? |
|---|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | o número do Passo 2 | não |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | o **conteúdo inteiro** do arquivo JSON | **sim** |
| `GOOGLE_WALLET_MODE` | `live` | não |

Lembrando a regra do Netlify: marcar como secreta obriga escopos específicos (**Functions** e **Runtime**) e valor por contexto — cole o mesmo em Production, Deploy Previews, Branch deploys e Preview Server.

Já existe uma variável `GOOGLE_WALLET_ORIGINS` configurada. Não precisa mexer.

---

## 3. O que eu faço

1. Ligar a função `customer_prepare_google_wallet_pass` ao modo real
2. Criar a classe do cartão no Google com a identidade da Adoce
3. Publicar as 15 faixas de progresso e ligar a troca automática a cada carimbo
4. Fazer o botão "Adicionar à carteira" sair do modo demonstração
5. Ligar o leitor de código do tablet à tela de carimbar
6. Testar o ciclo: adicionar → carimbar → ver a faixa mudar no celular

---

## 4. Ordem

1. Você: Passos 1 e 2 (**começa agora**, é o que demora)
2. Enquanto aprova: eu preparo o código em homologação
3. Você: Passos 3 a 5, quando o Issuer ID sair
4. Nós: teste ponta a ponta
5. Produção — **mas só depois das 93 migrações**, que continuam pausadas por sua decisão

---

## 5. Detalhe de design aprovado em 07/08

A faixa tem 14 posições:

- **Não carimbado:** fatia de bolo com camadas e um coração rosa no topo, em círculo tracejado
- **Carimbado:** coração vermelho em círculo rosa, cada um com inclinação levemente diferente — carimbo de mão nunca sai reto duas vezes igual
- **14ª posição:** presente com laço e coração, em círculo com aro dourado

É a tradução do cartão de papel que a Adoce usava, onde a Beth carimbava cada coração com um carimbo em forma de fatia.
