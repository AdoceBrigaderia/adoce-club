import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const bridge = readFileSync(new URL("./lib/native-operation.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");

describe("aplicativo Android da operação", () => {
  it("entra direto na operação sem mudar a rota do navegador", () => {
    expect(main).toContain('Capacitor.isNativePlatform() && window.location.pathname === "/"');
    expect(main).toContain('replaceState(null, "", "/operacao")');
  });

  it("repassa apenas a sessão pública autenticada, nunca service role", () => {
    expect(bridge).toContain("publishableKey");
    expect(bridge).toContain("session.access_token");
    expect(bridge.toLowerCase()).not.toContain("service_role");
    expect(service).toContain("EncryptedSharedPreferences");
    expect(service).toContain("MasterKey.KeyScheme.AES256_GCM");
  });

  it("usa Realtime WebSocket e serviço de dispositivo conectado", () => {
    expect(service).toContain("/realtime/v1/websocket");
    expect(service).toContain('put("event", "INSERT")');
    expect(service).toContain('put("table", "instant_orders")');
    expect(manifest).toContain('android:foregroundServiceType="connectedDevice"');
    expect(service).not.toMatch(/setInterval|scheduleAtFixedRate/);
  });

  it("mantém fila persistente e deduplica somente depois da impressão", () => {
    expect(service).toContain('putStringSet("pending"');
    expect(service).toContain('putBoolean("printed_" + id, true)');
    expect(service.indexOf("writeReceipt(receipt(order))")).toBeLessThan(service.indexOf("markPrinted(id)"));
  });

  it("fala o mesmo BLE GATT e envia pacotes curtos para a KNUP", () => {
    expect(service).toContain("000018f0-0000-1000-8000-00805f9b34fb");
    expect(service).toContain("00002af1-0000-1000-8000-00805f9b34fb");
    expect(service).toContain("start += 180");
    expect(service).toContain("Thread.sleep(24)");
  });
});
