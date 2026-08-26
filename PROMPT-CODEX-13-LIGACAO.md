# Prompt 13 para o Codex — ligar o que já subiu
**11/08/2026** · Cole tudo abaixo da linha.

---

## O problema deste prompt

Quatro peças estão no branch, com testes passando, e **nenhuma está ligada**. Verifiquei uma a uma em `adoce-oficial/homologacao-adoce`:

| Arquivo | Quem o importa hoje |
|---|---|
| `identidade-do-clube.ts` | só o próprio teste |
| `pacotes-de-docinhos.ts` | só o próprio teste |
| `ExperienciaAdoce.tsx` | ninguém |
| `CatalogoDeSabores.tsx` | `App.tsx` ✅ *(este está certo)* |

Arquivo com teste verde **parece** pronto e não está. Peça na caixa de ferramentas não conserta nada — e é por isso que o Rubens continua vendo o loop do Clube e conseguindo escolher 15 docinhos.

**Este prompt não pede código novo. Pede ligação.**

---

## 1. O loop do Clube — o mais urgente

O Rubens testou de novo hoje: a home reconhece o membro e mostra `6/14`, e tocar no perfil manda para cadastro.

`identidade-do-clube.ts` tem uma função só, `decidirPorta()`, com a regra:

> **Se o site sabe quem é a pessoa, ele não pede cadastro.**

**O que fazer:**

- **Toda** tela que hoje decide sozinha entre "mostrar cartão" e "mandar cadastrar" passa a chamar `decidirPorta()` e obedecer: `ClubExperience`, `AdoceClube`, `AccessApp`, `PasskeyClientGateway`. Nenhuma decide por conta própria.
- Na entrada da aplicação, ler `tokenDoMagicLink(location.hash)`. Havendo token: trocar por sessão e **só então** renderizar. Depois, `location.hash = rotaLimpaDepoisDoLogin` — o token não pode ficar no histórico.
- `#cartao/<token>` abre o cartão via `tokenDoCartaoNaRota`, sem senha.
- **Desligar o cadastro por e-mail.** Ele pede código de seis dígitos e o Supabase envia Magic Link. São dois fluxos incompatíveis, e é metade do loop.

---

## 2. Docinhos de 25 em 25

`pacotes-de-docinhos.ts` substitui a lógica de quantidade e limite de sabores em `ConfigurableProductCatalogPage`.

- `somar` e `subtrair` andam de 25 em 25 — 15, 14 e 10 deixam de existir
- `podeSomar` **desabilita** o botão dos demais sabores quando o limite é atingido, em vez de avisar depois
- `comporPacotes` mostra a composição: 125 = 100 + 25
- um sabor a cada 25 unidades: pacote de 100 aceita até 4

Verifique se `#biscoitos` e `#adoce-na-escola` usam o mesmo componente e herdam a correção.

---

## 3. Festas, Escola e Decoração

`ExperienciaAdoce.tsx` substitui as telas atuais em `#eventos`, `#adoce-na-escola` e `#aluguel-decoracao`.

**O carrossel sai.** O Rubens relatou falhas graves, e no celular ele esconde conteúdo atrás de um gesto que quase ninguém faz. As fotos ficam empilhadas.

`fotos` vem de `commercial_media_items` do segmento, `active = true`, por `sort_order` — **8 fotos para escola, 4 para decoração, 8 para eventos já existem lá.** A primeira é capa.

---

## 4. Arquivos novos deste prompt

Correções que o Rubens pediu depois de ver a vitrine no ar:

```
src/CatalogoDeSabores.tsx        src/catalogo-de-sabores.css
src/catalogo-de-sabores.ts       src/catalogo-de-sabores.test.ts
supabase/migrations/20260810213000_flavor_summaries.sql
```

**Três mudanças, nas palavras dele:**

- *"foto está muito pequenas, não dá pra ver nada"* → a foto passou a ocupar a largura toda do cartão
- *"embaixo do valor é interessante por que é por fatia"* → "a fatia" embaixo do preço
- *"aquelas informações do 'Leva:' pode remover… preferia que criasse mais uma tabela no banco e colocasse um resumo bem legal"* → nasceu `flavor_summaries`, com um resumo escrito para cada um dos 26 sabores

**E a tela ganhou saída.** A primeira versão não tinha nenhuma — o cliente entrava e ficava preso. Agora há barra no topo com "Início" e "O que tem hoje", e três caminhos no fim.

`SaborNaVitrine.resumo` vem de `flavor_summaries.resumo`. A migração cria a tabela, popula os 26 e deixa leitura pública.

**Impressora térmica** — Knup 1025, por Web Bluetooth. Funciona no Chrome do tablet VAIO com Android 13, sem aplicativo:

```
src/lib/impressora-termica.ts    src/impressora-termica.test.ts   (22 testes)
src/lib/conexao-bluetooth.ts
```

⚠️ `src/lib/thermal-printer.ts`, que já está no repositório, espera uma ponte nativa `window.AdocePrinter` que não existe. **Não misture os dois.** Se o caminho do Web Bluetooth funcionar, o antigo pode ser aposentado.

Verificado aqui: `tsc -b` limpo, **626 testes**, `vite build` limpo.

---

## 5. A verificação que vale — de ligação, não de existência

Ao terminar, rode **exatamente** isto e me mande a saída:

```bash
git grep -l "decidirPorta"          -- src
git grep -l "pacotes-de-docinhos"   -- src
git grep -l "ExperienciaAdoce"      -- src
git grep -l "CatalogoDeSabores"     -- src
git grep -l "impressora-termica"    -- src
```

**Cada um tem que listar pelo menos um arquivo de tela ou o `App.tsx`.** Se devolver só o próprio arquivo e o `.test.ts`, **não foi integrado** — e nesse caso não diga que está pronto.

E os dois dados de sempre: **o hash do topo de `adoce-oficial/homologacao-adoce`** e **o id do deploy do Netlify**.

---

## 6. Teste de aceitação, no celular

1. entrar no Clube com um cliente que a home reconhece com "6/14" — **em nenhum caminho** pode aparecer oferta de cadastro
2. abrir `#docinhos` — o mais/menos anda de 25 em 25, e escolhido o limite de sabores os demais ficam **desabilitados**
3. abrir `#eventos` — sem carrossel, fotos empilhadas, mesma linguagem visual do resto
4. abrir `#sabores` — foto grande, "a fatia" embaixo do preço, o resumo novo, e botões para sair da tela

---

## O que NÃO fazer

- Não escrever lógica nova: as quatro peças já existem e estão testadas
- Não afrouxar RLS nem conceder grant novo ao `authenticated`
- Não misturar `thermal-printer.ts` com `impressora-termica.ts`
- Não tocar em produção
- Não dizer que está pronto sem a saída dos cinco `git grep`
