import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner", active: true, origin: true, authorized: true,
  rpc: vi.fn(), insert: vi.fn(), create: vi.fn(), load: vi.fn(),
}));
vi.mock("../netlify/functions/_shared/whatsapp-auth", () => ({
  allowedOrigin: () => state.origin,
  authorizeStaffRequest: async () => state.authorized ? { actorUserId: "owner-id" } : { errorResponse: new Response(null, { status: 401 }) },
  env: (key: string) => ({ TWILIO_ACCOUNT_SID: "test-account", TWILIO_AUTH_TOKEN: "test-token", TWILIO_WHATSAPP_FROM: "+5585999999999", TWILIO_SUPPORT_MESSAGE_CONTENT_SID: `HX${"a".repeat(32)}` })[key],
  json: (body: unknown, status = 200) => Response.json(body, { status }),
  serviceClient: () => ({
    rpc: state.rpc,
    from: (table: string) => table === "staff_members" ? {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: state.role, active: state.active }, error: null }) }) }),
    } : { insert: state.insert },
  }),
}));
vi.mock("../netlify/functions/_shared/duplicate-stamps-apology-data", () => ({ loadApology: state.load }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: state.create } }) }));
import handler from "../netlify/functions/duplicate-stamps-apology";

const recipient = { track_id: "track-id", profile_id: "profile-id", full_name: "Ana Maria", phone_e164: "+5585888888888", current_progress: 4, reversed_reward: false };
const request = (body: unknown = {}) => new Request("https://www.adocebrigaderia.com.br/api/duplicate-stamps-apology", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks(); state.role = "owner"; state.active = true; state.origin = true; state.authorized = true;
  state.load.mockResolvedValue({ total: 100, pending: 100, recipients: [recipient] });
  state.rpc.mockResolvedValue({ data: true, error: null });
  state.insert.mockResolvedValue({ error: null });
  state.create.mockResolvedValue({ sid: "SM123" });
});

describe("endpoint temporário restrito ao proprietário", () => {
  it("recusa método, origem, falta de sessão, gerente e proprietário inativo", async () => {
    expect((await handler(new Request(request().url))).status).toBe(405);
    state.origin = false; expect((await handler(request())).status).toBe(403);
    state.origin = true; state.authorized = false; expect((await handler(request())).status).toBe(401);
    state.authorized = true; state.role = "manager"; expect((await handler(request())).status).toBe(403);
    state.role = "owner"; state.active = false; expect((await handler(request())).status).toBe(403);
    expect(state.load).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
  });
  it("modo padrão só simula e não expõe lista ou telefones", async () => {
    const response = await handler(request());
    expect(await response.json()).toEqual({ mode: "preview", total: 100, pending: 100 });
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
  });
  it("exige confirmação explícita e interrompe se leitura falhar", async () => {
    expect((await handler(request({ mode: "send" }))).status).toBe(400);
    state.load.mockRejectedValue(new Error("recipient_read_failed"));
    expect((await handler(request({ mode: "send", confirmation: "duplicate-stamps-2026-10:send" }))).status).toBe(503);
    expect(state.create).not.toHaveBeenCalled();
  });
  it("usa só template aprovado, reserva antes de enviar e audita SID", async () => {
    expect((await handler(request({ mode: "send", confirmation: "duplicate-stamps-2026-10:send" }))).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("server_claim_duplicate_stamp_apology", { requested_track_id: "track-id", requested_actor_id: "owner-id" });
    expect(state.rpc.mock.invocationCallOrder[0]).toBeLessThan(state.create.mock.invocationCallOrder[0]);
    expect(state.create).toHaveBeenCalledWith({ from: "whatsapp:+5585999999999", to: "whatsapp:+5585888888888",
      contentSid: `HX${"a".repeat(32)}`, contentVariables: expect.stringContaining('"1":"Olá, Ana!') });
    expect(state.create.mock.calls[0][0]).not.toHaveProperty("body");
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ action: "stamps.duplicate_apology_sent", entity_id: "track-id", payload: expect.objectContaining({ message_sid: "SM123" }) }));
  });
  it("não envia sem migração de reserva ou para reserva já existente", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "missing_function" } });
    expect((await handler(request({ mode: "send", confirmation: "duplicate-stamps-2026-10:send" }))).status).toBe(503);
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect((await handler(request({ mode: "send", confirmation: "duplicate-stamps-2026-10:send" }))).status).toBe(200);
    expect(state.create).not.toHaveBeenCalled();
  });
});
