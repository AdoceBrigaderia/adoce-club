# Arquitetura de informação da Adoce Operação

## Regra vigente

A homologação local possui exatamente cinco áreas operacionais. Nenhum recurso novo pode criar outro item de navegação sem uma decisão explícita de produto.

```text
Adoce Operação
├── Hoje
│   ├── Pendências prioritárias
│   ├── Pedidos em andamento
│   ├── Clientes cadastrados
│   └── Estoque baixo e atalhos
├── Pedidos
│   ├── Caixa e pedidos de fatias
│   ├── Pedidos futuros e pré-reservas
│   ├── Notas e lembretes dentro do pedido
│   └── Concluídos, cancelados e expirados no mesmo fluxo
├── Produtos
│   ├── Sabores e disponibilidade
│   ├── Conteúdo de hoje
│   └── Catálogo, preços, opções, fotos e galerias
├── Clientes
│   ├── Busca por nome, telefone, e-mail ou código
│   ├── Leitura do QR do membro
│   ├── Lista e perfil
│   └── Carimbos, prêmios, correções e histórico do cliente
└── Configurações
    ├── Loja e pagamentos
    ├── Funcionamento e exceções
    └── Equipe, somente para proprietário
```

## Decisões aplicadas em 26/08/2026

- A área **Agenda** foi excluída, não conservada nem renomeada.
- Pedidos futuros continuam em **Pedidos**, apresentados em lista por estado, prazo e retirada.
- Notas, lembretes, histórico e cancelamento ficam dentro do pedido selecionado; não existe CRM separado.
- Horários recorrentes e exceções ficam em **Configurações > Funcionamento**; isso não cria uma Agenda.
- Produtos comerciais e sabores ficam reunidos em **Produtos**.
- Equipe fica dentro de **Configurações** e só aparece para proprietário.
- Foram retirados da interface e do código executável: Agenda, Pede Junto, Financeiro isolado, arquivo isolado, central avançada de notificações, promoções públicas, configuração visual duplicada, campanhas, integrações de catálogo Meta/Instagram, piloto de autenticação por WhatsApp e restauração de produção pela aplicação.
- O Plano Diretor já havia sido excluído antes deste corte.
- Migrations, trilhas de auditoria, backups e histórico Git são preservados; simplificar a interface não autoriza apagar histórico de banco.

## Contrato de navegação

| Destino | Hash principal | Conteúdo |
|---|---|---|
| Hoje | `#operacao` | painel operacional |
| Pedidos | `#operacao-pedidos` | fatias e pedidos futuros |
| Produtos | `#operacao-produtos` | disponibilidade e catálogo |
| Clientes | `#operacao-clientes` | Clube e histórico individual |
| Configurações | `#operacao-configuracoes` | loja, funcionamento e equipe |

A barra lateral e a barra móvel devem mostrar somente esses cinco destinos. Rotas antigas aceitas por compatibilidade devem convergir para uma dessas áreas e não podem reaparecer como menus.

## Critério para novas funções

Antes de incluir uma função, responder:

1. Qual tarefa real ela resolve?
2. Em qual das cinco áreas ela cabe?
3. Já existe uma função com a mesma intenção?
4. Ela precisa ficar no fluxo principal ou dentro do detalhe de um registro?
5. Funciona primeiro em celular e também em tablet e desktop?

Se a função exigir uma sexta área, a arquitetura deve ser revista explicitamente antes da implementação.
