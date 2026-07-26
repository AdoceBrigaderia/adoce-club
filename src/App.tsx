import { lazy, Suspense, useEffect, useState } from "react";
import MarketingLanding from "./MarketingLanding";
import { installPublicAnalytics } from "./analytics";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const ClubExperience = lazy(() => import("./ClubExperience"));
const GroupOrderPage = lazy(() => import("./GroupOrderPage"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const PilotApp = lazy(() => import("./PilotApp"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const AccessApp = lazy(() => import("./AccessApp"));
const SocialCampaign = lazy(() => import("./SocialCampaign"));
const LaunchCampaign = lazy(() => import("./LaunchCampaign"));

const MemberDemo = import.meta.env.DEV
  ? lazy(() => import("./AccessApp").then((module) => ({ default: module.MemberDemo })))
  : null;
const OperationDemo = import.meta.env.DEV
  ? lazy(() => import("./AccessApp").then((module) => ({ default: module.OperationDemo })))
  : null;
const OperationV2Demo = import.meta.env.DEV
  ? lazy(() => import("./operation-v2/OperationV2Demo"))
  : null;
const ProductionRollbackDemo = import.meta.env.DEV
  ? lazy(() => import("./ProductionRollbackPanel").then((module) => ({ default: module.ProductionRollbackDemo })))
  : null;

const loading = <main className="access-loading"><p>Abrindo a experiência Adoce...</p></main>;

export function titleForRoute(hash: string) {
  if (hash.startsWith("#operacao")) return "Adoce Operação";
  if (hash.startsWith("#adoce-hoje")) return "Adoce Hoje · Adoce Brigaderia";
  if (hash.startsWith("#cadastro")) return "Cadastro · Clube Adoce";
  if (hash.startsWith("#docinhos")) return "Docinhos · Adoce Brigaderia";
  if (hash.startsWith("#encomendas")) return "Encomendas · Adoce Brigaderia";
  if (hash.startsWith("#eventos")) return "Festas e eventos · Adoce Brigaderia";
  if (hash.startsWith("#adoce-na-escola")) return "Adoce na Escola · Adoce Brigaderia";
  if (hash.startsWith("#aluguel-decoracao")) return "Aluguel de decoração · Adoce Brigaderia";
  if (hash.startsWith("#pede-junto") || hash.startsWith("#compra-em-grupo")) return "Pede Junto Adoce · Adoce Brigaderia";
  if (hash.startsWith("#politica-de-pedidos")) return "Política de pedidos · Adoce Brigaderia";
  if (hash.startsWith("#clube")) return "Clube Adoce · Adoce Brigaderia";
  if (hash.startsWith("#privacidade")) return "Política de Privacidade · Adoce Brigaderia";
  if (hash.startsWith("#termos")) return "Termos do Clube Adoce";
  if (hash.startsWith("#fale-com-a-adoce")) return "Fale com a Adoce";
  return "Adoce Brigaderia | Fatias artesanais e Clube Adoce em Fortaleza";
}

export default function App() {
  const [, refreshRoute] = useState(0);

  useEffect(() => installPublicAnalytics(), []);
  useEffect(() => {
    const handleHashChange = () => {
      refreshRoute((version) => version + 1);
      document.title = titleForRoute(location.hash);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const host = location.hostname.toLowerCase();
  if (location.hash.startsWith("#campanha-story")) return <Suspense fallback={loading}><SocialCampaign format="story" /></Suspense>;
  if (location.hash.startsWith("#campanha-feed")) return <Suspense fallback={loading}><SocialCampaign format="feed" /></Suspense>;
  if (location.hash.startsWith("#lancamento-story")) return <Suspense fallback={loading}><LaunchCampaign format="story" /></Suspense>;
  if (location.hash.startsWith("#lancamento-facebook")) return <Suspense fallback={loading}><LaunchCampaign format="facebook" /></Suspense>;
  if (location.hash.startsWith("#lancamento-carrossel-")) return <Suspense fallback={loading}><LaunchCampaign format="carousel" slide={Number(location.hash.split("-").at(-1)) || 1} /></Suspense>;
  if (location.hash.startsWith("#lancamento-feed")) return <Suspense fallback={loading}><LaunchCampaign format="feed" /></Suspense>;

  if (import.meta.env.DEV && MemberDemo && location.hash.startsWith("#membro-demo")) return <Suspense fallback={loading}><MemberDemo /></Suspense>;
  if (import.meta.env.DEV && OperationV2Demo && location.hash.startsWith("#operacao-v2")) return <Suspense fallback={loading}><OperationV2Demo /></Suspense>;
  if (import.meta.env.DEV && OperationDemo && location.hash.startsWith("#operacao-demo")) return <Suspense fallback={loading}><OperationDemo /></Suspense>;
  if (import.meta.env.DEV && ProductionRollbackDemo && location.hash.startsWith("#restauracao-demo")) return <Suspense fallback={loading}><ProductionRollbackDemo /></Suspense>;

  if (host.startsWith("operacao.") || location.hash.startsWith("#operacao")) return <Suspense fallback={loading}><AccessApp surface="operation" /></Suspense>;
  if (host.startsWith("clube.") || location.hash.startsWith("#entrar") || location.hash.startsWith("#cadastro") || location.hash.startsWith("#minha-conta") || location.hash.startsWith("#acesso-direto")) return <Suspense fallback={loading}><AccessApp surface="client" /></Suspense>;
  if (location.hash.startsWith("#adoce-hoje")) return <Suspense fallback={loading}><AdoceHoje /></Suspense>;
  if (location.hash.startsWith("#encomendas")) return <Suspense fallback={loading}><CommercialCatalog initialSegment="cakes" /></Suspense>;
  if (location.hash.startsWith("#docinhos")) return <Suspense fallback={loading}><CommercialCatalog initialSegment="sweets" /></Suspense>;
  if (location.hash.startsWith("#eventos")) return <Suspense fallback={loading}><CommercialCatalog initialSegment="events" /></Suspense>;
  if (location.hash.startsWith("#adoce-na-escola")) return <Suspense fallback={loading}><CommercialCatalog initialSegment="school" /></Suspense>;
  if (location.hash.startsWith("#aluguel-decoracao")) return <Suspense fallback={loading}><CommercialCatalog initialSegment="rentals" /></Suspense>;
  if (location.hash.startsWith("#pede-junto") || location.hash.startsWith("#compra-em-grupo")) return <Suspense fallback={loading}><GroupOrderPage /></Suspense>;
  if (location.hash.startsWith("#politica-de-pedidos")) return <Suspense fallback={loading}><OrderPolicyPage /></Suspense>;
  if (location.hash.startsWith("#fale-com-a-adoce")) return <Suspense fallback={loading}><FeedbackPage /></Suspense>;
  if (location.hash.startsWith("#clube")) return <Suspense fallback={loading}><ClubExperience /></Suspense>;
  if (location.hash.startsWith("#termos")) return <Suspense fallback={loading}><LegalPage kind="terms" /></Suspense>;
  if (location.hash.startsWith("#privacidade")) return <Suspense fallback={loading}><LegalPage kind="privacy" /></Suspense>;

  const pilotToken = location.hash.match(/^#cartao\/([a-f0-9-]+)$/i)?.[1];
  if (pilotToken) return <Suspense fallback={loading}><PilotApp token={pilotToken} /></Suspense>;
  if (import.meta.env.DEV && location.hash.startsWith("#festival")) return <Suspense fallback={loading}><PilotApp /></Suspense>;
  return <MarketingLanding />;
}
