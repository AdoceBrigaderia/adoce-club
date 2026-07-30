export type InstallExperienceAssets = {
  manifestHref: string;
  iconHref: string;
  appleTouchIconHref: string;
  appTitle: string;
};

const clubAssets: InstallExperienceAssets = {
  manifestHref: "/manifest-clube.webmanifest",
  iconHref: "/pwa/clube/icon-192.png",
  appleTouchIconHref: "/pwa/clube/apple-touch-icon.png",
  appTitle: "Clube Adoce",
};

const operationAssets: InstallExperienceAssets = {
  manifestHref: "/manifest-operacao.webmanifest",
  iconHref: "/pwa/operacao/icon-192.png",
  appleTouchIconHref: "/pwa/operacao/apple-touch-icon.png",
  appTitle: "Adoce Operação",
};

export function installExperienceAssets(hash: string): InstallExperienceAssets {
  return hash.startsWith("#operacao") ? operationAssets : clubAssets;
}

export function applyInstallExperience(
  documentRef: Document,
  assets: InstallExperienceAssets,
) {
  const manifest = documentRef.querySelector<HTMLLinkElement>("#app-manifest");
  const icon = documentRef.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const appleTouchIcon = documentRef.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  const appTitle = documentRef.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');

  if (manifest) manifest.href = assets.manifestHref;
  if (icon) icon.href = assets.iconHref;
  if (appleTouchIcon) appleTouchIcon.href = assets.appleTouchIconHref;
  if (appTitle) appTitle.content = assets.appTitle;
}

export function installBrowserBootstrap(
  windowRef: Window = window,
  documentRef: Document = document,
) {
  const refresh = () => {
    applyInstallExperience(
      documentRef,
      installExperienceAssets(windowRef.location.hash),
    );
  };

  refresh();
  windowRef.addEventListener("hashchange", refresh);
  return () => windowRef.removeEventListener("hashchange", refresh);
}
