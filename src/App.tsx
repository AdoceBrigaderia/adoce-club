import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import AdoceHome from "./AdoceHome";
const AdoceEntrar = lazy(() => import("./AdoceEntrar"));
const AdoceClube = lazy(() => import("./AdoceClube"));
import PublicHeader from "./PublicHeader";
import PublicMobileNav, { type PublicMobileArea } from "./PublicMobileNav";
import { installPublicAnalytics } from "./analytics";
import { tokenDoMagicLink } from "./identidade-do-clube";
import { currentRouteHash } from "./route-paths";
import "./public-mobile-fixes.css";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const CakeCatalogPage = lazy(() => import("./CakeCatalogPage"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const PilotApp = lazy(() => import("./PilotApp"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const AdoceHomeCatalog = lazy(() => import("./AdoceHomeCatalog"));
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

export default function App(){
  const [, refreshRoute] = useState(0);
  useEffect(() => installPublicAnalytics(), []);
  useEffect(() => {
    const handleHashChange = () => {
      const routeHash = currentRouteHash();
      refreshRoute(version => version + 1);
      document.title = location.pathname.startsWith("/operacao") || routeHash.startsWith("#operacao")
        ? "Adoce Operação"
          : routeHash.startsWith("#adoce-hoje")
            ? "Fatias · Adoce Brigaderia"
          : routeHash.startsWith("#cardapio-fatias")
            ? "Cardápio de Fatias · Adoce Brigaderia"
          : routeHash.startsWith("#cadastro")
            ? "Cadastro · Clube Adoce"
          : routeHash.startsWith("#docinhos")
            ? "Docinhos · Adoce Brigaderia"
          : routeHash.startsWith("#carrinho")
            ? "Seu pedido · Adoce Brigaderia"
          : routeHash.startsWith("#encomendas")
            ? "Tortas · Adoce Brigaderia"
                : routeHash.startsWith("#politica-de-pedidos")
                  ? "Política de pedidos · Adoce Brigaderia"
                : routeHash.startsWith("#clube")
                  ? "Clube Adoce · Adoce Brigaderia"
            : routeHash.startsWith("#privacidade")
              ? "Política de Privacidade · Adoce Brigaderia"
                : routeHash.startsWith("#termos")
                  ? "Termos do Clube Adoce"
                : routeHash.startsWith("#fale-com-a-adoce")
                  ? "Fale com a Adoce"
                : "Adoce Brigaderia | Fatias artesanais e Clube Adoce em Fortaleza";
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
  const retiredDemoRoutes = ["#prototipo", "#membro-demo", "#operacao-demo", "#operacao-v2", "#restauracao-demo", "#home-antiga"];
  if (retiredDemoRoutes.includes(routeHash)) return <PublicSurface active="home"><AdoceHome /></PublicSurface>;
  if (tokenDoMagicLink(location.hash)) return <CustomerSurface><AccessApp surface="client"/></CustomerSurface>;
  if (routeHash === "#sabores") {
    window.location.replace("/sabores/");
    return <>{loading}</>;
  }
  if ((location.pathname.replace(/\/+$/, "") || "/") === "/sabores") return <PublicSurface active="today"><FlavorCatalogRoute /></PublicSurface>;
  if(routeHash.startsWith("#campanha-") || routeHash.startsWith("#lancamento-")) return <PublicSurface active="home"><AdoceHome /></PublicSurface>;
  if (location.pathname === "/operacao" || location.pathname.startsWith("/operacao/") || host.startsWith("operacao.") || socialAuthReturn === "operacao" || routeHash.startsWith("#operacao")) return <Suspense fallback={loading}><AccessApp surface="operation"/></Suspense>;
  // Login por WhatsApp: a tela existe mas o envio de codigo ainda nao esta
  // ligado (falta a Cloud API da Meta). Ate la, #entrar continua no fluxo
  // atual que funciona, e a tela nova fica visivel so em #entrar-novo.
  if(routeHash.startsWith("#entrar-novo"))return <PublicSurface active="club"><AdoceEntrar/></PublicSurface>;
  if(routeHash.startsWith("#clube") || routeHash.startsWith("#indicar"))return <PublicSurface active="club"><AdoceClube/></PublicSurface>;
  if (host.startsWith("clube.") || socialAuthReturn === "clube" || routeHash.startsWith("#entrar") || routeHash.startsWith("#cadastro") || routeHash.startsWith("#minha-conta") || routeHash.startsWith("#acesso-direto")) return <CustomerSurface><AccessApp surface="client"/></CustomerSurface>;
  if(routeHash.startsWith("#adoce-hoje"))return <PublicSurface active="today"><AdoceHoje/></PublicSurface>;
  if(routeHash.startsWith("#cardapio-fatias"))return <PublicSurface active="orders"><SliceMenuPage/></PublicSurface>;
  if(routeHash.startsWith("#carrinho"))return <PublicSurface active="cart"><AdoceHoje openCartOnLoad/></PublicSurface>;
  if(routeHash.startsWith("#encomendas/solicitar"))return <PublicSurface active="orders"><CommercialCatalog initialSegment="cakes" requestOnly/></PublicSurface>;
  if(routeHash.startsWith("#encomendas"))return <PublicSurface active="orders"><CakeCatalogPage/></PublicSurface>;
  if(routeHash.startsWith("#docinhos"))return <PublicSurface active="orders"><CommercialCatalog initialSegment="sweets"/></PublicSurface>;
  if(routeHash.startsWith("#pede-junto") || routeHash.startsWith("#compra-em-grupo"))return <PublicSurface active="today"><AdoceHoje/></PublicSurface>;
  if(routeHash.startsWith("#politica-de-pedidos"))return <PublicSurface active="orders"><OrderPolicyPage/></PublicSurface>;
  if(routeHash.startsWith("#fale-com-a-adoce"))return <PublicSurface><FeedbackPage/></PublicSurface>;
  if(routeHash.startsWith("#termos"))return <PublicSurface><LegalPage kind="terms"/></PublicSurface>;
  if(routeHash.startsWith("#privacidade"))return <PublicSurface><LegalPage kind="privacy"/></PublicSurface>;
  if(import.meta.env.DEV && routeHash.startsWith("#festival"))return <Suspense fallback={loading}><PilotApp/></Suspense>;
  return <PublicSurface active="home"><AdoceHomeCatalog/></PublicSurface>
}
