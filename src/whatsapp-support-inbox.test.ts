import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./WhatsAppSupportInbox.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./whatsapp-support-inbox.css", import.meta.url), "utf8");

describe("conversa humana do WhatsApp", () => {
  it("acompanha automaticamente a mensagem mais recente", () => {
    expect(component).toContain("messageListRef");
    expect(component).toContain("messageList.scrollTop = messageList.scrollHeight");
    expect(component).toContain("thread?.messages?.length");
    expect(component).toContain('channel("whatsapp-support-realtime")');
    expect(component).toContain('table: "operation_notifications"');
    expect(component).toContain('event_type=eq.whatsapp.support.message');
    expect(component).toContain('event.key === "Enter" && !event.shiftKey');
    expect(component).toContain("setPendingReply");
    expect(component).toContain("Enviandoâ€¦");
  });

  it("recarrega ao voltar o foco e mantem polling leve (WebView do tablet suspende o realtime em segundo plano)", () => {
    expect(component).toContain('addEventListener("visibilitychange"');
    expect(component).toContain('window.addEventListener("focus"');
    expect(component).toContain("setInterval(resync, 30_000)");
    // e continua chamando a API pelo origin de producao no app nativo
    expect(component).toContain("Capacitor.isNativePlatform() ? productionApiOrigin");
  });

  it("mantem texto digitado e baloes legiveis no WebView Android", () => {
    expect(styles).toContain("-webkit-text-fill-color: #3b160f");
    expect(styles).toContain("caret-color: #3b160f");
    expect(styles).toContain("article p { margin: 0; color: #3b160f");
  });

  it("usa uma unica rolagem em tablets e outros dispositivos de toque", () => {
    expect(styles).toContain("@media (hover: none) and (pointer: coarse)");
    expect(styles).toContain("max-height: none");
    expect(styles).toContain("overflow-y: visible");
    expect(styles).toContain("touch-action: pan-y");
  });
});
