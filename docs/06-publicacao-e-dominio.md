---
title: Publicação e domínio
description: Hospedagem, DNS, HTTPS e migração para cantinhodaadoce.com.br.
status: Publicado em produção
---

# Publicação e domínio

## Migração autorizada em 02/11/2026 — Cantinho da Adoce

O proprietário aprovou expressamente a migração de produção para `https://www.cantinhodaadoce.com.br`, incluindo DNS, HTTPS e redirecionamentos. Esta decisão substitui o endereço principal citado nas seções históricas abaixo; continua existindo somente um projeto de produção, sem homologação online.

- Domínio principal: `www.cantinhodaadoce.com.br`.
- DNS externo no Registro.br: A da raiz para `75.2.60.5`; CNAME `www` para `adocebrigaderia.netlify.app`.
- `cantinhodaadoce.com.br`, `adocebrigaderia.com.br` e `www.adocebrigaderia.com.br`: redirecionamento permanente 301 para o principal, preservando caminho e parâmetros.
- As rotas `/api/*` continuam atendidas pelo mesmo backend no domínio anterior, antes das regras de redirecionamento, para preservar integrações existentes, assinaturas de webhooks e aplicativos instalados. Não são um segundo ambiente.
- Atualizar links gerados, origem permitida, API nativa, SEO, sitemap e URLs de autenticação sem alterar e-mails, chave Pix ou identificadores existentes de clientes.
- Callbacks de mensagens já enviadas aceitam assinaturas válidas para o endereço antigo ou novo; continuam rejeitando assinaturas de outros domínios.
- Sessões, permissões de notificação e passkeys são vinculadas ao domínio pelo navegador. Pode ser necessário entrar novamente e reativar notificações no novo endereço; credenciais passkey antigas não são transferíveis entre domínios.

Validação: testes de origem e callbacks, `npm run release:check`, conferência local em computador/celular/tablet, certificado dos quatro hosts e redirecionamento com caminho e parâmetros no domínio oficial. Estado em 02/11/2026: publicado e validado em produção no deploy `6ae85fdf7753c5556984ea9e`, com DNS propagado, certificado emitido para os quatro hosts, domínio principal Netlify e Site URL Supabase atualizados. Os seis redirecionamentos (HTTP/HTTPS dos três hosts secundários) preservam caminho e parâmetros. O pacote remoto corresponde ao build local validado. A Home e o Clube foram conferidos em computador/celular; a Operação carregou o painel Hoje em uma sessão autenticada no novo domínio, em viewport de tablet, sem alterar dados. Não foram testados cadastro, venda, envio de mensagem ou impressão nesta migração.

## Histórico — decisão de 24/10/2026: somente produção online

O único ambiente online permitido para este produto é `https://www.adocebrigaderia.com.br`. O antigo site de homologação foi desativado definitivamente. É proibido recriá-lo, publicar aliases, Deploy Previews ou branch deploys, bem como conectar qualquer endereço alternativo aos dados e credenciais de produção.

Desenvolvimento, testes e validações anteriores à publicação acontecem localmente em `D:\AdoceOnLine`. Toda modificação futura exige autorização explícita e específica do proprietário antes de ser aplicada em produção. Uma autorização para investigar, desenvolver, testar ou revisar não autoriza publicação. A solução só pode ser apresentada como concluída depois da validação automática pertinente e da confirmação no domínio oficial quando a publicação tiver sido autorizada.

## Regra atual de endereços

As páginas do site, do Clube Adoce, do Adoce Hoje e da Adoce Operação usam caminhos no endereço, sem fragmentos `#`. A entrada da equipe é `/operacao`, e as telas internas usam caminhos abaixo de `/operacao/`. O servidor entrega a aplicação nessas rotas, e o frontend seleciona a superfície correta pelo caminho. A validação no domínio oficial deve ser feita após cada publicação.

O acesso assistido ao Clube usa `/acesso-direto`; e-mail e código temporário são informados na tela, nunca colocados na URL. Fragmentos de retorno de autenticação recebidos de links antigos continuam sendo aceitos apenas para concluir a sessão com segurança.

## Domínio oficial

O domínio oficial é **adocebrigaderia.com.br**, registrado no Registro.br. Em 14/07/2026, a consulta pública indicava os servidores `a.auto.dns.br` e `b.auto.dns.br`, sem registro A público para o site e sem CNAME para `www`.

O registro deve permanecer no Registro.br. Hospedagem e domínio são serviços diferentes: o Registro.br mantém a propriedade e o DNS; a plataforma de hospedagem entrega o site e o HTTPS.

