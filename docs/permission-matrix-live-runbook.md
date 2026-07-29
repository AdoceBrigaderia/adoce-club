# Ensaio vivo da matriz de permissões — homologação

Este roteiro executa verificações reais de papel, capacidade, isolamento entre lojas, auditoria e proteção concorrente do último proprietário somente no Supabase de homologação. O SQL sempre começa com `BEGIN` e termina com `ROLLBACK`, portanto lojas, papéis e atribuições temporárias são revertidos ao final.

Produção não faz parte deste procedimento.

## Matriz efetiva

A atribuição por loja pode reduzir permissões, mas nunca ampliar o teto do papel:

| Papel | Capacidades permitidas |
|---|---|
| `owner` | acesso integral às capacidades conhecidas |
| `manager` | acesso integral às capacidades conhecidas |
| `attendant` | vender, clientes, fidelidade e pedidos |
| `cashier` | vender, abrir caixa e fechar caixa |
| `production` | estoque e produção |
| `viewer` | consultar relatórios |

Combinações desconhecidas de papel ou capacidade são negadas. Flags antigas incompatíveis são ignoradas pela autorização e normalizadas quando a migration é aplicada ou quando o papel é alterado.

## O que o ensaio valida

- os seis papéis obedecem ao teto documentado;
- `attendant`, `cashier`, `production` e `viewer` só atuam na loja atribuída;
- flags residuais não ampliam o papel atual;
- `cashier` vende, abre e fecha caixa, mas não recebe financeiro ou estoque;
- `production` acessa estoque e produção, mas não vende nem abre caixa;
- `viewer` permanece somente leitura;
- uma atribuição administrativa inválida é rejeitada;
- mudanças válidas de capacidade geram auditoria;
- mudança para papel mais restrito limpa flags persistidas incompatíveis;
- `manager` não altera proprietário;
- proprietário não altera o próprio papel;
- a proteção do último proprietário usa bloqueio ordenado `FOR UPDATE` para evitar corrida concorrente;
- todas as alterações de preparação são revertidas.

## Pré-requisitos no GitHub

No Environment `homologation`, configurar:

### Secret

- `SUPABASE_HOMOLOGATION_DB_URL`: conexão PostgreSQL do projeto exclusivo de homologação. Não usar URL, senha ou pooler de produção.

### Variables

- `ADOCE_HOMOLOGATION_SUPABASE_REF`: referência do projeto de homologação;
- `ADOCE_PRODUCTION_SUPABASE_REF`: referência de produção usada somente para bloqueio explícito.

O workflow rejeita a execução quando as referências são vazias, iguais, quando a URL não contém a referência de homologação ou quando contém a referência de produção.

## Pré-requisitos no banco de homologação

- migrations da branch aplicadas, incluindo `20260729105000_staff_role_capability_ceiling.sql`;
- pelo menos uma loja ativa;
- dois proprietários ativos de teste.

O segundo proprietário é temporariamente alternado entre os papéis testados dentro da transação. O `ROLLBACK` restaura o estado anterior.

## Execução

1. Abrir **Actions** no repositório;
2. selecionar **Testar segurança viva na homologação**;
3. escolher a branch `reestruturacao/ux-crm-operacao-imagens-v1`;
4. informar o SHA completo que está no topo do PR;
5. digitar exatamente `TESTAR SOMENTE HOMOLOGACAO`;
6. executar o workflow.

O workflow baixa somente a branch autorizada, confere o SHA, valida o isolamento do banco, instala o cliente PostgreSQL e executa:

```text
supabase/tests/permission_matrix_live.sql
```

A conexão usa `ON_ERROR_STOP=1`: a primeira violação interrompe o job e impede um resultado falso positivo.

## Evidência

Ao final, o log é preservado dentro do artefato de segurança viva do commit:

```text
security-live-<commit>
```

O arquivo `permission-matrix.log` deve terminar com `ROLLBACK`. O artefato não inclui URL nem senha do banco.

## Interpretação de falhas

- **Dois proprietários exigidos:** criar ou promover duas contas exclusivamente na homologação;
- **Loja ativa exigida:** criar uma loja de teste na homologação;
- **URL não pertence à homologação:** revisar secret e referências antes de repetir;
- **Referência de produção detectada:** não contornar o bloqueio; corrigir o Environment;
- **Teto do papel ultrapassado:** tratar como bloqueador de segurança e revisar `private.staff_role_allows_capability` e `private.staff_has_capability`;
- **Capacidade indevida ou acesso entre lojas:** tratar como bloqueador de segurança e não publicar homologação;
- **Normalização ausente:** revisar `manager_update_staff_member` e o backfill da migration;
- **Proteção concorrente ausente:** restaurar o bloqueio ordenado dos proprietários ativos antes de qualquer teste adicional;
- **Auditoria ausente:** revisar RPCs e `audit_events` antes de novo ensaio.

## Regra de liberação

O ensaio aprovado é uma das evidências para liberar a homologação ao usuário. Ele não autoriza merge nem publicação em produção. Produção continua condicionada à aprovação expressa, backup, rollback e smoke tests do commit exato.
