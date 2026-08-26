# Prompt 7 para o Codex — limpeza e unificação visual
**08/08/2026** · Cole tudo abaixo da linha.

---

O Rubens abriu a homologação e disse: *"o site está com pelo menos 3 layouts diferentes"*. Ele tem razão — e são mais que três.

O site tem **93 componentes de tela e 90 arquivos de estilo**. Cada redesenho acrescentou; nenhum removeu.

**Regra desta migração, decidida por ele:** cada tela nova que entra **aposenta a antiga no mesmo passo**. Nada de conviver. Foi a convivência que criou o híbrido de hoje.

O levantamento completo está em `INVENTARIO-DE-TELAS.md`. Execute os passos abaixo **na ordem**, publicando e verificando entre eles. Tudo em homologação; produção não se toca.

---

## Passo 1 — Apagar o que não substitui nada (risco zero)

**1.1 Rotas de campanha e lançamento.** Peças de um lançamento que já passou, ainda públicas.

Remover de `App.tsx` e apagar os arquivos:
```
#campanha-story        #campanha-feed          → SocialCampaign
#lancamento-story      #lancamento-facebook
#lancamento-carrossel-*  #lancamento-feed      → LaunchCampaign
```
Arquivos: `src/SocialCampaign.tsx`, `src/LaunchCampaign.tsx`, `src/launch-campaign.css` e os CSS correspondentes.

⚠️ Antes de apagar, confirme se algum script de geração de imagem (`scripts/generate-launch-page-v3.mjs`, `launch:build`, `launch:verify` no `package.json`) depende deles. Se depender, remova o script junto — ele também é de um lançamento encerrado.

**1.2 Andaimes de validação** que aparecem por cima do site:
```
HomologationOperationPreview      HomologationClientAccountPreview
HomologationVisualNavigator       HomologationValidationBanner
```
Estes interceptam rotas em `App.tsx` **antes** das telas reais. Removê-los é parte do motivo de o site parecer inconsistente.

**Verificar:** site abre, `#operacao` e `#clube` chegam nas telas de verdade, nenhum import órfão.

---

## Passo 2 — Subir as três telas do cliente e aposentar as antigas

**Elas nunca entraram no branch.** Confirmei por `git cat-file` em `adoce-oficial/homologacao-adoce`: `AdoceHome.tsx`, `AdoceClube.tsx` e `AdoceEntrar.tsx` não existem lá, e `App.tsx` ainda renderiza `MarketingLanding` como home. O PR #22 foi mesclado sem elas.

Trazer de `D:\Clube Adoce`:
```
src/AdoceHome.tsx      src/adoce-home.css
src/AdoceClube.tsx     src/adoce-clube.css
src/AdoceEntrar.tsx    src/adoce-entrar.css
src/FichaTermica.tsx   src/ficha-termica.css      src/ficha-termica.test.ts
src/capacidade-de-encomenda.ts  src/capacidade-de-encomenda.test.ts
src/AgendaDeEncomendas.tsx      src/agenda-de-encomendas.css
src/PedeJuntoPrazo.tsx          src/pede-junto-prazo.css
src/PedidoNaEsteira.tsx         src/pedido-na-esteira.css
public/wallet/progress/v1/progress-00..14.png
```

Em `App.tsx`:
- home padrão passa a ser **`AdoceHome`**; `MarketingLanding` vai para `#home-antiga`
- `#clube` passa a ser **`AdoceClube`**, aposentando `ClubExperience`
- **`#entrar` continua no `AccessApp`** — `AdoceEntrar` fica escondida em `#entrar-novo`, porque o envio de código por WhatsApp ainda não funciona

`AdoceClube.tsx` não tem botão de carteira nem de compartilhar: foram removidos de propósito, apontavam para telas inexistentes. **Não os reponha.**

**Verifique a codificação UTF-8 de cada arquivo antes de commitar.** Já quebrou quatro vezes. Acrescente `.gitattributes` fixando UTF-8 e uma verificação que quebre o build se um arquivo chegar torto — sem isso, quebra de novo.

---

## Passo 3 — Matar os seis pares duplicados da operação

Cada um destes existe em duas versões, a antiga e a `Bff`, convivendo:

```
OperationBusinessStructure        ↔  OperationBusinessStructureBff
OperationDynamicImageLibrary      ↔  OperationDynamicImageLibraryBff
OperationGalleryImageLibrary      ↔  OperationGalleryImageLibraryBff
OperationVisualSettings           ↔  OperationSiteVisualSettingsBff
OperationDynamicImageAssetHistory ↔  OperationDynamicImageAssetHistoryBff
OperationGalleryMediaHistory      ↔  OperationGalleryMediaHistoryBff
```

Fica a versão **em uso**. Confirme qual é antes de apagar — não presuma que é a `Bff`. Apague a outra com o CSS dela.

