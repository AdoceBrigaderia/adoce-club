import { lazy, Suspense, useEffect, useState } from "react";
import MarketingLanding from "./MarketingLanding";
import { installPublicAnalytics } from "./analytics";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const CakeOrderExperience = lazy(() => import("./CakeOrderExperience"));
const ConfigurableProductCatalogPage = lazy(() => import("./ConfigurableProductCatalogPage"));
const AdoceHome = lazy(() => import("./AdoceHome"));
const AdoceClube = lazy(() => import("./AdoceClube"));
const AdoceEntrar = lazy(() => import("./AdoceEntrar"));
const GroupOrderPage = lazy(() => import("./GroupOrderPage"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const CustomerCheckInPage = lazy(() => import("./CustomerCheckInPage"));
const CustomerRegistrationPage = lazy(() =>
  import("./CustomerRegistrationBffPage"),
);
const PasskeyClientGateway = lazy(() => import("./PasskeyClientGateway"));
const PasskeyOperationGateway = lazy(() => import("./PasskeyOperationGateway"));
const HomologationClientAccountPreview = lazy(() =>
  import("./HomologationClientAccountPreview"),
);
const HomologationOperationPreview = lazy(() =>
  import("./HomologationOperationPreview"),
);
const SocialCampaign = lazy(() => import("./SocialCampaign"));
const LaunchCampaign = lazy(() => import("./LaunchCampaign"));

const loading = (
  <main className="access-loading">
    <p>Abrindo a experiência Adoce...</p>
  </main>
);

export function titleForRoute(hash: string) {
  if (hash.startsWith("#operacao")) return "Adoce Operação";
  if (hash.startsWith("#check-in")) return "Check-in · Clube Adoce";
  if (hash.startsWith("#adoce-hoje"))
    return "Adoce Hoje · Adoce Brigaderia";
  if (hash.startsWith("#cadastro")) return "Cadastro · Clube Adoce";
  if (hash.startsWith("#docinhos"))
    return "Docinhos · Adoce Brigaderia";
  if (hash.startsWith("#biscoitos"))
    return "Biscoitos · Adoce Brigaderia";
  if (hash.startsWith("#encomendas"))
    return "Encomendas · Adoce Brigaderia";
  if (hash.startsWith("#eventos"))
    return "Festas e eventos · Adoce Brigaderia";
  if (hash.startsWith("#adoce-na-escola"))
    return "Adoce na Escola · Adoce Brigaderia";
  if (hash.startsWith("#aluguel-decoracao"))
    return "Aluguel de decoração · Adoce Brigaderia";
  if (
    hash.startsWith("#pede-junto") ||
    hash.startsWith("#compra-em-grupo")
  )
    return "Pede Junto Adoce · Adoce Brigaderia";
  if (hash.startsWith("#politica-de-pedidos"))
    return "Política de pedidos · Adoce Brigaderia";
  if (hash.startsWith("#clube") || hash.startsWith("#minha-conta"))
    return "Clube Adoce · Adoce Brigaderia";
  if (hash.startsWith("#privacidade"))
    return "Política de Privacidade · Adoce Brigaderia";
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
  const visualValidationMode =
    import.meta.env.VITE_ADOCE_VALIDATION_MODE === "visual";

  if (location.hash.startsWith("#campanha-story"))
    return (
      <Suspense fallback={loading}>
        <SocialCampaign format="story" />
      </Suspense>
    );
  if (location.hash.startsWith("#campanha-feed"))
    return (
      <Suspense fallback={loading}>
        <SocialCampaign format="feed" />
      </Suspense>
    );
  if (location.hash.startsWith("#lancamento-story"))
    return (
      <Suspense fallback={loading}>
        <LaunchCampaign format="story" />
      </Suspense>
    );
  if (location.hash.startsWith("#lancamento-facebook"))
    return (
      <Suspense fallback={loading}>
        <LaunchCampaign format="facebook" />
      </Suspense>
    );
  if (location.hash.startsWith("#lancamento-carrossel-"))
    return (
      <Suspense fallback={loading}>
        <LaunchCampaign
          format="carousel"
          slide={Number(location.hash.split("-").at(-1)) || 1}
        />
      </Suspense>
    );
  if (location.hash.startsWith("#lancamento-feed"))
    return (
      <Suspense fallback={loading}>
        <LaunchCampaign format="feed" />
      </Suspense>
    );

  if (location.hash.startsWith("#check-in"))
    return (
      <Suspense fallback={loading}>
        <CustomerCheckInPage />
      </Suspense>
    );
  if (location.hash.startsWith("#cadastro"))
    return (
      <Suspense fallback={loading}>
        <CustomerRegistrationPage />
      </Suspense>
    );
  // O acesso por código ainda usa o fluxo atual. A nova tela permanece
  // disponível apenas para validação até o envio por WhatsApp estar pronto.
  if (location.hash.startsWith("#entrar-novo"))
    return (
      <Suspense fallback={loading}>
        <AdoceEntrar />
      </Suspense>
    );
  if (location.hash.startsWith("#clube"))
    return (
      <Suspense fallback={loading}>
        <AdoceClube />
      </Suspense>
    );

  if (
    visualValidationMode &&
    (host.startsWith("operacao.") || location.hash.startsWith("#operacao"))
  )
    return (
      <Suspense fallback={loading}>
        <HomologationOperationPreview />
      </Suspense>
    );

  if (
    visualValidationMode &&
    (host.startsWith("clube.") ||
      location.hash.startsWith("#clube") ||
      location.hash.startsWith("#entrar") ||
      location.hash.startsWith("#minha-conta") ||
      location.hash.startsWith("#acesso-direto") ||
      location.hash.startsWith("#cartao/"))
  )
    return (
      <Suspense fallback={loading}>
        <HomologationClientAccountPreview />
      </Suspense>
    );

  if (host.startsWith("operacao.") || location.hash.startsWith("#operacao"))
    return (
      <Suspense fallback={loading}>
        <PasskeyOperationGateway />
      </Suspense>
    );
  if (
    host.startsWith("clube.") ||
    location.hash.startsWith("#entrar") ||
    location.hash.startsWith("#minha-conta") ||
    location.hash.startsWith("#acesso-direto") ||
    location.hash.startsWith("#cartao/")
  )
    return (
      <Suspense fallback={loading}>
        <PasskeyClientGateway />
      </Suspense>
    );
  if (location.hash.startsWith("#adoce-hoje"))
    return (
      <Suspense fallback={loading}>
        <AdoceHoje />
      </Suspense>
    );
  if (location.hash.startsWith("#encomendas"))
    return (
      <Suspense fallback={loading}>
        <CakeOrderExperience />
      </Suspense>
    );
  if (location.hash.startsWith("#docinhos"))
    return (
      <Suspense fallback={loading}>
        <ConfigurableProductCatalogPage segment="sweets" />
      </Suspense>
    );
  if (location.hash.startsWith("#biscoitos"))
    return (
      <Suspense fallback={loading}>
        <ConfigurableProductCatalogPage segment="cookies" />
      </Suspense>
    );
  if (location.hash.startsWith("#eventos"))
    return (
      <Suspense fallback={loading}>
        <CommercialCatalog initialSegment="events" />
      </Suspense>
    );
  if (location.hash.startsWith("#adoce-na-escola"))
    return (
      <Suspense fallback={loading}>
        <ConfigurableProductCatalogPage segment="school" />
      </Suspense>
    );
  if (location.hash.startsWith("#aluguel-decoracao"))
    return (
      <Suspense fallback={loading}>
        <CommercialCatalog initialSegment="rentals" />
      </Suspense>
    );
  if (
    location.hash.startsWith("#pede-junto") ||
    location.hash.startsWith("#compra-em-grupo")
  )
    return (
      <Suspense fallback={loading}>
        <GroupOrderPage />
      </Suspense>
    );
  if (location.hash.startsWith("#politica-de-pedidos"))
    return (
      <Suspense fallback={loading}>
        <OrderPolicyPage />
      </Suspense>
    );
  if (location.hash.startsWith("#fale-com-a-adoce"))
    return (
      <Suspense fallback={loading}>
        <FeedbackPage />
      </Suspense>
    );
  if (location.hash.startsWith("#termos"))
    return (
      <Suspense fallback={loading}>
        <LegalPage kind="terms" />
      </Suspense>
    );
  if (location.hash.startsWith("#privacidade"))
    return (
      <Suspense fallback={loading}>
        <LegalPage kind="privacy" />
      </Suspense>
    );
  if (location.hash.startsWith("#home-antiga")) return <MarketingLanding />;
  return (
    <Suspense fallback={loading}>
      <AdoceHome />
    </Suspense>
  );
}
