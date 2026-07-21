import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicContactDock from "./PublicContactDock";
import "./styles.css";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PublicContactDock />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
