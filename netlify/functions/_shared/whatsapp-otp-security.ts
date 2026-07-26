import { createHmac, randomInt } from "node:crypto";
import type { MetaWhatsAppConfig } from "./meta-whatsapp";

export type EnvironmentReader = (name: string) => string | undefined;

export function generateWhatsAppOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashWhatsAppOtp(
  challengeId: string,
  code: string,
  pepper: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) {
    throw new Error("Identificador do desafio inválido.");
  }
  if (!/^\d{6}$/.test(code)) throw new Error("Código OTP inválido.");
  if (pepper.length < 32) throw new Error("WHATSAPP_OTP_PEPPER inseguro.");
  return createHmac("sha256", pepper)
    .update(`${challengeId}:${code}`, "utf8")
    .digest("hex");
}

export function hashRequestOrigin(value: string, pepper: string) {
  if (pepper.length < 32) throw new Error("WHATSAPP_OTP_PEPPER inseguro.");
  return createHmac("sha256", pepper)
    .update(value || "unknown", "utf8")
    .digest("hex");
}

export function readMetaWhatsAppConfig(env: EnvironmentReader): MetaWhatsAppConfig {
  const config: MetaWhatsAppConfig = {
    accessToken: env("META_WA_ACCESS_TOKEN") || "",
    phoneNumberId: env("META_WA_PHONE_NUMBER_ID") || "",
    wabaId: env("META_WA_WABA_ID") || "",
    appSecret: env("META_WA_APP_SECRET") || "",
    verifyToken: env("META_WA_VERIFY_TOKEN") || "",
    templateName: env("META_WA_AUTH_TEMPLATE_NAME") || "",
    graphApiVersion: env("META_WA_GRAPH_API_VERSION") || "",
    templateLanguage: env("META_WA_AUTH_TEMPLATE_LANGUAGE") || "pt_BR",
  };
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "templateLanguage" && !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Integração Meta incompleta: ${missing.join(", ")}.`);
  }
  return config;
}
