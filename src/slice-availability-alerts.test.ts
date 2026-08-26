import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const today = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
const viewer = readFileSync(new URL("./ProductImageViewer.tsx", import.meta.url), "utf8");
const viewerCss = readFileSync(new URL("./product-image-viewer.css", import.meta.url), "utf8");
const operation = readFileSync(new URL("./OperationSliceAlerts.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260804185307_slice_availability_alerts.sql", import.meta.url), "utf8");

describe("avisos de disponibilidade e imagens de produto", () => {
  it("não cobre mais a foto indisponível com o selo circular", () => {
    expect(today).toContain("Avise quando voltar");
    expect(today).not.toContain('className={`today-availability-seal ${flavor.status === "preorder_only" ? "upcoming" : flavor.available ? "available" : "unavailable"}`');
  });

  it("amplia a imagem inteira sem corte ou distorção", () => {
    expect(viewer).toContain('role="dialog"');
    expect(viewerCss).toContain("object-fit:contain!important");
    expect(viewerCss).toContain("max-height:calc(100dvh - 92px)");
  });

  it("leva a fatia avisada diretamente ao carrinho", () => {
    expect(operation).toContain("#carrinho?flavor=");
    expect(today).toContain('get("flavor")');
  });

  it("protege os contatos com RLS e grava o público somente por RPC", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.slice_availability_alerts from public, anon, authenticated");
    expect(migration).toContain("subscribe_slice_availability_alert");
    expect(migration).toContain("grant execute on function public.subscribe_slice_availability_alert");
    expect(migration).toContain("slice_availability_alerts_staff_read");
  });

  it("evita avisos duplicados e cria a fila quando o sabor volta", () => {
    expect(migration).toContain("unique (flavor_id, phone_e164)");
    expect(migration).toContain("queue_slice_availability_alerts");
    expect(migration).toContain("availability_cycle = availability_cycle + 1");
  });
});
