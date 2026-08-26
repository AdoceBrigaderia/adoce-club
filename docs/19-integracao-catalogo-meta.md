---
title: Integração do catálogo com a Meta e o WhatsApp Business
description: Arquitetura, segurança, operação, homologação e rollback da sincronização do catálogo comercial.
status: Implementado, dependente de configuração e homologação externas
---

# Integração do catálogo com a Meta e o WhatsApp Business

## Diagnóstico da arquitetura real

O repositório atual usa React/Vite no navegador, Supabase PostgreSQL com RLS como fonte de dados e Netlify Functions em TypeScript para operações privilegiadas. Não existe serviço Go, `go.mod` ou estrutura `internal/` neste código. Criar um backend Go somente para esta integração formaria uma aplicação paralela e aumentaria o risco da reestruturação. Por isso, a primeira versão foi encaixada na camada de servidor já existente.

O catálogo de encomendas está em `public.commercial_products`; opções ficam em `public.commercial_product_options`; pré-reservas ficam em `public.service_requests`. As imagens usam o bucket público `adoce-media`, com escrita limitada a gerentes e arquivos normalizados em WebP com até 1600 px. O Festival de Fatias permanece no Adoce Hoje, com `flavors`, `flavor_images` e `flavor_availability`, inclusive quantidades disponíveis e reservadas.

## Escopo seguro da primeira etapa

A sincronização atende `commercial_products`, pois essa tabela já possui nome, descrição, preço, imagem, categoria, publicação e ativação. O Festival de Fatias não é misturado automaticamente nesta etapa: seus sabores e estoque diário vivem em outra estrutura e ainda precisam de um preço vendável por item e identificador Meta permanente. Uma próxima etapa poderá adicionar um adaptador próprio sem alterar o fluxo transacional de reservas.

O portal é a fonte oficial. O salvamento local acontece primeiro; falhas da Meta deixam a sincronização pendente ou com erro e nunca desfazem o produto local.

## Dados e estados

`commercial_products` recebeu campos aditivos para identificador permanente, ativação no WhatsApp, estado, tentativas, hash do payload, lote assíncrono e último erro. O `meta_retailer_id` nasce do `slug` e não pode ser alterado depois da criação.

Estados:

- `disabled`: produto nunca enviado ou removido da exibição após confirmação remota;
- `pending`: existe alteração local a enviar;
- `syncing`: requisição em andamento;
- `submitted`: lote aceito pela Meta, ainda aguardando resultado;
- `synced`: lote consultado e concluído sem erro;
- `error`: validação local ou Meta rejeitou a operação.

O histórico `meta_catalog_sync_history` possui RLS, leitura somente gerencial e escrita pela camada privilegiada. Tokens não são persistidos nem devolvidos.

## Mapeamento

| Portal | Meta |
| --- | --- |
| `meta_retailer_id` | `id` / `product_retailer_id` |
| `name` | `title` |
| `description` ou chamada curta | `description` |
| `base_price` | `price` em `0.00 BRL` |
| `image_url` | `image_link` HTTPS público |
| URL pública do produto | `link` |
| segmento | `product_type` |
| ativo, publicado e marcado | `availability = in stock` |
| desativado, não publicado ou removido do WhatsApp | atualização parcial para `out of stock` |

Produtos novos sem preço, imagem pública HTTPS ou URL pública são rejeitados localmente com mensagem clara. Um item que já foi enviado não é excluído quando fica indisponível; sua disponibilidade é atualizada.

## Endpoints administrativos

- `POST /api/admin/integrations/meta/catalog/sync`
- `POST /api/admin/integrations/meta/catalog/products/{id}/sync`
- `POST /api/admin/integrations/meta/catalog/retry-errors`
- `GET /api/admin/integrations/meta/catalog/status`
- `GET /api/admin/integrations/meta/catalog/history`
- `GET /api/admin/integrations/meta/catalog/products/{id}/status`

