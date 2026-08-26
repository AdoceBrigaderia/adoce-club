# Release de produção da Adoce — instrução única
**12/08/2026** · Cole tudo abaixo da linha no Codex.

---

# Objetivo

Publicar produção. Hoje ela roda código de **31 de julho** com **61 de 163 migrações**, e o cliente que compra agora usa um site de duas semanas atrás. Todo o resto do trabalho — inclusive as 26 páginas de SEO que você acabou de fazer — só passa a valer depois disto, porque o Google lê o domínio oficial, não a homologação.

Execute na ordem. Se algo travar, **pule e deixe por último**; não fique parado esperando resposta.

---

# 1. Dois diagnósticos, antes de tudo

Rode **em produção** e me devolva os números junto com o resultado final:

```sql
select count(*) from instant_order_items;
select count(*) from daily_menu where menu_date >= current_date;
select count(*) from flavors where active = true;
```

Você relatou "zero registros de estoque e zero cardápios futuros". Preciso saber se isso era homologação ou produção. **Se for produção com zero, a vitrine do cliente está vazia agora** — e isso é mais urgente que o release.

E responda em uma linha: **`https://www.adocebrigaderia.com.br` abre normal hoje?** Quando você escreveu "a rota oficial continua retornando 404", era a home ou só as rotas novas de sabor?

---

# 2. Consertar o roteamento

`netlify.toml` manda tudo que não é a raiz para o 404 e **não tem volta para o `index.html`**. Qualquer endereço sem `#` quebra — inclusive as 26 páginas de sabor que você criou.

Acrescente antes da regra `/*` existente:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Mantenha `/documentacao` e `/404` como estão. Sem isso, o bloco de SEO não funciona em lugar nenhum.

---

# 3. Ligar o que está pronto e parado

Verifique com `git grep -l "<nome>" -- src`. Se aparecer só o próprio arquivo e o `.test.ts`, **não está ligado**.

| Arquivo | O que faz | Onde chamar |
|---|---|---|
| `identidade-do-clube.ts` | `decidirPorta()` — mata o loop do Clube | `ClubExperience`, `AdoceClube`, `AccessApp`, `PasskeyClientGateway` |
| `pacotes-de-docinhos.ts` | 25 em 25; desabilita em vez de avisar depois | `ConfigurableProductCatalogPage` |
| `ExperienciaAdoce.tsx` | Festas, Escola e Decoração **sem carrossel** | `#eventos`, `#adoce-na-escola`, `#aluguel-decoracao` |
| `impressora-termica.ts` | Knup 1025 por Web Bluetooth | tela da operação |
| `CompartilheDocura.tsx` | indicação de cliente — **órfã, nunca ligada** | `#indicar` + link no cartão do Clube |
| `PedidoNaEsteira.tsx` | esteira da bancada — **órfã** | operação |
| `FichaTermica.tsx` | prévia da impressão — **órfã** | antes de imprimir |

**A regra do Clube, que é a mais urgente:**

> Se o site sabe quem é a pessoa, ele não pede cadastro.

Toda tela que hoje decide sozinha entre "mostrar cartão" e "mandar cadastrar" passa a chamar `decidirPorta()` e obedecer. Nenhuma decide por conta própria.

**E desligue o cadastro por e-mail.** Ele pede código de seis dígitos enquanto o Supabase envia magic link. São dois fluxos incompatíveis, e é metade do loop.

---

# 4. Apagar o que não devia estar no ar

Seis rotas de demonstração abrem em produção para qualquer um que digite o endereço:

```
#prototipo  #membro-demo  #operacao-demo
#operacao-v2  #restauracao-demo  #home-antiga
```

Remova as rotas e os componentes que só elas usam.

---

# 5. Banco de produção

## 5.1 As três migrações que só existem lá

```sql
select version, name, statements
  from supabase_migrations.schema_migrations
 where name in ('fin_personal_planning_schema',
                'fin_recurrence_engine_v2',
                'app_saas_homologacao_multi_conta')
 order by version;
```

