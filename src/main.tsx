import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicContactDock from "./PublicContactDock";
import SiteVisualOverrides from "./SiteVisualOverrides";
import { tokenDoMagicLink } from "./identidade-do-clube";
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
const legacyHashRoutes: Record<string, string> = {
  inicio: "/",
  "adoce-hoje": "/fatias",
  "cardapio-fatias": "/cardapio-de-fatias",
  carrinho: "/pedido",
  encomendas: "/tortas",
  docinhos: "/docinhos",
  eventos: "/festas",
  "adoce-na-escola": "/adoce-na-escola",
  "aluguel-decoracao": "/aluguel-decoracao",
  "politica-de-pedidos": "/politica-de-pedidos",
  clube: "/clube",
  indicar: "/clube/indicar",
  entrar: "/clube/entrar",
  "entrar-novo": "/clube/entrar",
  cadastro: "/clube/cadastro",
  "minha-conta": "/clube",
  "fale-com-a-adoce": "/fale-com-a-adoce",
  termos: "/termos",
  privacidade: "/privacidade",
  operacao: "/operacao",
  "operacao-clientes": "/operacao/clientes",
  "operacao-vendas": "/operacao/pedidos?tipo=vendas",
  "operacao-pedidos": "/operacao/pedidos?tipo=encomendas",
  "operacao-catalogo-comercial": "/operacao/pedidos?tipo=catalogo",
  "operacao-produtos": "/operacao/produtos",
  "operacao-configuracoes": "/operacao/configuracoes",
};

// Links antigos enviados por WhatsApp continuam validos. A forma antiga abre
// o novo endereco canonico, sem tocar nas rotas privadas do Clube/Operacao.
if (normalizedPath === "/clube/minha-conta") {
  window.location.replace(`/clube${window.location.search}${window.location.hash}`);
} else if (window.location.hash === "#sabores") {
  window.location.replace("/sabores/");
} else {
  const legacyFlavor = window.location.hash.match(/^#sabores(?:\/|\?(?:slug|sabor)=)([^&/]+)\/?$/i);
  if (legacyFlavor) {
    window.location.replace(`/sabores/${encodeURIComponent(decodeURIComponent(legacyFlavor[1]))}`);
  } else if (window.location.hash && !tokenDoMagicLink(window.location.hash)) {
    const legacy = window.location.hash.slice(1);
    const [legacyRoute, legacyQuery = ""] = legacy.split("?", 2);
    const directAccess = legacyRoute === "acesso-direto" ? "/clube/acesso-direto" : null;
    const cardToken = legacyRoute.startsWith("cartao/") ? `/clube/${legacyRoute}` : null;
    const destination = directAccess || cardToken || legacyHashRoutes[legacyRoute];
    if (destination) {
      const separator = destination.includes("?") ? "&" : "?";
      window.location.replace(`${destination}${legacyQuery ? `${separator}${legacyQuery}` : ""}`);
    }
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

// A mesma porta pode ter sido usada antes por uma prévia de produção. Nesse
// caso, o service worker antigo continua controlando a origem e pode entregar
// bundles removidos, deixando a homologação local em branco. Em desenvolvimento
// limpamos somente os registros desta origem e os caches nomeados pela Adoce.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    );

  if ("caches" in window) {
    void caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("clube-adoce-"))
            .map((key) => caches.delete(key)),
        ),
      );
  }
}

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