Todos exigem sessão válida e papel `owner` ou `manager`. A função diária `meta-catalog-reconcile` usa Netlify Scheduled Functions e não possui URL pública. Ela consulta lotes enviados, processa pendências e repete somente falhas temporárias, no máximo cinco ciclos automáticos.

## Variáveis de ambiente

Somente no servidor:

```env
META_ACCESS_TOKEN=
META_BUSINESS_ID=
META_CATALOG_ID=
META_WABA_ID=
META_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=24.0
META_CATALOG_PRODUCT_BASE_URL=https://www.adocebrigaderia.com.br
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_APP_SECRET=
```

Nenhuma dessas variáveis pode usar o prefixo `VITE_`. O telefone público já existente não é uma credencial.

## Configuração na Meta

1. Criar ou selecionar o portfólio empresarial, aplicativo Meta, catálogo de comércio e WABA.
2. Criar um usuário do sistema e conceder somente os ativos necessários: catálogo e WABA.
3. Emitir token do usuário do sistema com as permissões necessárias ao cenário. Para gerenciamento do WhatsApp, a documentação oficial indica `whatsapp_business_management`; para mensagens futuras, `whatsapp_business_messaging`; consultas ao portfólio podem exigir `business_management`. Confirmar no App Review as permissões efetivamente usadas pelo catálogo.
4. Preencher as variáveis no contexto de homologação da Netlify, sem copiá-las para o navegador ou para arquivos versionados.
5. No WhatsApp Manager, selecionar a WABA, abrir **Catálogo**, escolher o catálogo criado e confirmar **Conectar catálogo**.
6. Confirmar `is_catalog_visible` e, somente se aprovado comercialmente, `is_cart_enabled` nas configurações de comércio do número.

Referências oficiais consultadas em julho de 2026:

- [WhatsApp Business Platform oficial no Postman](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [WhatsApp Cloud API — catálogo e mensagens de produto](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Commerce Settings do WhatsApp](https://www.postman.com/meta/whatsapp-business-platform/folder/4ylu23z/commerce-settings)
- [Facebook Marketing API oficial no Postman](https://www.postman.com/meta/facebook-marketing-api/overview)

## Homologação

1. Aplicar a migration no projeto de homologação.
2. Configurar token, catálogo, WABA, número e versão somente em homologação.
3. Criar um produto de teste real com preço, foto pública e “Exibir no WhatsApp”.
4. Salvar e confirmar que o status passa de `pending` para `submitted`.
5. Executar a reconciliação manual da função ou aguardar a consulta do lote e confirmar `synced`.
6. Verificar o item no Commerce Manager, inclusive preço, imagem, link e disponibilidade.
7. Alterar preço e imagem; confirmar novo hash e atualização sem duplicidade.
8. Desativar o produto; confirmar `out of stock`, sem exclusão permanente.
9. Simular token inválido, 429 e 500 com mocks; nenhum teste automatizado comum chama a Meta.
10. Vincular o catálogo à WABA e conferir visibilidade usando um número real autorizado. Números de teste podem não oferecer todo o fluxo de catálogo.

## Rollback

O rollback de interface e funções consiste em remover os componentes/endpoints novos e manter os campos no banco, que são inofensivos e preservam auditoria. Não remover a tabela de histórico em produção sem exportação e autorização. Para interromper imediatamente qualquer envio, remova `META_ACCESS_TOKEN` do contexto da Netlify ou desconecte o catálogo da WABA; o cadastro local continua funcionando.

## Pendências e riscos

- O contrato externo precisa ser homologado com um catálogo real antes de declarar validação em produção.
- O `items_batch` é assíncrono; HTTP 200 significa lote aceito, não produto publicado. Por isso existe o estado `submitted`.
- A rotina diária da Netlify tem limite de execução. O catálogo atual é pequeno e cada produto usa um lote individual; se crescer, será necessário agrupar lotes e/ou usar função em segundo plano.
- A sincronização do Festival de Fatias depende de decisão sobre preço por unidade, identificador permanente e relação entre sabor e disponibilidade diária.
- A vinculação do catálogo à WABA e a aprovação de permissões são configurações externas e não foram executadas.
