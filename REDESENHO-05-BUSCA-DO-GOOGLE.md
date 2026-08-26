# Bloco 5 — aparecer na busca do Google
**Último de propósito.** Cole tudo abaixo da linha.

---

## Antes de começar, a expectativa honesta

**Isto não vai trazer torta nos próximos dois meses.** Site novo leva de três a seis meses para o Google levar a sério. O Rubens tem 60 dias para sair de 28 para 35 tortas por semana.

Faça este bloco porque em quatro meses ele vale muito — não porque salva o prazo.

**O que pode dar resultado em semanas não está neste arquivo: é o Perfil da Empresa no Google** (o que aparece no Maps em "confeitaria perto de mim"). É gratuito, não depende do site, e para negócio local costuma trazer mais gente que SEO. Isso é tarefa do Rubens, não do Codex.

---

## O problema, em uma frase

Toda navegação é por `#`. Para o Google, `#sabores`, `#clube` e `#encomendas` são **a mesma página** — e nela não há sabor nenhum, porque o conteúdo só aparece depois que o JavaScript roda.

Hoje o `sitemap.xml` declara **uma** URL. Vinte e seis sabores com nome, foto, preço e descrição são invisíveis.

---

## 1. Fallback de rota — pré-requisito

Já pedido no bloco 1. Sem ele, nada aqui funciona:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Confirme que está no ar antes de seguir.

---

## 2. Endereço de verdade para cada sabor

`/sabores/trufado-de-ninho-com-morangos` no lugar de `#sabores`.

- gere o `slug` a partir do nome, sem acento, guardado numa coluna em `flavors` para não mudar sozinho quando o nome for editado
- **mantenha os endereços com `#` funcionando**, redirecionando para o novo. Existem links antigos em conversas de WhatsApp de clientes — quebrar isso é perder gente de verdade.
- as rotas do Clube e da operação continuam como estão; SEO não se aplica a elas

---

## 3. Conteúdo no HTML, não só depois do JavaScript

Pré-renderize na hora do build uma página por sabor, com nome, foto, resumo, preço e o dia em que costuma sair. O `flavor_summaries` já tem os 26 resumos escritos.

Vinte e seis páginas estáticas geradas no build. Não precisa de servidor.

---

## 4. Título e descrição por página

Hoje todas as páginas herdam o mesmo título. Cada sabor precisa do seu:

```
Trufado de Ninho com Morangos · Adoce Brigaderia — Fortaleza
Fatia de torta trufada de ninho com morangos, feita no dia.
Retirada em Fortaleza. R$ 16,00 a fatia.
```

E `og:image` com a foto da fatia — é o que aparece quando alguém cola o link no WhatsApp. **Isso vale para o compartilhamento mesmo antes de valer para o Google.**

---

## 5. Dados estruturados

`schema.org/Product` em cada sabor (nome, imagem, preço, disponibilidade) e `schema.org/Bakery` na home, com endereço, telefone e horário. É o que faz aparecer com foto e preço no resultado.

⚠️ **Só declare o que é verdade.** Disponibilidade tem que vir do estoque real, e horário do ajuste da loja. Dado estruturado mentiroso é penalizado.

---

## 6. Sitemap de verdade

Gerado no build, com a home, as 26 páginas de sabor, encomendas, festas e a landing do Clube. Fora dele: Clube, operação, carrinho, documentação.

E tire o `Disallow: /documentacao` do jeito que está se a documentação for protegida no bloco 3 — se ela deixar de ser pública, a linha perde a função.

---

## Verificação

```bash
curl -s https://www.adocebrigaderia.com.br/sabores/trufado-de-ninho-com-morangos | grep -c "Trufado de Ninho"
```

Tem que ser maior que zero **sem executar JavaScript**. Se for zero, a pré-renderização não funcionou e o Google continua sem ver.

E: abrir 5 endereços antigos com `#` e confirmar que ainda funcionam.

---

## Me devolva

- quantas páginas o sitemap passou a ter
- a saída do `curl` acima
- confirmação de que os links antigos com `#` continuam abrindo

---

## O que NÃO fazer

- Não quebrar os endereços com `#` — existem em conversas de clientes
- Não declarar disponibilidade ou horário falso nos dados estruturados
- Não indexar Clube, operação nem carrinho
- Não prometer resultado rápido: isto leva meses
