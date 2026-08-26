import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicContactDock from "./PublicContactDock";
import SiteVisualOverrides from "./SiteVisualOverrides";
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
const publicPathRoutes: Record<string, string> = {
  "/encomendas": "#encomendas",
  "/festas": "#eventos",
  "/clube": "#clube",
};

// Links antigos enviados por WhatsApp continuam validos. A forma antiga abre
// o novo endereco canonico, sem tocar nas rotas privadas do Clube/Operacao.
if (window.location.hash === "#sabores") {
  window.location.replace("/sabores/");
} else {
  const legacyFlavor = window.location.hash.match(/^#sabores(?:\/|\?(?:slug|sabor)=)([^&/]+)\/?$/i);
  if (legacyFlavor) {
    window.location.replace(`/sabores/${encodeURIComponent(decodeURIComponent(legacyFlavor[1]))}`);
  } else if (!window.location.hash && publicPathRoutes[normalizedPath]) {
    window.history.replaceState(null, "", `${window.location.pathname}${publicPathRoutes[normalizedPath]}`);
  }
}

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
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <SiteVisualOverrides>
        <App />
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
