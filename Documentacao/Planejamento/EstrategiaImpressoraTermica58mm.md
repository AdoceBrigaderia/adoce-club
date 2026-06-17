# Estrategia de impressao termica 58mm

Data: 2026-06-17

## Modelo informado

- Marca: Iget
- Linha: Ze delivery 99 food
- Modelo anunciado: IOS Anota ai iFood 58mm
- Tipo: impressora termica 58mm monocromatica
- Resolucao: 203 DPI, 8 dots/mm
- Velocidade anunciada: 60 mm/s
- Bateria: litio 7,4V DC / 2000mAh
- Conexao: Bluetooth e USB
- Android: app RawBT
- iOS: app POS-Printer
- Windows/Mac: Bluetooth ou USB
- Papel: bobina termica 58mm comum, nao adesiva

## Decisao tecnica

Manter o Adoce Club como web/PWA. A impressao deve ser implementada primeiro como fila de impressao e templates 58mm, deixando a comunicacao com a impressora em uma camada isolada.

Isso evita prender o sistema inteiro a um unico modelo de impressora e permite testar Android, iOS e computador separadamente.

## Caminho recomendado

### Android

Prioridade inicial.

Usar o tablet ou celular Android com RawBT. O app web gera o conteudo do comprovante em formato compativel com impressora termica e entrega para o RawBT por acao de imprimir/compartilhar/abrir.

Vantagens:

- Mais provavel de funcionar no festival.
- Nao exige app publicado na Play Store.
- Combina com tablet/celular Android.
- Permite operar com bateria.

Riscos:

- Cada impressora pode ter pequenas diferencas ESC/POS.
- QR code precisa ser testado em tamanho real.
- Acentos e cedilha podem exigir ajuste de codepage.

### iOS

Suporte secundario.

No iPhone/iPad, web Bluetooth nao e uma rota confiavel para impressora termica. A melhor aposta e gerar o comprovante no Adoce Club e enviar para o app POS-Printer por compartilhamento, arquivo, imagem ou fluxo aceito pelo app.

Vantagens:

- Mantem o iPhone dentro da operacao.
- Nao exige publicacao imediata na App Store.

Riscos:

- Menos controle direto a partir do navegador.
- Pode exigir mais toques do operador.
- O app POS-Printer precisa ser validado com a impressora real.

### Computador

Fica como contingencia, nao como operacao principal.

Pode ser util para testar USB/Bluetooth em bancada, mas nao e a rota ideal para a barraca por causa de energia e praticidade.

## Templates de impressao prioritarios

1. Comprovante de pedido/reserva para colar na embalagem.
2. Comprovante de venda com QR de fidelidade.
3. Comprovante de credito do cliente.
4. Fechamento diario do caixa.
5. Reimpressao de pedido.
6. Comprovante de retirada/delivery para motorista.

## Regras visuais para bobina 58mm

- Largura alvo: 384 dots.
- Monocromatico puro.
- Poucos elementos decorativos.
- Logo simplificado em preto e branco.
- Fonte grande para pedido, nome e quantidade.
- QR code com margem branca generosa.
- Evitar imagens pesadas no fluxo real.
- Usar separadores simples: linhas pontilhadas, blocos e titulos.
- Texto sem depender de cor.

## Proximo teste com hardware real

Checklist quando a impressora chegar:

- Parear no Android.
- Instalar e configurar RawBT.
- Imprimir texto simples.
- Imprimir acentos: acucar, coracao, cartao, credito.
- Imprimir QR code de fidelidade.
- Imprimir comprovante completo de venda.
- Medir se o QR escaneia rapido.
- Testar 10 impressoes seguidas.
- Testar bateria durante operacao simulada.
- Testar no iOS com POS-Printer.
- Decidir se a operacao oficial usa Android como terminal principal de impressao.

## Implementacao no Adoce Club

Criar uma camada `print_jobs` no backend:

- venda registrada cria job de impressao opcional;
- pedido online confirmado cria etiqueta/comprovante;
- fechamento cria relatorio de impressao;
- reimpressao usa o mesmo conteudo do job original;
- cada job registra status: pendente, impresso, falhou ou cancelado.

No frontend:

- botao "Imprimir" visivel apos venda/pedido/fechamento;
- botao "Reimprimir" em vendas recentes e detalhes do pedido;
- tela "Fila de impressao" para pendencias;
- configuracao de impressora por aparelho: Android RawBT, iOS POS-Printer ou navegador.

## Conclusao

A impressora escolhida parece adequada para a realidade da barraca: pequena, bateria propria, 58mm, Bluetooth e custo baixo. A decisao mais segura e tratar Android + RawBT como primeiro caminho operacional e manter iOS + POS-Printer como compatibilidade a validar.
