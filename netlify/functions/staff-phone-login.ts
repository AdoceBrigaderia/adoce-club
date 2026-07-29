import { guardBffRequest } from "./_shared/request-security";
import { secureJson } from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  return secureJson(
    {
      error:
        "Este endpoint foi desativado. Atualize a página para usar o acesso seguro.",
      code: "legacy_phone_login_disabled",
    },
    410,
  );
};

export const config = { path: "/api/staff-phone-login" };
