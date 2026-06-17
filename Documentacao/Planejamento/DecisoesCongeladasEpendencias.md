# Decisoes congeladas e pendencias para o piloto

Data: 2026-06-17

## Decisoes congeladas

Estas decisoes nao devem ser alteradas sem uma nova aprovacao explicita.

- Produto sera web/PWA.
- Uso inicial sera interno da Adoce Brigaderia, sem foco em venda da ferramenta agora.
- Comprovantes/impressos estao aprovados como direcao visual.
- Fonte/imagem do nome "Adoce Club" esta aprovada e congelada.
- Titulo "Adoce Club" nao deve ser redesenhado.
- Papel de parede rosa aprovado.
- Paleta de cores aprovada.
- Carimbo de fidelidade com fatia de chocolate aprovado.
- Festival de fatias acontece quinta, sexta e sabado, 19h as 23h.
- Producao acontece segunda a sabado, 8h as 17h.
- Caixa do festival sempre abre com estoque lancado na abertura.
- Pode existir caixa diurno para vender sobras do dia anterior.
- Impressora alvo: termica Bluetooth 58mm Iget, Android/RawBT e iOS/POS-Printer.
- Integracao real Mercado Pago fica para fase posterior.
- Latitude e longitude nao aparecem como campos manuais; devem ser dados internos capturados pelo GPS do aparelho.
- Rotas para cliente devem usar como busca principal: "Festival de fatias Adoce Brigaderia".
- Piloto do festival sera operado por celular Android.
- Piloto usara dados reais de venda.
- Fidelidade sera testada de forma controlada com alguns clientes beta.
- Operador do piloto: Rubens.
- Preco oficial inicial da fatia: R$ 16,00, editavel nas configuracoes.
- Formas de pagamento do piloto: dinheiro, Pix manual, cartao/maquininha, cortesia, permuta e fidelidade.
- Cliente podera escanear QR de fidelidade no piloto.
- Dados minimos do cliente: nome e WhatsApp.
- Dados opcionais do cliente: aniversario e Instagram.
- Consentimento LGPD aprovado.

## Feedback visual recebido

- Telas do pacote visual ainda nao estao aprovadas.
- Logo no topo aparece cortada.
- Menu inferior esta feio por causa de linhas verticais ao lado dos icones.
- Textos de botoes precisam ser revistos.
- Textos das configuracoes precisam ser revistos.
- Campos em ingles precisam ser traduzidos.
- Fonte aprovada do "Adoce Club" deve orientar tambem os titulos internos.
- Comprovantes foram aprovados.

## Decisoes que ainda preciso de voce

1. Qual aparelho vai operar o caixa amanha?
   - Decidido: celular Android.

2. Qual aparelho vai imprimir?
   - Impressora ainda nao recebida. Impressao fica fora do piloto presencial inicial.

3. O piloto de amanha sera com dados reais ou dados de teste?
   - Decidido: dados reais de venda. Fidelidade em beta controlado.

4. Quem serao os operadores?
   - Decidido: Rubens.

5. Quais sabores e quantidades vao abrir o caixa amanha?
   - O app deve permitir cadastrar sabores, quantidades por sabor e caldas disponiveis na abertura do caixa.

6. Qual preco oficial da fatia amanha?
   - Decidido: R$ 16,00, com possibilidade de alterar.

7. Quais formas de pagamento entram no piloto?
   - Decidido: dinheiro, Pix manual, cartao/maquininha, cortesia, permuta e fidelidade.

8. O cliente vai escanear QR de fidelidade ja amanha?
   - Decidido: sim.

9. Vamos coletar quais dados minimos do cliente?
   - Decidido: nome e WhatsApp. Aniversario e Instagram opcionais.

10. Texto de consentimento LGPD aprovado.
   - Aprovado: "Aceito participar do Adoce Club e autorizo o uso dos meus dados para identificar compras, carimbos, premios e comunicacoes da Adoce Brigaderia. Posso pedir correcao ou exclusao dos meus dados pelo WhatsApp da empresa."

11. Em qual aparelho vamos capturar o GPS do ponto do festival?
   - Recomendado: abrir configuracoes no aparelho que estiver fisicamente na barraca e tocar em "Usar GPS deste aparelho".
   - Observacao: como o local ja aparece por busca nos apps, GPS fica como melhoria opcional, nao como bloqueio para o piloto.

## Escopo recomendado para amanha

Focar no piloto operacional:

- abrir caixa;
- registrar vendas;
- registrar forma de pagamento;
- controlar fatias vendidas/restantes;
- gerar QR/link de fidelidade;
- imprimir ou simular comprovante;
- fechar caixa;
- anotar problemas reais da fila.

Evitar amanha:

- pedido online completo;
- Mercado Pago automatico;
- automacao de WhatsApp;
- cadastro familiar complexo;
- painel de relatorios avancados.

## LGPD no piloto

Para o piloto, o app deve seguir minimo necessario:

- coletar apenas dados necessarios;
- explicar finalidade do Adoce Club;
- pedir consentimento para promocoes;
- permitir correcao/exclusao via WhatsApp;
- nao expor dados de clientes em telas publicas;
- nao armazenar tokens sensiveis no frontend;
- usar Supabase com RLS e perfis de acesso.
