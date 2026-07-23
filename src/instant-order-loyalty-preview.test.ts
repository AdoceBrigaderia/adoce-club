import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const operation = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260723003920_member_instant_order_loyalty_preview.sql", import.meta.url),
  "utf8",
);
const rewardMigration = readFileSync(
  new URL("../supabase/migrations/20260723005306_customer_select_instant_order_reward.sql", import.meta.url),
  "utf8",
);

describe("prévia segura do Clube no pedido de fatias", () => {
  it("mostra a projeção ao próprio membro e não abre a consulta ao público", () => {
    expect(migration).toContain("profile.id = (select auth.uid())");
    expect(migration).toContain("profile.phone_e164");
    expect(migration).toContain("revoke all on function public.member_instant_order_loyalty_preview");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });

  it("explica quando os carimbos entram e celebra a conclusão do cartão", () => {
    expect(panel).toContain("Seu Clube Adoce foi reconhecido");
    expect(panel).toContain("assim que o pagamento for confirmado");
    expect(panel).toContain("Esta compra completa seu cartão e libera uma fatia-presente");
  });

  it("envia uma mensagem afetiva após a confirmação do pagamento", () => {
    expect(operation).toContain("É um prazer presentear clientes fiéis como você");
    expect(operation).toContain("Você completou seu cartão do Clube Adoce");
    expect(operation).toContain("stamps_added");
    expect(operation).toContain("reward_redeemed");
  });

  it("permite ao próprio membro escolher sabor e calda sem resgatar antes do pagamento", () => {
    expect(panel).toContain("Quero receber minha fatia-presente neste pedido");
    expect(panel).toContain('rpc("submit_instant_order_v5"');
    expect(panel).toContain("requested_reward: wantsReward");
    expect(rewardMigration).toContain("created_order.profile_id is distinct from (select auth.uid())");
    expect(rewardMigration).toContain("status, is_reward");
    expect(rewardMigration).toContain("instant_order_item_sauces");
    expect(rewardMigration).not.toContain("staff_redeem");
    expect(rewardMigration).toContain("O resgate e os carimbos continuam sendo efetivados somente ao confirmar o pagamento");
  });
});
