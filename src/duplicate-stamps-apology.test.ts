import { describe, expect, it, vi } from "vitest";
import { apologyText, prepareApology, runApologyBatch, type ApologyRecipient } from "../netlify/functions/_shared/duplicate-stamps-apology";

const customer = (id = "track-1", reversed = false): ApologyRecipient => ({ track_id: id, profile_id: `profile-${id}`, full_name: "  Ana   Maria  ", phone_e164: "+5585999999999", current_progress: 5, reversed_reward: reversed });

describe("aviso único de carimbos duplicados", () => {
  it("preserva exatamente os dois textos aprovados", () => {
    expect(apologyText(customer())).toBe("Olá, Ana! Aqui é da Adoce 💕 Identificamos uma falha no nosso sistema que lançou carimbos em dobro em algumas compras feitas entre 13 e 30 de outubro. Já corrigimos: seu cartão do Clube Adoce agora mostra 5 de 14 carimbos, exatamente um carimbo por fatia comprada. Pedimos desculpas pelo transtorno. Qualquer dúvida, é só responder por aqui!");
    expect(apologyText(customer("track-2", true))).toBe("Olá, Ana! Aqui é da Adoce 💕 Identificamos uma falha no nosso sistema que lançou carimbos em dobro em algumas compras feitas entre 13 e 30 de outubro, e isso liberou uma fatia grátis antes da hora no seu cartão. Já corrigimos: agora você está com 5 de 14 carimbos, faltando só 9 para ganhar sua fatia! Pedimos desculpas pelo transtorno. Qualquer dúvida, é só responder por aqui!");
  });
  it("agrupa cartões e falha com identidades conflitantes ou dados incompletos", () => {
    expect(prepareApology([customer(), customer()]).total).toBe(1);
    expect(() => prepareApology([customer(), { ...customer(), profile_id: "another" }])).toThrow("conflicting_track");
    for (const invalid of [{ full_name: " " }, { phone_e164: "85999" }, { current_progress: 14 }, { current_progress: -1 }]) {
      expect(() => prepareApology([{ ...customer(), ...invalid }])).toThrow("invalid_recipient");
    }
  });
  it("simulação separa 92/8 e exclui tentativas anteriores sem enviar", () => {
    const rows = Array.from({ length: 100 }, (_, i) => customer(`track-${i}`, i < 8));
    const result = prepareApology(rows, new Set(["track-99"]));
    expect(result).toMatchObject({ total: 100, normal: 92, reversed: 8, pending: 99, blocked: 1 });
    expect(result.examples.normal).toContain("exatamente um carimbo");
    expect(result.examples.reversed).toContain("faltando só 9");
  });
  const harness = () => {
    const claimed = new Set<string>();
    return {
      claim: vi.fn(async (row: ApologyRecipient) => { if (claimed.has(row.track_id)) return false; claimed.add(row.track_id); return true; }),
      send: vi.fn(async () => "SM123"),
      sent: vi.fn(async () => {}),
      failed: vi.fn(async () => {}),
      now: () => 0,
    };
  };
  it("limita cada chamada a 20 tentativas e impede execução concorrente", async () => {
    const deps = harness();
    const rows = Array.from({ length: 30 }, (_, i) => customer(`track-${i}`));
    await Promise.all([runApologyBatch(rows.slice(0, 20), deps), runApologyBatch(rows.slice(0, 20), deps)]);
    expect(deps.send).toHaveBeenCalledTimes(20);
    const other = harness();
    expect((await runApologyBatch(rows, other)).attempted).toBe(20);
  });
  it("falha não é reenviada; reserva não expira", async () => {
    const deps = harness(); deps.send.mockRejectedValue(new Error("provider_timeout"));
    expect((await runApologyBatch([customer()], deps)).failed).toBe(1);
    await runApologyBatch([customer()], deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.failed).toHaveBeenCalledWith(customer(), "send_uncertain", null);
  });
  it("preserva SID se Twilio aceitar e auditoria de sucesso falhar", async () => {
    const deps = harness(); deps.sent.mockRejectedValue(new Error("database_down"));
    const result = await runApologyBatch([customer()], deps);
    expect(result.failed).toBe(1);
    expect(deps.failed).toHaveBeenCalledWith(customer(), "sent_audit_failed", "SM123");
    await runApologyBatch([customer()], deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it("não envia quando a reserva falha; interrompe se não puder auditar falha", async () => {
    const deps = harness(); deps.claim.mockRejectedValue(new Error("database_down"));
    await expect(runApologyBatch([customer()], deps)).rejects.toThrow("database_down");
    expect(deps.send).not.toHaveBeenCalled();
    const other = harness(); other.send.mockRejectedValue(new Error("timeout")); other.failed.mockRejectedValue(new Error("audit_down"));
    await expect(runApologyBatch([customer(), customer("track-2")], other)).rejects.toThrow("audit_down");
    expect(other.send).toHaveBeenCalledTimes(1);
  });
  it("respeita o orçamento de tempo antes de abrir nova tentativa", async () => {
    const deps = harness(); let time = 0;
    deps.now = () => time;
    deps.send.mockImplementation(async () => { time += 40_000; return "SM123"; });
    expect((await runApologyBatch([customer(), customer("track-2")], deps)).attempted).toBe(1);
  });
});
