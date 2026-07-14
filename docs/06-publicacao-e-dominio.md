---
title: Publicação e domínio
description: Estratégia de hospedagem, DNS, HTTPS e lançamento em adocebrigaderia.com.br.
status: Proposta técnica
---

# Publicação e domínio

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

Usar uma plataforma gerenciada, inicialmente Netlify, para obter implantação por versão, URL temporária de revisão, CDN, HTTPS automático, redirecionamentos e retorno rápido a uma versão anterior.

O banco, autenticação, API e segredos não devem ser simulados no frontend. Eles serão publicados na infraestrutura definida para a implementação funcional.

## Sequência segura de lançamento

1. Preparar configurações de build e rotas.
2. Compilar e testar localmente.
3. Criar o projeto de hospedagem.
4. Publicar uma URL temporária de prévia.
5. Revisar desktop, celular, formulários, rotas e acessibilidade.
6. Publicar a versão de produção ainda no endereço temporário.
7. Adicionar `www.adocebrigaderia.com.br` à plataforma.
8. Obter da plataforma os registros DNS definitivos.
9. No Registro.br, abrir o domínio, acessar a zona DNS e criar os registros solicitados.
10. Aguardar propagação e emissão do certificado HTTPS.
11. Validar `www`, domínio sem `www`, HTTPS, redirecionamentos e rotas internas.
12. Somente então divulgar o endereço.

## DNS provável mantendo Registro.br

Os valores finais devem ser copiados do painel da hospedagem. Para uma implantação Netlify padrão, normalmente será necessário um registro A do domínio raiz para `75.2.60.5` e um CNAME `www` para o endereço do projeto terminado em `.netlify.app`.

Não criar registros antes de o projeto existir na hospedagem. Remover registros A, AAAA, CNAME ou CAA conflitantes somente após conferência; uma alteração incorreta pode impedir o site ou o certificado.

## Responsabilidades

### Automatizável pelo Codex

- preparar configuração de hospedagem e redirecionamentos;
- atualizar o projeto para produção;
- gerar e testar o build;
- criar uma prévia e publicar produção após autorização;
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