## Organização recomendada

| Endereço | Finalidade |
| --- | --- |
| `www.adocebrigaderia.com.br` | Endereço principal do site e do Clube Adoce |
| `adocebrigaderia.com.br` | Redirecionamento automático para `www` |
| `api.adocebrigaderia.com.br` | API futura, se a arquitetura exigir domínio separado |
| `/atendimento` | Área protegida da equipe |
| `/admin` | Área protegida de gestão |

Atendimento e administração podem usar caminhos no mesmo domínio, desde que a autorização seja verificada pelo servidor. Conhecer a URL nunca concede acesso.

## Hospedagem recomendada para o frontend

Usar a Netlify exclusivamente para a publicação versionada do domínio oficial, CDN, HTTPS e redirecionamentos. Revisões anteriores à produção são locais; URLs temporárias públicas são proibidas.

O banco, autenticação, API e segredos não devem ser simulados no frontend. Eles serão publicados na infraestrutura definida para a implementação funcional.

## Sequência segura de lançamento

1. Preparar configurações de build e rotas.
2. Compilar e testar localmente.
3. Criar o projeto de hospedagem.
4. Revisar localmente computador, celular, tablet quando aplicável, formulários, rotas e acessibilidade.
5. Pedir autorização explícita ao proprietário para aplicar a modificação em produção.
6. Executar `npm run release:check` e publicar somente após a autorização.
7. Validar `www`, domínio sem `www`, HTTPS, redirecionamentos e rotas internas no domínio oficial, sem iniciar outro deploy.
12. Somente então divulgar o endereço.

## DNS provável mantendo Registro.br

Os valores finais devem ser copiados do painel da hospedagem. Para uma implantação Netlify padrão, normalmente será necessário um registro A do domínio raiz para `75.2.60.5` e um CNAME `www` para o endereço do projeto terminado em `.netlify.app`.

Não criar registros antes de o projeto existir na hospedagem. Remover registros A, AAAA, CNAME ou CAA conflitantes somente após conferência; uma alteração incorreta pode impedir o site ou o certificado.

## Responsabilidades

### Automatizável pelo Codex

- preparar configuração de hospedagem e redirecionamentos;
- atualizar o projeto para produção;
- gerar e testar o build;
- preparar e validar uma prévia exclusivamente local e publicar produção após autorização;
- verificar autenticação da ferramenta de hospedagem;
- orientar ou acompanhar a vinculação do domínio;
- consultar propagação DNS e HTTPS;
- testar rotas, responsividade e disponibilidade;
- documentar os valores exatos que deverão ser inseridos no Registro.br.

### Requer ação ou autorização do proprietário

- criar ou autorizar acesso à conta da plataforma de hospedagem;
- concluir login pelo navegador quando solicitado;
- escolher plano e aceitar eventual cobrança;
- entrar no Registro.br com a conta responsável;
- autorizar a alteração definitiva do DNS;
- aprovar a versão que será exposta publicamente;
- fornecer e validar textos jurídicos e dados empresariais.

Credenciais, códigos de autenticação e chaves privadas nunca devem ser enviados na conversa ou gravados no repositório.

## Checklist pós-publicação

- HTTPS válido e renovação automática.
- Redirecionamento único entre raiz e `www`.
- Rotas internas funcionam ao atualizar a página.
- Página 404 com identidade da Adoce.
- Política de privacidade e termos publicados.
- Métricas e logs sem dados pessoais indevidos.
- Backup e retorno de versão testados.
- Monitoramento de disponibilidade e vencimento do domínio.


### 08/10/2026 — fonte única determinada pelo proprietário

Todo desenvolvimento, teste, revisão e publicação deste site deve usar exclusivamente `D:\AdoceOnLine`. É proibido criar outra cópia completa, pasta de release, réplica ou worktree para atualizar o produto. Histórico deve ser preservado no Git da pasta principal. A pasta `android` é um componente do mesmo produto, não outra fonte de desenvolvimento.

Os comandos de desenvolvimento, testes, verificação, compilação e publicação verificam o caminho canônico antes de continuar. Cópias externas são bloqueadas; cópias completas internas também bloqueiam a validação, salvo quando todos os seus comandos estão desativados e sua configuração de publicação foi retirada, aguardando remoção física. Essa desativação é uma medida provisória para o bloqueio da exclusão pela política de execução automática, não uma autorização para manter fontes paralelas.
