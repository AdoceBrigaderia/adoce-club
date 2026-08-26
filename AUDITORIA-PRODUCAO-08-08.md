# Auditoria de produção — 08/08/2026

Feita com autorização prévia do Rubens para verificar e corrigir. Tudo abaixo foi aplicado **direto em produção** (`uefwywizqhfvvijaopcn`), com backup do dia às 03:00 BRT disponível.

---

## 🔴 O mais grave: `anon` podia apagar tudo

**`anon` — qualquer pessoa na internet, sem login — tinha DELETE, TRUNCATE, INSERT, UPDATE, REFERENCES e TRIGGER em 33 tabelas.** Entre elas `profiles`, `loyalty_tracks`, `staff_members`, `ledger_entries`, `audit_events`.

O RLS estava ligado nas 33 e nenhuma política permitia escrita anônima — então INSERT e UPDATE estavam barrados na prática.

**Mas TRUNCATE não passa por RLS.** Quem tem esse direito apaga a tabela inteira, sem filtro, sem log. Os 75 cadastros e todos os carimbos do Clube estavam a uma chamada de distância.

✅ **Corrigido:** revogados TRUNCATE, DELETE, REFERENCES e TRIGGER de `anon` em todas as tabelas. SELECT, INSERT e UPDATE ficaram, e continuam inertes sob RLS.

---

## 🔴 A reserva nunca dava baixa

**A causa exata, rastreada até o caminho do código:**

O site chama `submit_instant_order_v5`, que bifurca:

- **Pedido com fatia-presente** → `v3`, que reserva estoque e tem trava. Funciona.
- **Pedido comum** → `v4` → `v2`, e **nenhuma das duas toca em `quantity_reserved`.** Sem trava, sem baixa.

Ou seja, o único caminho correto era o do cliente usando a fatia-presente. Todo pedido normal — a esmagadora maioria — passava direto.

A `v2` também **não gera o aviso na fila**. Só a versão original gera. As duas falhas das duas Julianas têm a mesma origem.

✅ **Corrigido por gatilho no banco**, não mexendo nas funções: `private.sincronizar_reserva_de_fatias()` recalcula `quantity_reserved` a partir dos itens de pedido, em INSERT, UPDATE, DELETE e mudança de status.

Vantagem: funciona para **qualquer** das seis versões, inclusive uma sétima que apareça amanhã. E cancelamento devolve ao estoque.

O gatilho tem tratamento de exceção: se falhar, avisa no log e **não impede a venda**. Contagem errada é ruim; venda travada é pior.

**Testado em produção:** pedido de mentira com 2 fatias de Ouro Branco — reservado subiu de 1 para 3; cancelado — voltou para 1; registro apagado.

---

## 🔴 Quatro versões abertas ao público

`submit_instant_order`, `v2`, `v4` e `v5` podiam ser chamadas por qualquer pessoa sem login. As antigas ficaram acessíveis ao serem substituídas.

Quem chamasse a `v2` direto pulava tudo o que as versões novas acrescentaram: trava de pagamento, checagem de recompensa, vínculo com perfil.

✅ **Corrigido:** revogado `execute` de `anon` e `authenticated` em `submit_instant_order`, `v2` e `v4`. Só a `v5` continua pública — que é a que o site usa. As internas seguem funcionando por serem `security definer`.

⚠️ **Dívida:** seis versões continuam existindo. Enquanto existirem, sempre haverá uma errada em uso. Precisa virar uma.

---

## 🟠 Reserva fantasma na virada do dia

Existe uma rotina (`cron` job 2) que roda às 00h de Fortaleza e copia o estoque do dia anterior para o dia novo. **Isso é decisão de projeto** — a própria tela avisa: *"O estoque continua de um dia para o outro."*

Mas ela copiava também `quantity_reserved`. Os pedidos de ontem viravam reservas de hoje, ocupando fatias que ninguém pediu.

✅ **Corrigido:** a cópia agora zera a reserva. O estoque continua; a reserva não.

✅ **DECIDIDO E APLICADO em 08/08:** o Rubens optou por desligar a virada de estoque. Palavras dele: *"a fatia dura até 72h sem problema, mas nós geralmente zeramos todos os dias. Como não vendemos dando baixa em tudo, então é bom deixar ele sempre zerar independente de ter ou não, e se for o caso eu lanço no dia seguinte."*

`cron.unschedule(2)` executado. **Cada dia passa a nascer limpo**, e o que sobrar é relançado manualmente. `cron.job` agora tem apenas o job 1.

Consequência a lembrar: se ninguém lançar a produção pela manhã, o site mostra esgotado — corretamente. É o cenário que o painel do dia destaca em vermelho no topo.

---

## 🟠 Token de login gravado na análise de uso

7 registros em `site_analytics_events` com o `access_token` completo do cliente no `page_path`, entre 23/07 e 06/08. O Supabase devolve o login em `/#access_token=...` e a função gravava a URL inteira.

✅ **Dado limpo** e ✅ **torneira fechada**: `record_site_analytics_event` agora remove o trecho depois do `#` quando detecta token. Testado com um token de mentira — gravou `/#[removido]`.

---

## 🟡 Fila de avisos parada desde 17/07

`outbox_events` com **110 pendentes**: 87 `loyalty.changed`, 10 `service_request.created`, 10 `instant_order.created`, 3 `reward.redeemed`. O mais antigo é de 17/07.

❌ **Não corrigido** — depende das duas funções (`alerta-pedidos.ts` e `alerta-telegram.ts`) que **ainda não entraram no branch**. O merge do PR #22 saiu sem elas.

---

## Estado após esta auditoria

| Item | Antes | Agora |
|---|---|---|
| `anon` pode apagar tabelas | Sim, 33 tabelas | **Não** |
| Reserva dá baixa | Só com fatia-presente | **Sempre** |
| Versões antigas expostas | 4 | **0** |
| Reserva fantasma na virada | Sim | **Não** |
| Token na análise de uso | 7 registros | **0, e bloqueado na origem** |
| Virada de estoque | Copiava tudo do dia anterior | **Desligada — cada dia nasce limpo** |
| Fila de avisos | 110 parados | 110 parados |

> ⚠️ **Tudo acima já está aplicado em produção.** Estes consertos foram feitos direto no banco, não por migração — então existem só lá. Levar homologação ao mesmo estado, capturando cada um em migração, é pré-requisito para qualquer outra migração rodar em produção.

---

## O que ainda falta

1. **As duas funções de aviso** no branch — sem isso a fila continua parada
2. **Unificar as seis versões** de `submit_instant_order` em uma
3. **Decidir sobre a virada de estoque** (job 2 do cron)
4. **94 migrações** pendentes em produção
5. Codificação UTF-8 no processo de publicação, com `.gitattributes`
6. Painel do dia lendo tabela direto do navegador — precisa passar pelo BFF
7. Passkey: "Auth session missing!" no cadastro pela operação
8. 436 MB de imagens originais no Storage

---

## Como reverter, se preciso

As alterações de permissão são reversíveis com `grant`. O gatilho sai com `drop trigger`. As duas funções alteradas (`carry_forward_flavor_inventory` e `record_site_analytics_event`) têm a versão anterior recuperável pelo backup das 03:00.

Nenhum dado foi apagado, exceto o token nos 7 registros de análise — que era o objetivo.
