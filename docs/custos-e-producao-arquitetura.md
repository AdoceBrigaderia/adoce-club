# Custos e Produção — arquitetura do módulo

## Decisão

O motor de custos será um **módulo interno independente dentro do produto Adoce**, compartilhando o mesmo repositório e a mesma infraestrutura de homologação nesta fase.

Não será criado agora um segundo produto isolado que devolva somente um valor final ao Portal. A fronteira será lógica e contratual: o Portal, o CRM e a Operação consumirão snapshots versionados do módulo de Custos e Produção por BFF/RPC, sem executar fórmulas financeiras no navegador.

## Responsabilidades

### Portal, CRM e Operação

- catálogo, encomendas, pedidos, vendas, caixa e fidelidade;
- experiência pública `Adoce do Seu Jeito`;
- seleção comercial de massas, recheios, coberturas, frutas e adicionais;
- apresentação de preço, prazo e restrições;
- gravação do identificador do snapshot utilizado em cada pedido.

### Custos e Produção

- ingredientes, insumos, embalagens, serviços, mão de obra e equipamentos;
- histórico de preços e rendimento aproveitável;
- preparações intermediárias e fichas técnicas versionadas;
- tempos ativos e passivos;
- energia, gás, limpeza, perdas e recursos compartilhados por lote;
- custos fixos, depreciação, manutenção e reserva de reposição;
- custo total, custo unitário e custo por fatia;
- formação de preço por canal, margem mínima e alertas;
- snapshots imutáveis para preservar o valor utilizado em pedidos antigos.

## Regras de segurança

1. Dados de custo não são públicos e não são lidos diretamente pelo navegador.
2. Tabelas do módulo usam RLS e revogação para `public`, `anon` e `authenticated`.
3. O BFF usa `service_role` somente depois de autenticar sessão, origem, CSRF e capacidade do usuário.
4. O cliente nunca envia custo, margem, preço final ou snapshot calculado.
5. O servidor resolve as opções por identificadores, calcula ou recupera o snapshot vigente e congela a referência no pedido.
6. Valores manuais permanecem permitidos apenas com status `manual_provisional` até existir ficha técnica validada.
7. Produção não recebe migrations ou deploy sem aprovação expressa.

## Contrato mínimo de snapshot

```json
{
  "recipe_version_id": "uuid",
  "cost_snapshot_id": "uuid",
  "calculated_at": "2026-07-28T08:00:00Z",
  "data_status": "validated",
  "yield_quantity": 13,
  "breakdown": {
    "direct": 0,
    "packaging": 0,
    "labor": 0,
    "energy_and_gas": 0,
    "variable_overhead": 0,
    "fixed_allocation": 0,
    "depreciation": 0,
    "maintenance": 0,
    "replacement_reserve": 0
  },
  "total_cost": 0,
  "unit_cost": 0,
  "source_hash": "sha256"
}
```

Cada pedido deverá manter a referência ao snapshot, à versão da ficha técnica e ao preço comercial vigentes na data da operação.

## Rateios obrigatórios

- energia: potência em kW × tempo × tarifa, rateada entre unidades do mesmo ciclo;
- gás: consumo por hora × tempo × preço, rateado entre preparações simultâneas;
- mão de obra: somente tempo ativo × pessoas realmente envolvidas, dividido entre preparações acompanhadas em paralelo;
- tempo passivo: afeta capacidade, equipamento e energia, mas não multiplica automaticamente a mão de obra;
- perdas: custo pela quantidade útil, com percentual abaixo de 100%;
- custos fixos: critério versionado por unidade, peso, tempo, faturamento ou rateio manual aprovado.

## Entrega técnica atual

- `src/costing-engine.ts`: motor determinístico puro para perdas, lotes, energia, gás, mão de obra, depreciação, snapshots e preço por canal;
- `src/costing-engine.test.ts`: cenários produtivos e financeiros automatizados;
- `20260728090000_costing_core_foundation.sql`: catálogo, preços, fichas técnicas, versões, componentes, recursos, snapshots e preços por canal;
- `src/costing-core-migration.test.ts`: contrato de segurança, histórico e isolamento;
- `cake_builder_options`: preparado para apontar para item técnico ou versão de receita, mantendo custo manual apenas como contingência provisória.

## Próximos marcos

1. CRUD BFF para ingredientes e histórico de preços;
2. CRUD BFF para preparações e versões de ficha técnica;
3. cálculo recursivo server-side e geração de `source_hash`;
4. snapshots e formação de preço por canal;
5. painel mobile/tablet de custos e alertas;
6. vínculo automático das opções do montador às fichas técnicas;
7. simulador administrativo;
8. aplicação controlada da migration somente na homologação;
9. testes concorrentes, RLS, manipulação financeira e histórico;
10. ativação pública somente após dados suficientes e aprovação administrativa.

## Critérios para extração futura

O módulo poderá ser extraído para serviço/repositório próprio quando houver múltiplas fábricas, operação offline, integrações industriais, consumo por outras empresas ou ciclo de desenvolvimento independente. A extração deverá preservar o mesmo contrato de snapshots; nunca deve reduzir a integração a um único campo de custo final.
