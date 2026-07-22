import { supabase } from "./lib/supabase";

export type PublicAnalyticsEvent =
  | "page_view"
  | "whatsapp_click"
  | "product_view"
  | "prebook_start"
  | "prebook_submit"
  | "prebook_success"
  | "prebook_error"
  | "schedule_open"
  | "pede_junto_start"
  | "club_join_start";

type AnalyticsProperties = Partial<Record<
  "segment" | "product_id" | "product_slug" | "source" | "channel" | "result" | "device",
  string
>>;

const productionHosts = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
]);

export function publicAnalyticsEnabled() {
  if (typeof window === "undefined" || !supabase) return false;
  if (!productionHosts.has(window.location.hostname.toLowerCase())) return false;
  if (window.location.hash.startsWith("#operacao")) return false;
  if (window.localStorage.getItem("adoce-analytics") === "denied") return false;
  return window.navigator.doNotTrack !== "1";
}

export function currentPublicPath() {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash.split("?")[0].slice(0, 140);
  return `${window.location.pathname}${hash}`.slice(0, 160) || "/";
}

export function trackPublicEvent(eventName: PublicAnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!publicAnalyticsEnabled()) return;
  const device = window.innerWidth < 700 ? "mobile" : window.innerWidth < 1100 ? "tablet" : "desktop";
  void supabase!.rpc("record_site_analytics_event", {
    requested_event_id: crypto.randomUUID(),
    requested_event_name: eventName,
    requested_page_path: currentPublicPath(),
    requested_properties: { ...properties, device },
  }).then(() => undefined, () => undefined);
}

export function installPublicAnalytics() {
  if (typeof window === "undefined") return () => undefined;

  const recordPage = () => trackPublicEvent("page_view");
  const recordClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!target) return;
    try {
      const url = new URL(target.href, window.location.href);
      if (url.hostname === "wa.me" || url.hostname.endsWith("whatsapp.com")) {
        trackPublicEvent("whatsapp_click", { channel: "whatsapp", source: currentPublicPath() });
      }
    } catch {
      // Um link inválido não deve interferir na navegação do cliente.
    }
  };

  recordPage();
  window.addEventListener("hashchange", recordPage);
  document.addEventListener("click", recordClick, { capture: true });
  return () => {
    window.removeEventListener("hashchange", recordPage);
    document.removeEventListener("click", recordClick, { capture: true });
  };
}
