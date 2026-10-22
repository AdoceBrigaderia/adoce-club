const routePrefixes = [
  "operacao", "clube", "entrar", "cadastro", "minha-conta",
  "adoce-hoje", "carrinho", "encomendas", "docinhos",
  "politica-de-pedidos", "fale-com-a-adoce",
  "termos", "privacidade", "indicar", "entrar-novo", "inicio", "catalogo",
];

export function pathFromLegacyHash(hash: string): string | null {
  const route = hash.replace(/^#/, "");
  if (!routePrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`) || (prefix === "operacao" && route.startsWith("operacao-")))) return null;
  if (route.startsWith("operacao-")) return `/operacao/${route.slice("operacao-".length)}`;
  return `/${route}`;
}

export function currentRouteHash(): string {
  if (location.hash && !pathFromLegacyHash(location.hash)) return location.hash;
  const route = `${location.pathname.replace(/\/+$/, "") || "/"}${location.search}`;
  if (route === "/") return location.hash;
  if (route === "/sabores") return "";
  if (route.startsWith("/operacao/")) return `#operacao-${route.slice("/operacao/".length)}`;
  return `#${route.slice(1)}`;
}

export function normalizeLegacyRoute(): boolean {
  const path = pathFromLegacyHash(location.hash);
  if (!path) return false;
  history.replaceState(null, "", path);
  return true;
}

export function navigateRoute(path: string): void {
  const normalized = pathFromLegacyHash(path) || path;
  history.pushState(null, "", normalized);
  window.dispatchEvent(new Event("adoce-routechange"));
}
