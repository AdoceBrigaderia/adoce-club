# Migração de domínio — plano de implementação

**Objetivo:** executar a migração aprovada pelo proprietário para www.cantinhodaadoce.com.br com 301 dos endereços anteriores.
**Especificação:** docs/06-publicacao-e-dominio.md, seção de 02/11/2026.
**Execução:** diretamente em D:\AdoceOnLine, sem cópias, worktrees ou ambientes públicos de teste.

- [x] Confirmar fonte única, documentação, estado Git e configuração atual.
- [x] Testar falhas das novas origens e da compatibilidade de callbacks assinados.
- [x] Atualizar origem oficial, links, SEO e regras de redirecionamento; preservar APIs, e-mails e Pix.
- [x] Configurar DNS Registro.br e certificado cobrindo novos e antigos hosts.
- [x] Ajustar URLs de autenticação sem substituir outras configurações remotas.
- [x] Executar release:check: 173 arquivos, 985 testes aprovados e 1 ignorado; tipos, build, SEO e preservação da Operação aprovados. Conferidas Home em computador, navegação e login do Clube em celular 390×844 e entrada da Operação em tablet 820×1180, sem avisos/erros capturados no console. Login autenticado não exercitado nesta migração.
- [x] Registrar commit e publicar o pacote aprovado uma única vez.
- [x] Definir novo principal no mesmo site Netlify; conferir domínio oficial e 301 com caminhos/parâmetros, APIs protegidas e certificado.
- [x] Registrar evidências e limitações reais.

Pontos de revisão: callbacks anteriores ainda em trânsito; navegação para rotas internas; query strings de links existentes; rejeição de origens externas; necessidade de nova sessão no novo domínio.

## Estado para continuidade — 02/11/2026, aproximadamente 01h44 (São Paulo)

- Site ID Netlify: `bb0c96cd-5af2-4270-a9a8-b63b9637b1f4`; nome `adocebrigaderia`.
- Principal ainda `www.adocebrigaderia.com.br`; aliases preservados/adicionados: `adocebrigaderia.com.br`, `cantinhodaadoce.com.br`, `www.cantinhodaadoce.com.br`.
- Nenhum deploy desta migração foi feito. Produção anterior permanece ativa.
- Registro.br autenticado no navegador, domínio aberto. Modo avançado ativado aproximadamente 01h34. A zona vazia exibe “Domínio em transição. Por favor, aguarde alguns minutos e tente novamente”, sem campos de edição. Contador da delegação externa apontava aproximadamente 03h40; a documentação oficial informa até 3 horas para alteração de modo. Não trocar nameservers nem contornar o bloqueio.
- Após liberação, adicionar A com nome vazio e valor `75.2.60.5`; CNAME nome `www` e destino `adocebrigaderia.netlify.app`. Salvar e conferir DNS autoritativo/público.
- Supabase projeto `uefwywizqhfvvijaopcn`: adicionado SOMENTE `https://www.cantinhodaadoce.com.br/**` à lista de Redirect URLs. Site URL ainda é o endereço antigo, propositalmente, até novo DNS/HTTPS estar pronto. Nenhuma outra configuração foi substituída. Passkeys estão desativadas remotamente; não habilitar nesta tarefa.
- Conferir certificado SAN com `showSiteTLSCertificate` e solicitar `provisionSiteTLSCertificate` somente após DNS pronto. Manter antigos hosts no certificado.
- Antes de ativar 301, confirmar novo HTTPS. Rodar release:check, publicar pacote aprovado e definir `custom_domain=www.cantinhodaadoce.com.br`, preservando aliases antigos. Atualizar Site URL Supabase.
- Publicação já autorizada pelo “sim” do proprietário neste chat, incluindo DNS e redirecionamentos; não pedir a mesma autorização novamente.
- Existe fluxo oficial de publicação sem consultar segredos remotos: `node scripts/deploy-production-without-runtime-secrets.mjs --publish` (exige commit limpo e executa release:check). A publicação manual pode ser substituída por próximo push na branch de produção do repositório conectado; conferir configuração antes de publicar.
- Checagem final: quatro hosts HTTPS (novo principal, nova raiz e dois antigos), 301 com `/clube/entrar?origem=dominio-antigo`, Home, Clube e Operação, sitemap/canonical novo, APIs com método inválido retornando erro protegido sem 301; callback assinado validado automaticamente para ambos domínios.
- Identidades e e-mails em `@membro.adocebrigaderia.com.br`, remetente `@auth.adocebrigaderia.com.br` e chave Pix foram preservados intencionalmente.

