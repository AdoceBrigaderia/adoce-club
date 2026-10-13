import { Capacitor } from "@capacitor/core";
import { installNativeApiFetch } from "./lib/native-api";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicContactDock from "./PublicContactDock";
import PersistentTableHeaders from "./PersistentTableHeaders";
import SiteVisualOverrides from "./SiteVisualOverrides";
import { navigateRoute, normalizeLegacyRoute, pathFromLegacyHash } from "./route-paths";
import "./styles.css";
import "./theme.css";
import "./public-visual-2026.css";
import "./adoce-app-2026.css";
import "./adoce-mobile-first-2026.css";
import "./home-reference-2026.css";
import "./public-shell-2026.css";
import "./catalogo-de-sabores.css";
// Fonte unica da identidade. Entra por ultimo de proposito: os apelidos
// (--pink, --access-coral, --m-coral...) precisam vencer as declaracoes
// antigas para que a paleta correta da logo alcance as 68 folhas.
import "./adoce-tokens.css";

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
// Links antigos enviados por WhatsApp continuam validos. A forma antiga abre
// o novo endereco canonico, sem tocar nas rotas privadas do Clube/Operacao.
if (window.location.hash === "#sabores") {
  window.location.replace("/sabores/");
} else {
  const legacyFlavor = window.location.hash.match(/^#sabores(?:\/|\?(?:slug|sabor)=)([^&/]+)\/?$/i);
  if (legacyFlavor) {
    window.location.replace(`/sabores/${encodeURIComponent(decodeURIComponent(legacyFlavor[1]))}`);
  } else normalizeLegacyRoute();
}

window.addEventListener("hashchange", () => {
  if (normalizeLegacyRoute()) window.dispatchEvent(new Event("adoce-routechange"));
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin) return;
  const path = pathFromLegacyHash(url.hash);
  if (!path) return;
  event.preventDefault();
  navigateRoute(path);
});

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloadKey = "adoce-preload-recovery";
  const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload < 10_000) return;
  sessionStorage.setItem(reloadKey, String(Date.now()));
  window.location.reload();
});

// As paginas de sabor ja chegam completas no HTML. Nelas o React nao substitui
// o conteudo pre-renderizado; assim o mesmo documento serve ao Google e a quem
// navega sem JavaScript.
if (!document.querySelector("[data-seo-static-page]") || normalizedPath === "/sabores") {
  installNativeApiFetch();
if (Capacitor.isNativePlatform() && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/operacao");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <SiteVisualOverrides>
        <App />
        <PersistentTableHeaders />
        <PublicContactDock />
      </SiteVisualOverrides>
    </React.StrictMode>,
  );
}

// Keep the production PWA cache from intercepting Vite source modules during
// local development. A previously registered worker can otherwise serve stale
// imports and make a healthy checkout look broken.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
