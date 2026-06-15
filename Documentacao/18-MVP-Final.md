# MVP Final Adoce Club

## Escopo consolidado

O MVP conecta cliente, gestor, vendas, caixa, gastos, reservas, fidelidade, prêmios, selos, indicações e configurações em um estado local persistente.

## Logo sem borda preta

O JPEG original possui pixels pretos fora do círculo bege. O app preserva o conteúdo original e aplica uma máscara circular interna sobre uma moldura creme. Nenhuma tela exibe o contorno preto.

## Regras operacionais

- Dinheiro, Pix e Cartão liberam QR e carimbos imediatamente.
- Mercado Pago Point e Link começam pendentes e só liberam QR/carimbos após aprovação.
- Cortesia, Permuta e Fidelidade reduzem fatias, mas não geram receita, QR ou carimbo.
- Taxas configuráveis compõem bruto, taxa e líquido.
- Gastos reduzem dinheiro esperado e aparecem no fechamento.
- Reserva pendente não baixa estoque nem gera carimbo.

## Mercado Pago seguro

Point e Link são simulações preparatórias. Operador e terminal vêm do usuário logado. Nenhum Access Token existe no front-end. A integração real deverá usar backend, Orders API e webhooks.

## Limitações

- Sem autenticação, Supabase ou backend reais.
- Sem câmera real, WhatsApp API ou notificações push.
- Mercado Pago apenas mockado e sem credenciais.
