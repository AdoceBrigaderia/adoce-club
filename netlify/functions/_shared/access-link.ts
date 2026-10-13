import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./whatsapp-auth";

export type AccessLink = {
  email: string;
  code: string;
  loginUrl: string;
  querySuffix: string;
};

export type AccessLinkDelivery = {
  status: "accepted" | "disabled" | "not_configured" | "failed";
  messageSid?: string;
  error?: string;
};

const configuredSiteUrl = () =>
  (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "");

const whatsappAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

const safeTwilioError = (error: unknown) => {
  const status = Number((error as { status?: number })?.status || 0);
  const code = String((error as { code?: string | number })?.code || "unknown").slice(0, 40);
  return `twilio_${status || "error"}_${code}`;
};

export const buildAccessLink = (
  email: string,
  code: string,
  baseUrl = configuredSiteUrl(),
): AccessLink => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedCode.length !== 6) {
    throw new Error("access_link_invalid_data");
  }
  const parsedBase = new URL(baseUrl);
  if (
    parsedBase.protocol !== "https:" ||
    parsedBase.hostname !== "www.adocebrigaderia.com.br"
  ) {
    throw new Error("access_link_invalid_origin");
  }
  const querySuffix = new URLSearchParams({
    email: normalizedEmail,
    code: normalizedCode,
  }).toString();
  return {
    email: normalizedEmail,
    code: normalizedCode,
    querySuffix,
    loginUrl: `${parsedBase.origin}/clube/acesso-direto?${querySuffix}`,
  };
};

export async function generateAccessLink(
  admin: SupabaseClient,
  email: string,
): Promise<AccessLink> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo: `${configuredSiteUrl()}/clube` },
  });
  const code = data?.properties?.email_otp;
  if (error || !code) throw new Error("access_link_generation_failed");
  return buildAccessLink(normalizedEmail, code);
}

export async function deliverAccessLink(
  fullName: string,
  phone: string,
  access: AccessLink,
): Promise<AccessLinkDelivery> {
  if (env("TWILIO_ACCESS_LINK_ENABLED") !== "true") {
    return {
      status: "disabled",
      error: "access_link_delivery_disabled_until_template_approval",
    };
  }
  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const from = env("TWILIO_WHATSAPP_FROM") || "";
  const contentSid = env("TWILIO_ACCESS_LINK_CONTENT_SID") || "";
  if (!accountSid || !authToken || !from || !contentSid) {
    return {
      status: "not_configured",
      error: "access_link_delivery_configuration_missing",
    };
  }

  try {
    const firstName = fullName.trim().split(/\s+/)[0] || "cliente";
    const sent = await twilio(accountSid, authToken).messages.create({
      from: whatsappAddress(from),
      to: whatsappAddress(phone),
      contentSid,
      contentVariables: JSON.stringify({
        "1": firstName.slice(0, 60),
        "2": access.querySuffix,
      }),
    });
    return { status: "accepted", messageSid: sent.sid };
  } catch (error) {
    return { status: "failed", error: safeTwilioError(error) };
  }
}
