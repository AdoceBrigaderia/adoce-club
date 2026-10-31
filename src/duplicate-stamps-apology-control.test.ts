import { beforeEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("./lib/supabase", () => ({ requireSupabase: () => ({ auth: { getSession: session } }) }));
import { requestApology } from "./services/duplicate-stamps-apology";
beforeEach(() => { vi.restoreAllMocks(); session.mockResolvedValue({ data: { session: { access_token: "test-owner-session" } }, error: null }); });
it("controle usa sessão existente, simula por padrão e envia só sob comando", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ pending: 100 }));
  await requestApology();
  expect(fetcher).toHaveBeenCalledWith("/api/duplicate-stamps-apology", expect.objectContaining({ body: '{"mode":"preview"}', headers: expect.objectContaining({ Authorization: "Bearer test-owner-session" }) }));
  await requestApology("send");
  expect(fetcher.mock.calls[1][1]?.body).toBe('{"mode":"send","confirmation":"duplicate-stamps-2026-10:send"}');
});
it("interrompe sem sessão e apresenta erro sem repetir requisição", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Somente o proprietário." }, { status: 403 }));
  await expect(requestApology("send")).rejects.toThrow("Somente o proprietário.");
  expect(fetcher).toHaveBeenCalledTimes(1);
  session.mockResolvedValue({ data: { session: null }, error: null });
  await expect(requestApology()).rejects.toThrow("Sessão obrigatória");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
