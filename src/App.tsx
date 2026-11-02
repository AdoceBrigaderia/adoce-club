import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import PublicTopBar from "./PublicTopBar";
import PublicFooter from "./PublicFooter";
import PublicMobileNav, { type PublicMobileArea } from "./PublicMobileNav";
import { installPublicAnalytics } from "./analytics";
import { tokenDoMagicLink } from "./identidade-do-clube";
import { currentRouteHash } from "./route-paths";
import "./public-mobile-fixes.css";
import "./cardapio-2026.css";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const CakeCatalogPage = lazy(() => import("./CakeCatalogPage"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const PilotApp = lazy(() => import("./PilotApp"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const AdoceHomeCatalog = lazy(() => import("./AdoceHomeCatalog"));
const AdoceLandingPage = lazy(() => import("./AdoceLandingPage"));
const CatalogPage2026 = lazy(() => import("./CatalogPage2026"));
const AcompanharPedidoPage = lazy(() => import("./AcompanharPedidoPage"));
const AccessApp = lazy(() => import("./AccessApp"));

const loading = <main className="access-loading"><p>Abrindo a experiência Adoce...</p></main>;

function PublicSurface({ children, active, cart = false }: { children: ReactNode; active?: PublicMobileArea; cart?: boolean }) {
  if (cart) return <div className="public-app-shell public-app-shell-cart"><Suspense fallback={loading}>{children}</Suspense></div>;
  return <div className={`public-app-shell public-app-shell-${active || "none"}`}><PublicTopBar /><Suspense fallback={loading}>{children}</Suspense><PublicFooter />{active !== "home" && <PublicMobileNav active={active} />}</div>;
}

function CustomerSurface({ children }: { children: ReactNode; minimal?: boolean }) {
  return <div className="public-app-shell customer-app-shell"><PublicTopBar /><Suspense fallback={loading}>{children}</Suspense><PublicFooter /><PublicMobileNav active="club" /></div>;
}

export default function App(){
  const [, refreshRoute] = useState(0);
  useEffect(() => installPublicAnalytics(), []);
  useEffect(() => {
    const handleHashChange = () => {
      const routeHash = currentRouteHash();
      refreshRoute(version => version + 1);
      document.title = location.pathname.startsWith("/operacao") || routeHash.startsWith("#operacao")
        ? "Adoce Operação"
          : routeHash.startsWith("#cardapio") || routeHash.startsWith("#adoce-hoje")
            ? "Fatias · Cantinho da Adoce"
          : routeHash.startsWith("#sabores")
            ? "Sabores · Cantinho da Adoce"
          : routeHash.startsWith("#cadastro") || routeHash.startsWith("#clube/cadastro")
            ? "Cadastro · Clube Adoce"
          : routeHash.startsWith("#docinhos")
            ? "Docinhos · Cantinho da Adoce"
          : routeHash.startsWith("#carrinho")
            ? "Seu pedido · Cantinho da Adoce"
          : routeHash.startsWith("#encomendas")
            ? "Tortas · Cantinho da Adoce"
                : routeHash.startsWith("#politica-de-pedidos")
                  ? "Política de pedidos · Cantinho da Adoce"
                : routeHash.startsWith("#clube")
                  ? "Clube Adoce · Cantinho da Adoce"
            : routeHash.startsWith("#privacidade")
              ? "Política de Privacidade · Cantinho da Adoce"
                : routeHash.startsWith("#termos")
                  ? "Termos do Clube Adoce"
                : routeHash.startsWith("#fale-com-a-adoce")
                  ? "Fale com a Adoce"
                : routeHash.startsWith("#catalogo")
                  ? "Catálogo de Tortas e Docinhos 2026 · Cantinho da Adoce"
                : routeHash.startsWith("#acompanhar")
                  ? "Acompanhar pedido · Cantinho da Adoce"
                : "Cantinho da Adoce | Fatias artesanais e Clube Adoce em Fortaleza";
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    window.addEventListener("adoce-routechange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
      window.removeEventListener("adoce-routechange", handleHashChange);
    };
  }, []);
  const routeHash = currentRouteHash();
  const host = location.hostname.toLowerCase();
  const socialAuthReturn = new URLSearchParams(location.search).get("auth_return");
  if (tokenDoMagicLink(location.hash)) return <CustomerSurface><AccessApp surface="client"/></CustomerSurface>;
  if (location.pathname === "/operacao" || location.pathname.startsWith("/operacao/") || host.startsWith("operacao.") || socialAuthReturn === "operacao" || routeHash.startsWith("#operacao")) return <Suspense fallback={loading}><AccessApp surface="operation"/></Suspense>;
  if(routeHash.startsWith("#clube/cadastro"))return <CustomerSurface minimal><AccessApp surface="client"/></CustomerSurface>;
  if(routeHash.startsWith("#clube"))return <CustomerSurface minimal><AccessApp surface="client"/></CustomerSurface>;
  if (host.startsWith("clube.") || socialAuthReturn === "clube" || routeHash.startsWith("#entrar") || routeHash.startsWith("#cadastro") || routeHash.startsWith("#minha-conta") || routeHash.startsWith("#acesso-direto")) return <CustomerSurface><AccessApp surface="client"/></CustomerSurface>;
  if(routeHash.startsWith("#adoce-hoje") || routeHash.startsWith("#encomendas") || routeHash.startsWith("#indicar")){
    if(typeof history!=="undefined")history.replaceState(null,"","/");
    return <PublicSurface active="home"><AdoceLandingPage/></PublicSurface>;
  }
  if(routeHash.startsWith("#cardapio"))return <PublicSurface active="today"><AdoceHomeCatalog/></PublicSurface>;
  if(routeHash.startsWith("#sabores"))return <PublicSurface active="catalog"><CakeCatalogPage/></PublicSurface>;
  if(routeHash.startsWith("#carrinho"))return <PublicSurface cart><AdoceHoje openCartOnLoad/></PublicSurface>;
  if(routeHash.startsWith("#docinhos"))return <PublicSurface active="catalog"><CommercialCatalog initialSegment="sweets"/></PublicSurface>;
  if(routeHash.startsWith("#politica-de-pedidos"))return <PublicSurface active="orders"><OrderPolicyPage/></PublicSurface>;
  if(routeHash.startsWith("#fale-com-a-adoce"))return <PublicSurface><FeedbackPage/></PublicSurface>;
  if(routeHash.startsWith("#termos"))return <PublicSurface><LegalPage kind="terms"/></PublicSurface>;
  if(routeHash.startsWith("#privacidade"))return <PublicSurface><LegalPage kind="privacy"/></PublicSurface>;
  if(routeHash.startsWith("#catalogo"))return <PublicSurface active="catalog"><CatalogPage2026/></PublicSurface>;
  if(routeHash.startsWith("#acompanhar"))return <PublicSurface><AcompanharPedidoPage/></PublicSurface>;
  if(import.meta.env.DEV && routeHash.startsWith("#festival"))return <Suspense fallback={loading}><PilotApp/></Suspense>;
  return <PublicSurface active="home"><AdoceLandingPage/></PublicSurface>
}
