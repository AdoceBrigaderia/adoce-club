# Regra permanente da impressão BLE — KNUP KP-1025

## Problema registrado

O canal BLE da KNUP KP-1025 trabalha com payload seguro de até 20 bytes por
escrita (MTU padrão de 23 bytes). O serviço Android chegou a enviar blocos de
180 bytes sem aguardar a conclusão da escrita. O resultado foi perda,
intercalação e repetição de trechos da ficha térmica.

## Solução que não pode regressar

`AdoceOrderService.writeReceipt` deve:

1. dividir a ficha ESC/POS em blocos de no máximo 20 bytes;
2. aguardar a confirmação quando a característica usar `WRITE_TYPE_DEFAULT`;
3. manter uma pausa curta entre os pacotes para a característica
   `WRITE_TYPE_NO_RESPONSE`;
4. só marcar o pedido como impresso depois que todos os blocos forem enviados.

O teste independente `src/printer-ble-transport-regression.test.ts` protege
essas invariantes e é executado pelo `npm test` e pelo portão
`npm run release:check`. Qualquer retorno a blocos de 180 bytes falha o build e
bloqueia a publicação.

## Regra também para o navegador

O caminho Web Bluetooth usa `src/lib/impressora-termica.ts` e deve manter
`fatiar` com 20 bytes por padrão. Android e navegador são transportes
independentes: corrigir apenas um deles permite que uma atualização posterior
reintroduza a impressão truncada no outro.

O teste independente `src/printer-ble-transport-regression.test.ts` fiscaliza
os dois caminhos. O `release:check` precisa falhar se qualquer implementação
voltar a usar blocos de 180 bytes.

## Evidência desta correção

Em 02/09/2026, uma ficha real foi reimpressa corretamente e o mesmo pedido foi
enviado 10 vezes. O fluxo automático recebeu um `INSERT` de `instant_orders` e
enviou 947 bytes em 48 pacotes sem erro BLE.
