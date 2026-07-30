# Resiliência dos filtros rápidos de relatórios

## Objetivo

Manter a troca de canal, operador e caixa em um toque, sem permitir que respostas antigas sobrescrevam a escolha mais recente do usuário. O comportamento foi pensado para celular e tablet usados durante o atendimento.

## Estratégia de requisição

A interface usa a estratégia `latest-wins`:

1. cada toque recebe um identificador sequencial;
2. a consulta anterior é cancelada com `AbortController`;
3. o BFF recebe o `AbortSignal` sem alterar cookies, CSRF ou a allowlist de RPCs;
4. somente a resposta cujo identificador ainda é o mais recente pode atualizar a tela;
5. troca de período, loja, relatório-base ou desmontagem do componente cancela a consulta pendente.

O cancelamento é apenas uma otimização de transporte. A verificação do identificador permanece obrigatória, pois uma resposta pode terminar no mesmo instante em que o cancelamento é solicitado.

## Coerência dos filtros

Os filtros continuam afetando somente os quatro detalhamentos. Antes da chamada BFF, a interface reconcilia combinações incompatíveis:

- selecionar operador ou caixa força o canal `presencial`;
- selecionar canal `online` limpa operador e caixa;
- selecionar um caixa de outra loja limpa o operador anterior;
- selecionar um operador de outra loja limpa o caixa anterior;
- operador presente em várias lojas aparece uma única vez como `Várias lojas`, sem atribuição enganosa a uma unidade específica.

A reconciliação não autoriza dados. O backend e as capacidades por loja continuam sendo a fonte de verdade.

## Segurança preservada

- consultas permanecem em `staff_get_operational_reports` pela rota BFF;
- o navegador não recebe nem envia bearer token;
- cookies HttpOnly e CSRF continuam obrigatórios;
- nenhuma leitura direta do Supabase foi adicionada;
- valores financeiros `null` continuam exibidos como protegidos;
- o orçamento máximo permanece em um toque por mudança de recorte.

## Arquivos

- `src/services/bff-rpc.ts`: opção compatível de cancelamento por `AbortSignal`;
- `src/operational-report-breakdowns.ts`: normalização e reconciliação determinística;
- `src/OperationReportBreakdowns.tsx`: cancelamento, sequência e política `latest-wins`;
- `src/operation-report-breakdowns.test.ts`: contratos de coerência, cancelamento e proteção financeira.

## Validação mínima

```text
npx vitest run src/operation-report-breakdowns.test.ts src/bff-rpc-security.test.ts
npx tsc --noEmit
```

Além dos testes, validar manualmente em homologação:

1. tocar rapidamente em dois canais e confirmar que o último permanece;
2. alternar caixa e operador de lojas diferentes;
3. selecionar `online` após um filtro presencial;
4. trocar a loja principal enquanto um recorte estiver carregando;
5. repetir com sessão sem `view_finance` e confirmar que nenhum valor protegido vira zero.

Nenhuma migration, deploy, merge ou alteração de produção faz parte deste marco.
