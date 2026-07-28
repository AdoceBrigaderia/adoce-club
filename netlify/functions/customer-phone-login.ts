import { secureJson } from "./_shared/session-security";

export default async () =>
  secureJson(
    {
      error:
        "Este endpoint foi desativado. Atualize a página para usar o acesso seguro.",
      code: "legacy_phone_login_disabled",
    },
    410,
  );

export const config = { path: "/api/customer-phone-login" };
