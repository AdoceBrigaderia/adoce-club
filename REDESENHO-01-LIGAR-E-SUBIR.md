# Bloco 1 — ligar o que existe e subir para produção
**Prioridade máxima.** Cole tudo abaixo da linha.

---

## Por que este bloco vem antes de qualquer redesenho

Existe trabalho pronto, testado e parado. Enquanto ele não estiver no ar, todo desenho novo aumenta a fila em vez de aumentar a venda.

Produção está com código de **31 de julho** e **61 de 163 migrações**. O cliente que compra hoje usa um site de duas semanas atrás.

---

## 1. Ligar o que já está no branch e ninguém chama

Verifique um a um com `git grep -l "<nome>" -- src`. Se só aparecer o próprio arquivo e o `.test.ts`, **não está ligado**.

| Arquivo | O que faz | Onde tem que ser chamado |
|---|---|---|
| `identidade-do-clube.ts` | `decidirPorta()` — resolve o loop do Clube | `ClubExperience`, `AdoceClube`, `AccessApp`, `PasskeyClientGateway` |
| `pacotes-de-docinhos.ts` | 25 em 25, e desabilita em vez de avisar | `ConfigurableProductCatalogPage` |
| `ExperienciaAdoce.tsx` | Festas, Escola e Decoração sem carrossel | `#eventos`, `#adoce-na-escola`, `#aluguel-decoracao` |
| `impressora-termica.ts` | Knup 1025 por Web Bluetooth | tela da operação |
| `CompartilheDocura.tsx` | indicação de cliente — **órfã, nunca ligada** | `#indicar`, e link no cartão do Clube |
| `PedidoNaEsteira.tsx` | esteira da bancada — **órfã** | operação |
| `FichaTermica.tsx` | pré-visualização da impressão — **órfã** | antes de imprimir |

**A regra do loop do Clube, que é a mais urgente:**

> Se o site sabe quem é a pessoa, ele não pede cadastro.

Toda tela que hoje decide sozinha entre "mostrar cartão" e "mandar cadastrar" passa a chamar `decidirPorta()` e obedecer. Nenhuma decide por conta própria.

**E desligue o cadastro por e-mail.** Ele pede código de seis dígitos enquanto o Supabase envia magic link — são dois fluxos incompatíveis, e é metade do loop.

---

## 2. Apagar o que não devia estar no ar

Seis rotas de demonstração abrem em produção para qualquer pessoa que digite o endereço:

```
#prototipo  #membro-demo  #operacao-demo
#operacao-v2  #restauracao-demo  #home-antiga
```

Remova as rotas e os componentes que só elas usam.

---

## 3. Consertar o roteamento

O `netlify.toml` manda tudo que não é a raiz para o 404, e **não existe volta para o `index.html`**. Qualquer endereço sem `#` dá erro.

Acrescente o fallback antes da regra `/*`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Mantenha `/documentacao` e `/404` como estão.

---

## 4. Subir para produção

### As três migrações que só existem em produção

```sql
select version, name, statements
  from supabase_migrations.schema_migrations
 where name in ('fin_personal_planning_schema',
                'fin_recurrence_engine_v2',
                'app_saas_homologacao_multi_conta')
 order by version;
```

Salve como arquivo em `supabase/migrations/` **com o `version` que já está gravado**. Carimbo novo faz rodar de novo.

⚠️ As duas `fin_*` são o planejamento financeiro pessoal do Rubens e da Beth, isoladas por RLS, com dados reais. **Não apague, não mova, não "limpe".**

### O lote das 102

Use o CLI, que preserva o carimbo — a interface de banco atribui carimbo novo e por isso recusa:

```bash
supabase link --project-ref uefwywizqhfvvijaopcn
supabase db push --dry-run
supabase db push
```

Se faltar credencial, pare e diga exatamente qual — não force por outro caminho.

### ⚠️ O cuidado que não pode faltar

Existe em produção um gatilho aplicado direto no banco, `private.sincronizar_reserva_de_fatias()`, com dois `triggers`: `sincroniza_reserva_itens` e `sincroniza_reserva_pedidos`. **É ele que faz a reserva baixar fatia do estoque.** Sem ele, o site vende e o estoque não anda — foi assim que a Adoce perdeu a Juliana em 07/08.

1. antes de aplicar: `git grep -l "submit_instant_order" -- supabase/migrations`
2. guarde o `pg_get_functiondef` do gatilho e das versões atuais
3. se o lote recriar `submit_instant_order`, **recrie o gatilho depois**
4. confirme no fim que os dois estão com `tgenabled = 'O'`

---

## 5. Conferir, nesta ordem

1. o site abre e mostra o que tem hoje
2. **uma reserva de teste baixa a fatia do estoque** ← se falhar, é o gatilho
3. o aviso de pedido chega no Telegram e no celular
4. quem já tem carimbos entra no Clube **sem** ver oferta de cadastro
5. `#sabores` abre com foto grande e tem saída
6. `#docinhos` anda de 25 em 25 e desabilita ao chegar no limite
7. digitar `adocebrigaderia.com.br/qualquercoisa` abre o site, não erro

---

## Me devolva

```bash
git grep -l "decidirPorta"        -- src
git grep -l "pacotes-de-docinhos" -- src
git grep -l "ExperienciaAdoce"    -- src
git grep -l "CompartilheDocura"   -- src
git grep -l "impressora-termica"  -- src
```

Cada um tem que listar pelo menos uma tela ou o `App.tsx`.

E: hash e id de deploy de homologação **e de produção**; quantas migrações entraram e quantas restaram; se `submit_instant_order` foi recriada e se o gatilho está de pé.

---

## O que NÃO fazer

- Não mexer nas tabelas `fin_*`
- Não inventar `version` novo para as três
- Não aplicar as 102 sem conferir o gatilho
- Não parar para pedir aprovação: se travar, pule e deixe por último
- Não dizer que está pronto sem a saída dos cinco `git grep`
