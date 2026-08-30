import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import MarketingLanding from "./MarketingLanding";
import PublicHeader from "./PublicHeader";
import PublicMobileNav, { type PublicMobileArea } from "./PublicMobileNav";
import { installPublicAnalytics } from "./analytics";
import { tokenDoMagicLink } from "./identidade-do-clube";
import "./public-mobile-fixes.css";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const SliceMenuPage = lazy(() => import("./SliceMenuPage"));
const FlavorCatalogRoute = lazy(() => import("./FlavorCatalogRoute"));
const AccessApp = lazy(() => import("./AccessApp"));

const loading = <main className="access-loading"><p>Abrindo a experiência Adoce...</p></main>;

function PublicSurface({ children, active }: { children: ReactNode; active?: PublicMobileArea }) {
  return <div className="public-app-shell"><PublicHeader /><Suspense fallback={loading}>{children}</Suspense><p className="public-signature">Doce feito com afeto, para celebrar cada momento.</p><PublicMobileNav active={active} /></div>;
}

function CustomerSurface({ children }: { children: ReactNode }) {
  return <div className="public-app-shell customer-app-shell"><PublicHeader /><Suspense fallback={loading}>{children}</Suspense><p className="public-signature">Doce feito com afeto, para celebrar cada momento.</p><PublicMobileNav active="club" /></div>;
}

const pageTitles: Record<string, string> = {
  "/": "Adoce Brigaderia | Tudo o que você encontra aqui",
  "/fatias": "Fatias de hoje · Adoce",
  "/cardapio-de-fatias": "Cardápio de Fatias · Adoce",
  "/pedido": "Seu pedido · Adoce",
  "/tortas": "Tortas por encomenda · Adoce",
  "/docinhos": "Docinhos · Adoce",
  "/festas": "Festas e eventos · Adoce",
  "/adoce-na-escola": "Adoce na Escola · Adoce Brigaderia",
  "/aluguel-decoracao": "Aluguel de decoração · Adoce",
  "/politica-de-pedidos": "Política de pedidos · Adoce",
  "/clube": "Clube Adoce · Adoce",
  "/clube/cadastro": "Cadastro · Clube Adoce",
  "/clube/entrar": "Entrar · Clube Adoce",
  "/privacidade": "Política de Privacidade · Adoce",
  "/termos": "Termos do Clube Adoce",
  "/fale-com-a-adoce": "Fale com a Adoce",
};

export default function App() {
  const [, refreshRoute] = useState(0);
  useEffect(() => installPublicAnalytics(), []);
  useEffect(() => {
    const handleRouteChange = () => {
      refreshRoute((version) => version + 1);
      const path = location.pathname.replace(/\/+$/, "") || "/";
      document.title = path.startsWith("/operacao")
        ? "Adoce Operação"
        : pageTitles[path] || "Adoce Brigaderia";
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    handleRouteChange();
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  const host = location.hostname.toLowerCase();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const socialAuthReturn = new URLSearchParams(location.search).get("auth_return");

  if (tokenDoMagicLink(location.hash)) return <CustomerSurface><AccessApp surface="client" /></CustomerSurface>;
  if (path === "/sabores") return <PublicSurface active="today"><FlavorCatalogRoute /></PublicSurface>;
  if (host.startsWith("operacao.") || socialAuthReturn === "operacao" || path.startsWith("/operacao")) return <Suspense fallback={loading}><AccessApp surface="operation" /></Suspense>;
  if (host.startsWith("clube.") || socialAuthReturn === "clube" || path === "/clube" || path.startsWith("/clube/")) return <CustomerSurface><AccessApp surface="client" /></CustomerSurface>;
  if (path === "/fatias") return <PublicSurface active="today"><AdoceHoje /></PublicSurface>;
  if (path === "/cardapio-de-fatias") return <PublicSurface active="orders"><SliceMenuPage /></PublicSurface>;
  if (path === "/pedido") return <PublicSurface active="cart"><AdoceHoje openCartOnLoad /></PublicSurface>;
  if (path === "/tortas") return <PublicSurface active="orders"><CommercialCatalog initialSegment="cakes" /></PublicSurface>;
  if (path === "/docinhos") return <PublicSurface active="orders"><CommercialCatalog initialSegment="sweets" /></PublicSurface>;
  if (path === "/festas") return <PublicSurface active="orders"><CommercialCatalog initialSegment="events" /></PublicSurface>;
  if (path === "/adoce-na-escola") return <PublicSurface active="orders"><CommercialCatalog initialSegment="school" /></PublicSurface>;
  if (path === "/aluguel-decoracao") return <PublicSurface active="orders"><CommercialCatalog initialSegment="rentals" /></PublicSurface>;
  if (path === "/politica-de-pedidos") return <PublicSurface active="orders"><OrderPolicyPage /></PublicSurface>;
  if (path === "/fale-com-a-adoce") return <PublicSurface><FeedbackPage /></PublicSurface>;
  if (path === "/termos") return <PublicSurface><LegalPage kind="terms" /></PublicSurface>;
  if (path === "/privacidade") return <PublicSurface><LegalPage kind="privacy" /></PublicSurface>;
  return <PublicSurface active="home"><MarketingLanding /></PublicSurface>;
}