**Ganho:** 6 telas e 6 estilos a menos.

---

## Passo 4 — Unificar rotas duplicadas

| Hoje | Fica | O que fazer |
|---|---|---|
| `#pede-junto` e `#compra-em-grupo` | `#pede-junto` | a segunda redireciona |
| `#clube`, `#minha-conta`, `#acesso-direto`, `#cartao/` | `#clube` | as outras redirecionam |

Redirecionar, não apagar: pode haver link antigo circulando no WhatsApp de cliente.

---

## Passo 5 — Faxina do Storage

Detalhe em `LIMPEZA-STORAGE.md`; a lista está em `LIMPEZA-STORAGE-ORFAOS.txt`.

**5.1 Backup primeiro, sem exceção.** Storage não tem backup automático como o banco.
```
npx supabase storage cp -r ss:///adoce-media ./backup-media --experimental
```
Confirme que os **446 arquivos** chegaram antes de apagar qualquer coisa. Informe o caminho e o tamanho do backup.

**5.2 Apagar os 71 órfãos** listados no `.txt` — 68 MB, nenhuma referência no banco. Conferido contra `commercial_media_items`, `commercial_products`, `commercial_segment_media`, `site_visual_assets`, `flavor_images`, `flavors`, `promotions`.

**Faça em produção e em homologação**, verificando a contagem antes e depois.

**5.3 Impedir que volte a crescer** — vale mais que a faxina. O editor guarda o arquivo bruto de cada foto: 215 originais ocupam **436 MB**, contra 44 MB das imagens que o site usa.

- comprimir o original antes de guardar (um PNG de 3,5 MB vira WebP de ~400 KB com qualidade de sobra para reedição)
- apagar o original antigo quando a imagem é substituída — foi assim que nasceram os 71 órfãos

**Não apague os 374 MB de originais ainda referenciados.** O Rubens ainda vai decidir entre apagar e converter.

---

## Verificar ao final

```
npx tsc -b
npx vitest run
npx vite build
```

E na homologação publicada: home é a `AdoceHome`, `#clube` são as duas cartelas, nenhuma rota de campanha responde, nenhum andaime aparece por cima, acentuação correta em todas as telas.

---

## O que NÃO fazer

- **Não toque em produção**, exceto a limpeza dos 71 órfãos do Storage no passo 5.2, após o backup
- Não apague os 374 MB de originais referenciados
- Não reponha os botões removidos do `AdoceClube`
- Não afrouxe RLS nem conceda grant novo ao `authenticated`
- Não crie conta, não aceite termos, não gere nem rotacione credencial

---

## Passo 6 — Desligar o montador de torta

**Decisão do Rubens, já tomada:** o montador (`#encomendas` → `CakeOrderExperience`, "Monte cada camada antes de pedir") **sai do ar**.

O motivo é de negócio, não de código: **não existe custo nem preço de venda por camada, recheio ou adicional.** A tela mostra "estimativa" para o cliente sobre números que ninguém apurou. Vender assim é arriscar fechar pedido no prejuízo — e a apuração de custos de 28/07 mostrou que a margem real da Adoce é 31%, não os 72% que o custo direto sugeria.

Desligue a rota e esconda a entrada. **Não apague os arquivos ainda** — quando os custos por componente existirem, ela volta. Deixe acessível em `#montador-antigo` para conferência.

Substitua a entrada de `#encomendas` por um caminho simples: escolher o tamanho, dizer o que quer em texto livre, e a Adoce responde com o orçamento. É o que já funciona hoje pelo WhatsApp.

---

## Passo 7 — Corrigir os docinhos configuráveis

Duas falhas na tela de docinhos (`#docinhos` → `ConfigurableProductCatalogPage`), relatadas pelo Rubens em 08/08 com print:

**7.1 O limite avisa em vez de impedir.** A tela diz *"Escolha no máximo 1 sabor(es)"* **depois** que o cliente já escolheu vários. Quando o limite for atingido, os demais sabores devem ficar **desabilitados**, não disponíveis com aviso posterior. Erro que só aparece depois do esforço é erro que a gente empurrou para o cliente.

**7.2 A quantidade deve andar de 25 em 25.** Hoje o mais/menos anda de 1 em 1, e o print mostra 15, 14 e 10 — combinações que a Adoce **não vende**. Docinho é vendido em múltiplos de 25.

O passo do controle passa a ser 25, o mínimo é 25, e a soma dos sabores tem de bater com o pacote escolhido. Se o pacote é de 100 com até 4 sabores, o cliente distribui 25/25/25/25 ou 50/50 — nunca 15.

Verifique se a mesma falha existe em `#biscoitos` e `#adoce-na-escola`, que usam o mesmo componente.
