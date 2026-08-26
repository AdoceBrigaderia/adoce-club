# Inventário de telas — o que fica, o que morre
**08/08/2026** · Levantado direto do `App.tsx` publicado em homologação.

O site tem **93 componentes de tela e 90 arquivos de estilo**. É por isso que ele parece ter três layouts: tem mais que três.

Regra da migração, decidida pelo Rubens: **cada tela nova que entra aposenta a antiga no mesmo passo.** Nada de conviver.

---

## Bloco 1 — Morrem inteiras (nada substitui)

Páginas feitas para um momento pontual que ninguém removeu depois.

| Rota | Componente | Por quê |
|---|---|---|
| `#campanha-story` | `SocialCampaign` | Peça de campanha antiga |
| `#campanha-feed` | `SocialCampaign` | Idem |
| `#lancamento-story` | `LaunchCampaign` | Lançamento já passou |
| `#lancamento-facebook` | `LaunchCampaign` | Idem |
| `#lancamento-carrossel-*` | `LaunchCampaign` | Idem |
| `#lancamento-feed` | `LaunchCampaign` | Idem |

Também saem: `HomologationOperationPreview`, `HomologationClientAccountPreview`, `HomologationVisualNavigator`, `HomologationValidationBanner` — andaimes de validação que aparecem por cima do site.

**Ganho:** 6 rotas e ~10 arquivos a menos, sem perder nada que o cliente use.

⚠️ Se essas peças ainda servem para gerar imagem de post, o certo é virarem um gerador na operação, não rota pública.

---

## Bloco 2 — Rotas duplicadas viram uma

| Hoje | Vira | Observação |
|---|---|---|
| `#pede-junto` e `#compra-em-grupo` | `#pede-junto` | A segunda redireciona |
| `#clube`, `#minha-conta`, `#acesso-direto`, `#cartao/` | `#clube` | Quatro portas para a mesma sala |
| `#entrar` | `#entrar` | Fica, mas passa a ser a tela nova quando o WhatsApp funcionar |

---

## Bloco 3 — Telas por produto viram uma

Hoje existe uma tela por segmento, de safras diferentes:

| Rota | Componente |
|---|---|
| `#encomendas` | `CakeOrderExperience` |
| `#docinhos` | `ConfigurableProductCatalogPage` |
| `#biscoitos` | `ConfigurableProductCatalogPage` |
| `#adoce-na-escola` | `ConfigurableProductCatalogPage` |
| `#eventos` | `CommercialCatalog` |
| `#aluguel-decoracao` | `CommercialCatalog` |

**Três componentes diferentes para a mesma tarefa: pedir alguma coisa.**

Vira `#encomendas`, com o segmento como filtro dentro da tela. Festas, escola e decoração entram como opção discreta — que é o que o Rubens pediu desde o início, já que essas linhas estão sendo encerradas.

**Ganho:** 5 rotas e 3 componentes a menos.

---

## Bloco 4 — Telas do cliente que já existem prontas e não subiram

| Rota | Hoje | Passa a ser |
|---|---|---|
| home | `MarketingLanding` | **`AdoceHome`** — antiga vai para `#home-antiga` e morre depois |
| `#clube` | `ClubExperience` | **`AdoceClube`** |
| `#entrar` | `AccessApp` | **`AdoceEntrar`** — só quando o WhatsApp funcionar |
| `#adoce-hoje` | `AdoceHoje` | Redesenhar (é a tela de venda) |

Estas três já estão escritas, testadas e paradas em `D:\Clube Adoce`.

---

## Bloco 5 — Operação: 40 telas viram um painel com gavetas

Não dá para apagar de uma vez, porque a operação roda hoje em cima delas. O caminho:

1. **`PainelDoDia` vira a porta de entrada** — já está no branch
2. Cada função vira uma gaveta a partir dele
3. Telas sem nenhum caminho até elas são apagadas

**Candidatas óbvias a morrer:** `OperationDashboard` (o painel do dia substitui), `OperationArchive`, os pares `*Bff` e não-`Bff` do mesmo assunto (`OperationBusinessStructure` e `OperationBusinessStructureBff`, `OperationDynamicImageLibrary` e `...Bff`, `OperationGalleryImageLibrary` e `...Bff`, `OperationVisualSettings` e `OperationSiteVisualSettingsBff`, `OperationDynamicImageAssetHistory` e `...Bff`, `OperationGalleryMediaHistory` e `...Bff`).

São **seis pares duplicados** — a versão antiga e a nova convivendo. Só isso já são 6 telas e 6 estilos a menos.

---

## Ordem de execução

| Passo | O que | Risco |
|---|---|---|
| **1** | Bloco 1 — apagar campanhas e andaimes | Nenhum |
| **2** | Bloco 4 — subir as três telas prontas e aposentar as antigas | Baixo |
| **3** | Bloco 5, parte 1 — apagar os seis pares duplicados da operação | Baixo |
| **4** | Bloco 2 — unificar rotas duplicadas | Baixo |
| **5** | Redesenhar `#adoce-hoje` | Médio — é a tela de venda |
| **6** | Bloco 3 — unificar as telas de produto | Médio |
| **7** | Bloco 5, parte 2 — operação em gavetas | Alto, e por último |

Do passo 1 ao 4, o site já fica com **uma linguagem só** nas telas que o cliente vê.

---

## Contagem esperada

| | Hoje | Depois |
|---|---|---|
| Rotas públicas | 22 | ~10 |
| Componentes de tela | 93 | ~55 |
| Arquivos de estilo | 90 | ~40 |
