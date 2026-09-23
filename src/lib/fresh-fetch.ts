// O Supabase permite CORS. O fetch do WebView honra no-store e evita
// o cache do transporte HTTP nativo do Android.
export const freshFetch: typeof fetch = (input, init) => {
  const webFetch = typeof window !== "undefined"
    ? (window as Window & { CapacitorWebFetch?: typeof fetch }).CapacitorWebFetch
    : undefined;
  return (webFetch || globalThis.fetch).call(globalThis, input, { ...init, cache: "no-store" });
};
