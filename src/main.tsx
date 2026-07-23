import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicContactDock from "./PublicContactDock";
import SiteVisualOverrides from "./SiteVisualOverrides";
import "./styles.css";
import "./theme.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloadKey = "adoce-preload-recovery";
  const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload < 10_000) return;
  sessionStorage.setItem(reloadKey, String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SiteVisualOverrides>
      <App />
      <PublicContactDock />
    </SiteVisualOverrides>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
