# Prompt 6 para o Codex — trazer os consertos de produção para o código
**08/08/2026, tarde** · Cole tudo abaixo da linha.

---

⚠️ **Leia isto antes de qualquer coisa.**

Hoje, 08/08, foram aplicadas **seis correções direto no banco de produção**, com autorização do Rubens, sem passar por migração. Elas existem **apenas em produção**.

**Consequência:** se as 94 migrações pendentes forem aplicadas por cima, várias podem ser desfeitas — inclusive a que impede o usuário anônimo de apagar tabelas inteiras.

**Sua primeira tarefa é transformar cada uma em migração**, aplicar em homologação e verificar que produção e homologação passam a dizer a mesma coisa. Só depois disso qualquer outra migração pode rodar em produção.

---

## 1. As seis correções a capturar

Crie migrações com data de hoje, na ordem abaixo. O detalhe completo está em `AUDITORIA-PRODUCAO-08-08.md`.

**1.1 — Revogar direitos destrutivos de `anon`**
`anon` tinha TRUNCATE, DELETE, REFERENCES e TRIGGER em 33 tabelas. TRUNCATE **não passa por RLS**: qualquer pessoa sem login podia apagar `profiles`, `loyalty_tracks`, `staff_members` inteiras.
Aplicado: `revoke truncate, delete, references, trigger on <tabela> from anon` em todas.
Na migração, prefira revogar de todo o schema e reconceder só o necessário.

**1.2 — Fechar as versões antigas de `submit_instant_order`**
`submit_instant_order`, `v2` e `v4` eram executáveis por `anon`. Chamando a `v2` direto, pulava-se a trava de pagamento, a checagem de recompensa e o vínculo com perfil.
Aplicado: `revoke execute ... from anon, authenticated` nas três. Só a `v5` continua pública.

**1.3 — Gatilho de reserva de estoque** ← *a mais importante*
Criadas `private.recalcular_reserva_de_fatias(uuid, date)` e `private.sincronizar_reserva_de_fatias()`, com gatilhos em `instant_order_items` (insert/update/delete) e em `instant_orders` (update of status).

**Causa que ele resolve:** a `v5` chama `v3` quando há fatia-presente (que reserva certo) e `v4 → v2` no pedido comum (que **não** reserva). O caminho normal nunca dava baixa.

O gatilho recalcula a partir dos itens, então funciona para qualquer das seis versões. Tem `exception when others` de propósito: **contagem errada é ruim, venda travada é pior.** Não remova esse bloco.

**1.4 — `carry_forward_flavor_inventory` não copia mais a reserva**
Copiava `quantity_reserved` do dia anterior, criando reserva fantasma.

**1.5 — Rotina de virada de estoque desligada**
`cron.unschedule(2)`. Decisão do Rubens: *"é bom deixar ele sempre zerar independente de ter ou não, e se for o caso eu lanço no dia seguinte."* Cada dia nasce limpo.

**1.6 — `record_site_analytics_event` remove token da URL**
Havia 7 registros com o `access_token` completo do cliente gravado no `page_path`. Dados limpos e função corrigida para remover o trecho após `#` quando detectar token.
Inclua na migração a limpeza dos registros existentes — homologação pode ter os mesmos.

---

## 2. Verificar depois

- `anon` não tem mais TRUNCATE/DELETE em nenhuma tabela de `public`
- só `submit_instant_order_v5` executável por `anon`, entre as versões de submit
- um pedido de teste em homologação incrementa `quantity_reserved`; cancelar devolve
- `cron.job` tem apenas o job 1
- token na URL vira `/#[removido]`

---

## 3. Ainda pendente do prompt anterior

**As duas funções de aviso nunca entraram no branch:** `netlify/functions/alerta-pedidos.ts` (Web Push) e `netlify/functions/alerta-telegram.ts`, mais a dependência `web-push` no `package.json`. A fila `outbox_events` tem **110 avisos parados desde 17/07**.

**Painel do dia lendo tabela direto do navegador** — `permission denied for table instant_orders`. Toda leitura pelo BFF. **Não afrouxe RLS nem conceda grant novo ao `authenticated`.**

**Codificação UTF-8 quebrada** na publicação — "OperaÃ§Ã£o", "produÃ§Ã£o". Corrija na origem e acrescente `.gitattributes` fixando UTF-8, mais uma verificação que quebre o build se um arquivo chegar torto. Já aconteceu quatro vezes.

**Passkey:** "Auth session missing!" no cadastro pela operação. `auth-bff-passkeys.ts` passa o token só em `global.headers.Authorization`, mas `client.auth.passkey.*` exige sessão estabelecida. Leia também o `REFRESH_COOKIE` e chame `setSession` antes. Mesma checagem em `auth-bff-passkey-start.ts` e `-finish.ts`.

---

## 4. Arquivos novos aguardando integração

Do prompt 5, mais os de agora:

```
src/pede-junto-prazo.ts / .test.ts / PedeJuntoPrazo.tsx / .css
src/painel-do-dia.ts / .test.ts / PainelDoDia.tsx / .css
src/jornada-do-pedido.ts / .test.ts / PedidoNaEsteira.tsx / .css
src/capacidade-de-encomenda.ts / .test.ts / AgendaDeEncomendas.tsx / .css
src/FichaTermica.tsx / ficha-termica.css / ficha-termica.test.ts
```

Verificado aqui: `tsc -b` limpo, **399 testes passando**.

---

## O que NÃO fazer

- **Não aplique as 94 migrações em produção** antes de capturar os seis consertos acima. Risco real de reabrir a brecha do TRUNCATE.
- Não remova o `exception when others` do gatilho de reserva.
- Não crie conta, não aceite termos, não gere nem rotacione credencial.
- Não apague nada do Storage.
