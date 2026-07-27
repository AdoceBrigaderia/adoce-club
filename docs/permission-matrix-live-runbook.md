# Ensaio vivo da matriz de permissões — homologação

Este roteiro executa verificações reais de papel, capacidade e isolamento entre lojas somente no Supabase de homologação. O SQL sempre começa com `BEGIN` e termina com `ROLLBACK`, portanto as lojas, papéis e atribuições temporárias são revertidos ao final.

Produção não faz parte deste procedimento.

## O que o ensaio valida

- `cashier` vende apenas na loja atribuída;
- capacidade financeira não é herdada sem autorização;
- uma pessoa não acessa nem vende em outra loja sem atribuição;
- mudanças de capacidade geram auditoria;
- `production` atua somente na loja e capacidade liberadas;
- `manager` não altera proprietário;
- proprietário não altera o próprio papel;
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

- migrations da branch aplicadas;
- pelo menos uma loja ativa;
- dois proprietários ativos de teste.

O segundo proprietário é temporariamente alternado entre os papéis testados dentro da transação. O `ROLLBACK` restaura o estado anterior.

## Execução

1. Abrir **Actions** no repositório;
2. selecionar **Testar matriz de permissões na homologação**;
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

Ao final é criado o artefato:

```text
permission-matrix-live-<commit>
```

O log deve terminar com `ROLLBACK`. O artefato não inclui a URL nem a senha do banco.

## Interpretação de falhas

- **Dois proprietários exigidos:** criar ou promover duas contas exclusivamente na homologação;
- **Loja ativa exigida:** criar uma loja de teste na homologação;
- **URL não pertence à homologação:** revisar secret e referências antes de repetir;
- **Referência de produção detectada:** não contornar o bloqueio; corrigir o Environment;
- **Capacidade indevida ou acesso entre lojas:** tratar como bloqueador de segurança e não publicar homologação;
- **Auditoria ausente:** revisar RPCs e triggers antes de novo ensaio.

## Regra de liberação

O ensaio aprovado é uma das evidências para liberar a homologação ao usuário. Ele não autoriza merge nem publicação em produção. Produção continua condicionada à aprovação expressa, backup, rollback e smoke tests do commit exato.
