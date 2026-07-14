---
title: Status da publicação
description: Registro do projeto oficial na Netlify, domínio e pendências de ativação.
status: Em andamento
---

# Status da publicação

## Estado em 14/07/2026

- Projeto oficial Netlify: **adocebrigaderia**.
- Endereço temporário ativo: `https://adocebrigaderia.netlify.app`.
- Página publicada: apresentação honesta do Clube Adoce em construção.
- Domínio principal associado na Netlify: `www.adocebrigaderia.com.br`.
- Alias associado: `adocebrigaderia.com.br`.
- HTTPS do domínio próprio: aguardando configuração e propagação do DNS.
- Projetos antigos `rococo-cupcake-eb7525` e `adoce-club`: excluídos.

## Nova apresentação publicada

Em 14/07/2026 foi selecionada a direção visual **Chocolate Depois das Oito** para substituir a apresentação publicada. A nova versão preserva a identidade oficial da Adoce e acrescenta:

- composição sensorial em chocolate, creme e coral;
- fatia integrada livremente ao fundo, sem moldura ou cartão;
- menu suspenso funcional no desktop e no celular;
- transições de entrada, navegação suave, faixa em movimento e profundidade sutil no produto;
- conteúdo honesto, mantendo explícito que o Clube Adoce ainda está em construção.

A versão foi publicada na Netlify em 14/07/2026, no deploy `6a562275780e54595c005b4a`, e está ativa em `https://adocebrigaderia.netlify.app`. O domínio próprio continua aguardando a conclusão da transição e a configuração dos registros DNS no Registro.br.
## Plano e créditos

A equipe AdoceClub permanece no plano gratuito. Na consulta feita durante a publicação, o plano indicava 300 créditos mensais e 0 créditos utilizados no ciclo. A recusa inicial do deploy de produção não foi causada por falta de créditos; o deploy de revisão foi promovido corretamente para produção.

## Próxima ação no Registro.br

Criar os seguintes registros na zona DNS:

| Tipo | Nome | Destino |
| --- | --- | --- |
| A | raiz ou `@` | `75.2.60.5` |
| CNAME | `www` | `adocebrigaderia.netlify.app` |

Depois da alteração, verificar propagação, emissão automática do certificado, acesso HTTPS e redirecionamento do domínio raiz para `www`.
