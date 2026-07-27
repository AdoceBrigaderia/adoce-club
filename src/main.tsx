import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./AppErrorBoundary";
import { installBrowserBootstrap } from "./browser-bootstrap";
import { installCustomerCheckInReturn } from "./customer-checkin-return";
import { installCustomerNameNormalization } from "./customer-name-normalization";
import HomologationValidationBanner, {
  isVisualValidationMode,
} from "./HomologationValidationBanner";
import HomologationVisualNavigator from "./HomologationVisualNavigator";
import PublicContactDock from "./PublicContactDock";
import SiteVisualOverrides from "./SiteVisualOverrides";
import {
  PRELOAD_RECOVERY_STORAGE_KEY,
  recoveryTimestamp,
  shouldRecoverPreloadError,
} from "./runtime-recovery";
import "./customer-name-normalization.css";
import "./homologation-validation.css";
import "./styles.css";
import "./theme.css";

const visualValidationMode = isVisualValidationMode(
  import.meta.env.VITE_ADOCE_VALIDATION_MODE,
);
const removeBrowserBootstrap = installBrowserBootstrap();
const removeCustomerCheckInReturn = installCustomerCheckInReturn();
const removeCustomerNameNormalization = installCustomerNameNormalization();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    removeBrowserBootstrap();
    removeCustomerCheckInReturn();
    removeCustomerNameNormalization();
  });

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const lastReload = recoveryTimestamp(sessionStorage);
  if (!shouldRecoverPreloadError(lastReload)) return;
  sessionStorage.setItem(PRELOAD_RECOVERY_STORAGE_KEY, String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <SiteVisualOverrides>
        <HomologationValidationBanner />
        <App />
        <HomologationVisualNavigator />
        <PublicContactDock />
      </SiteVisualOverrides>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if (!visualValidationMode && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    void navigator.serviceWorker.register("/sw.js"),
  );
}
