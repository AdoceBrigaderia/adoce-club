# Supabase

Projeto configurado para o backend do Adoce Club.

## Arquivos

- `migrations/202606170001_initial_adoce_backend.sql`: schema inicial recomendado para caixa, estoque por sabor, pedidos online, fidelidade, creditos, impressao e auditoria.
- `schema.sql`, `policies.sql` e `seed.sql`: arquivos antigos do MVP demonstrativo. Manter como referencia ate a migracao consolidar tudo em migrations.

## Como aplicar no Supabase

Opcao mais simples agora:

1. Abra o painel do Supabase.
2. Entre em SQL Editor.
3. Cole o conteudo de `migrations/202606170001_initial_adoce_backend.sql`.
4. Execute.

Opcao por CLI, quando a CLI estiver instalada e autenticada:

```powershell
supabase login
supabase init
supabase link --project-ref xwmhoxocuomvpibcgqkl
supabase db push
```

## Ambiente local

O arquivo `.env.local` foi criado localmente e e ignorado pelo Git.

Variaveis usadas pelo front:

```powershell
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Seguranca

Nunca versionar:

- senha do banco;
- string de conexao direta;
- `service_role`;
- tokens do Mercado Pago;
- segredos de webhook.

Como a string direta do banco foi compartilhada na conversa, recomenda-se rotacionar a senha do banco no Supabase antes de usar em producao real.

## Proximo passo tecnico

Antes de migrar o app inteiro para nuvem, criar RPCs transacionais para:

- abrir caixa;
- vender por sabor;
- cancelar venda;
- baixar/repor estoque;
- emitir token de fidelidade;
- resgatar carimbo;
- fechar caixa;
- criar credito do cliente;
- registrar impressao.
