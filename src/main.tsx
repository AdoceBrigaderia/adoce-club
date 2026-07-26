import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./AppErrorBoundary";
import { installBrowserBootstrap } from "./browser-bootstrap";
import PublicContactDock from "./PublicContactDock";
import SiteVisualOverrides from "./SiteVisualOverrides";
import {
  PRELOAD_RECOVERY_STORAGE_KEY,
  recoveryTimestamp,
  shouldRecoverPreloadError,
} from "./runtime-recovery";
import "./styles.css";
import "./theme.css";

const removeBrowserBootstrap = installBrowserBootstrap();
if (import.meta.hot) import.meta.hot.dispose(removeBrowserBootstrap);

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
        <App />
        <PublicContactDock />
      </SiteVisualOverrides>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    void navigator.serviceWorker.register("/sw.js"),
  );
}