Salve cada uma como arquivo em `supabase/migrations/` **com o `version` que já está gravado** — carimbo novo faz rodar de novo. Se `statements` vier vazio, reconstrua do estado real (`information_schema.columns`, `pg_policies`, `pg_get_functiondef`) e siga.

⚠️ As duas `fin_*` são o planejamento financeiro pessoal do Rubens e da Beth, isoladas por RLS, com dados reais. **Não apague, não mova, não "limpe".**

## 5.2 O lote pendente

Use o CLI, que preserva o carimbo. A interface de banco atribui carimbo novo — é por isso que ela recusou:

```bash
supabase link --project-ref uefwywizqhfvvijaopcn
supabase db push --dry-run
supabase db push
```

Inclua a migração de `flavors.slug`, que você criou e não aplicou.

Se faltar credencial, **pare e diga exatamente qual** — não force por outro caminho.

## 5.3 ⚠️ O gatilho que não pode morrer

Existe em produção, aplicado direto no banco, `private.sincronizar_reserva_de_fatias()`, com dois triggers: `sincroniza_reserva_itens` em `instant_order_items` e `sincroniza_reserva_pedidos` em `instant_orders`.

**É ele que faz a reserva baixar fatia do estoque.** Sem ele o site vende e o estoque não anda — foi assim que a Adoce perdeu uma cliente em 07/08.

1. antes: `git grep -l "submit_instant_order" -- supabase/migrations`
2. guarde o `pg_get_functiondef` do gatilho e das versões atuais de `submit_instant_order`
3. se o lote recriar `submit_instant_order`, **recrie o gatilho depois**
4. no fim, confirme que os dois estão com `tgenabled = 'O'`

---

# 6. Publicar e conferir

Depois do deploy, teste **no celular**, nesta ordem:

1. `https://www.adocebrigaderia.com.br` abre e mostra o que tem hoje
2. **uma reserva de teste baixa a fatia do estoque** ← se falhar, é o gatilho
3. o aviso de pedido chega no Telegram **e** no celular
4. entrar no Clube com quem já tem carimbos — **em nenhum caminho** pode aparecer oferta de cadastro
5. `#sabores` abre com foto grande, botão de ampliar e saída
6. `#docinhos` anda de 25 em 25 e desabilita os sabores extras no limite
7. `#eventos` sem carrossel, fotos empilhadas
8. digitar `adocebrigaderia.com.br/qualquercoisa` → abre o site, não erro
9. `adocebrigaderia.com.br/sabores/trufado-de-ninho-com-morangos` abre a página do sabor
10. as seis rotas de demonstração não abrem mais

E confirme sem executar JavaScript:

```bash
curl -s https://www.adocebrigaderia.com.br/sabores/trufado-de-ninho-com-morangos | grep -c "Trufado de Ninho"
```

Maior que zero. Se for zero, o Google continua sem ver.

---

# 7. Me devolva, sem omitir nada

```bash
git grep -l "decidirPorta"        -- src
git grep -l "pacotes-de-docinhos" -- src
git grep -l "ExperienciaAdoce"    -- src
git grep -l "CompartilheDocura"   -- src
git grep -l "impressora-termica"  -- src
```

Cada um tem que listar pelo menos uma tela ou o `App.tsx`. Se devolver só o próprio arquivo e o teste, **não foi integrado — e nesse caso diga isso**, como você já fez antes.

Mais:

- os três `count(*)` do item 1, e se eram de produção
- hash e id de deploy de **produção**
- quantas migrações entraram em produção e quantas restaram
- `submit_instant_order` foi recriada? o gatilho está de pé? (`tgenabled`)
- a saída do `curl`
- o que travou e ficou por último

---

# O que NÃO fazer

- Não mexer, mover ou apagar as tabelas `fin_*` — são dados pessoais reais
- Não inventar `version` novo para as três migrações exclusivas
- Não deixar produção sem o gatilho de baixa de estoque
- Não afrouxar RLS nem dar grant novo a `anon` ou `authenticated`
- Não usar carrossel em lugar nenhum
- Não inventar disponibilidade nem foto que não existe — você acertou nisso, continue assim
- Não parar para pedir aprovação: se travar, pule e deixe por último
- Não dizer que está pronto sem a saída dos cinco `git grep`