### Atualização após liberação do editor

O editor foi liberado durante esta sessão. Em aproximadamente 01h43 foram gravados os dois registros A/CNAME acima. O estado de bloqueio descrito anteriormente é histórico; agora aguarda-se publicação/propagação DNS e emissão do certificado. Pacote validado offline: 457 arquivos, 43 funções e 2 agendamentos, sem acesso à rede nem deploy.

### Pendência externa na conferência seguinte

Os registros persistidos foram conferidos após reabrir o editor do Registro.br: A `cantinhodaadoce.com.br → 75.2.60.5` e CNAME `www.cantinhodaadoce.com.br → adocebrigaderia.netlify.app`. Entretanto, consultas diretas aos dois servidores autoritativos e consultas públicas Cloudflare/Google ainda não recebem esses registros (SOA serial `2026306190`, A vazio e www NXDOMAIN). Uma solicitação de certificado via API Netlify retornou HTTP 422; certificado existente continua emitido somente para os dois hosts antigos. Não repetir publicação nem ativar redirects enquanto novo DNS/HTTPS não estiver pronto.

O deploy publicado permanece `6ae80e2b215b6916fa722c40` (02/11/2026 04:15:12 UTC); não houve publicação durante esta migração. Site URL remoto do Supabase permanece antigo. Próximo passo: aguardar DNS, emitir/conferir certificado novo+antigo, publicar commit validado e efetivar novo principal e Site URL. Autorização original continua válida. A documentação oficial do Registro.br sobre a espera é https://registro.br/tecnologia/caracteristicas-tecnicas/.

## Conclusão em 02/11/2026 — produção

DNS disponível na retomada. O erro HTTP 422 na API de certificado foi esclarecido: `POST /ssl` é inadequado para renovar certificado existente sem enviar um certificado próprio. A operação correta para o certificado gerenciado é `POST /ssl/renew` (documentação https://open-api.netlify.com/); executada com sucesso. O certificado agora cobre os quatro hosts, com validade até 31/01/2027.

Deploy único `6ae85fdf7753c5556984ea9e`, estado ready, publicado em `2026-11-02T10:03:57.846Z` (07h03 de São Paulo), a partir da fonte principal limpa. `release:check` repetido imediatamente antes da publicação: 985 aprovados, 1 ignorado, tipos/build e preservação da Operação aprovados. Nenhum segredo remoto consultado no fluxo de publicação.

Principal Netlify e Site URL Supabase alterados para `https://www.cantinhodaadoce.com.br`. Aliases mantidos: nova raiz e dois hosts antigos. 16 verificações de produção aprovadas, incluindo seis cadeias de redirect com caminho/query, cinco páginas/arquivos, quatro endpoints de API por método inválido e correspondência do bundle publicado ao local. Evidência local em `.netlify/domain-migration-verification.json`.

A documentação final foi atualizada após a conferência, sem gerar outro deploy. Não houve push Git nesta migração: a branch local já continha commits anteriores ainda não enviados; eles foram preservados. Próximas publicações devem preservar a configuração atual de domínio.

Conferência visual final: Home e Clube no domínio novo, alternância cadastro/entrada no celular, painel Hoje autenticado da Operação em tablet 820×1180. Sem erros/avisos capturados no console. Nenhum dado operacional alterado. O painel indicava tablet/impressora offline, não testados fisicamente. Viewport restaurado e página pública nova deixada aberta.
