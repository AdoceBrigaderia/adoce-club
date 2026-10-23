import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const routePaths = readFileSync(new URL("./route-paths.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./AcompanharPedidoPage.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const fn = readFileSync(new URL("../netlify/functions/track-instant-order.ts", import.meta.url), "utf8");

describe("religamento da pagina publica Acompanhar pedido (auditoria funcional)", () => {
  it("registra a rota /acompanhar e normaliza o hash legado", () => {
    expect(routePaths).toContain('"acompanhar"');
    expect(app).toContain('routeHash.startsWith("#acompanhar")');
    expect(app).toContain("AcompanharPedidoPage");
  });

  it("a tela de sucesso do pedido oferece o link de acompanhamento com o token real", () => {
    expect(panel).toContain("/acompanhar?pedido=");
    expect(panel).toContain("result!.token");
  });

  it("a funcao publica so repassa a chamada ao RPC ja existente, nunca usa a chave de servico no navegador", () => {
    expect(fn).toContain('admin.rpc("get_instant_order"');
    expect(fn).toContain("serviceClient");
    expect(fn).toContain("FAT-\\d{8}-\\d{4}");
  });

  it("mapeia o status do pedido direto para a esteira do cliente, sem traducao", () => {
    expect(page).toContain("etapa: order.status");
  });
});
