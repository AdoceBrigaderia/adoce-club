const RESPONSE_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
} as const;

type SecureResponseOptions = {
  contentType?: string;
  cacheControl?: string;
  vary?: string;
  headers?: HeadersInit;
};

export function secureResponseHeaders(options: SecureResponseOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", options.cacheControl || "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Vary", options.vary || "Origin, Sec-Fetch-Site");
  if (options.contentType) headers.set("Content-Type", options.contentType);
  Object.entries(RESPONSE_SECURITY_HEADERS).forEach(([name, value]) => {
    headers.set(name, value);
  });
  return headers;
}

export function secureText(body: string, status = 200, headers?: HeadersInit) {
  return new Response(body, {
    status,
    headers: secureResponseHeaders({
      contentType: "text/plain; charset=utf-8",
      headers,
    }),
  });
}

export function secureEmpty(status = 204, headers?: HeadersInit) {
  return new Response(null, {
    status,
    headers: secureResponseHeaders({ headers }),
  });
}
