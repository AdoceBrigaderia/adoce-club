import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import startWhatsAppAuth from "../netlify/functions/auth-whatsapp-start";
import {
  authorizeWhatsAppRequest,
  hmacHex,
  isValidFullName,
  maskPhone,
  normalizeBrazilPhone,
  verifyStandardWebhook,
  whatsappAuthAccessMode,
} from "../netlify/functions/_shared/whatsapp-auth";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("fundação do login por WhatsApp", () => {
  it("falha fechada quando a feature flag do servidor esta desligada", async () => {
    const previous = process.env.WHATSAPP_AUTH_ENABLED;
    process.env.WHATSAPP_AUTH_ENABLED = "false";
    try {
      const response = await startWhatsAppAuth(
        new Request("http://localhost:5173/api/auth/whatsapp/start", {
          method: "POST",
          headers: { origin: "http://localhost:5173" },
        }),
      );
      expect(response.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_AUTH_ENABLED;
      else process.env.WHATSAPP_AUTH_ENABLED = previous;
    }
  });

  it("rejeita nome invalido no servidor antes de chamar provedores", async () => {
    const previous = process.env.WHATSAPP_AUTH_ENABLED;
    const previousMode = process.env.WHATSAPP_AUTH_ACCESS_MODE;
    process.env.WHATSAPP_AUTH_ENABLED = "true";
    process.env.WHATSAPP_AUTH_ACCESS_MODE = "pilot";
    try {
      const response = await startWhatsAppAuth(
        new Request("http://localhost:5173/api/auth/whatsapp/start", {
          method: "POST",
          headers: {
            origin: "http://localhost:5173",
            "content-type": "application/json",
            "idempotency-key": "550e8400-e29b-41d4-a716-446655440000",
          },
          body: JSON.stringify({
            phone: "+5585999991234",
            fullName: "Maria",
            intent: "signup_or_login",
          }),
        }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "Informe seu nome e sobrenome.",
      });
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_AUTH_ENABLED;
      else process.env.WHATSAPP_AUTH_ENABLED = previous;
      if (previousMode === undefined) delete process.env.WHATSAPP_AUTH_ACCESS_MODE;
      else process.env.WHATSAPP_AUTH_ACCESS_MODE = previousMode;
    }
  });

  it("mantem o modo de acesso fechado quando ausente ou invalido", () => {
    const previous = process.env.WHATSAPP_AUTH_ACCESS_MODE;
    try {
      delete process.env.WHATSAPP_AUTH_ACCESS_MODE;
      expect(whatsappAuthAccessMode()).toBe("disabled");
      process.env.WHATSAPP_AUTH_ACCESS_MODE = "qualquer-coisa";
      expect(whatsappAuthAccessMode()).toBe("disabled");
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_AUTH_ACCESS_MODE;
      else process.env.WHATSAPP_AUTH_ACCESS_MODE = previous;
    }
  });

  it("exige sessao operacional no modo piloto", async () => {
    const previous = process.env.WHATSAPP_AUTH_ACCESS_MODE;
    process.env.WHATSAPP_AUTH_ACCESS_MODE = "pilot";
    try {
      const response = await authorizeWhatsAppRequest(
        new Request("http://localhost:5173/api/auth/whatsapp/start"),
        {} as never,
      );
      expect(response.pilot).toBe(true);
      expect(response.errorResponse?.status).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_AUTH_ACCESS_MODE;
      else process.env.WHATSAPP_AUTH_ACCESS_MODE = previous;
    }
  });

  it("normaliza e mascara o telefone sem expor o número completo", () => {
    const phone = normalizeBrazilPhone("(85) 99999-1234");
    expect(phone).toBe("+5585999991234");
    expect(maskPhone(phone || "")).toBe("+55 •• •••••-1234");
  });

  it("gera HMAC estável e não usa o telefone em claro", async () => {
    const digest = await hmacHex("segredo-de-teste", "phone:+5585999991234");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain("5585999991234");
  });

  it("valida nome completo tambem no servidor", () => {
    expect(isValidFullName("Maria da Silva")).toBe(true);
    expect(isValidFullName("Maria")).toBe(false);
    expect(isValidFullName(`Maria ${"a".repeat(121)}`)).toBe(false);
  });

  it("valida assinatura Standard Webhooks e rejeita replay", async () => {
    const raw = JSON.stringify({
      user: { phone: "+5585999991234" },
      sms: { otp: "123456" },
    });
    const timestamp = 2_000_000_000;
    const id = "msg_teste_123";
    const key = Buffer.from("uma-chave-simetrica-com-32-bytes!!");
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${raw}`)
      .digest("base64");
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${signature}`,
    });
    const secret = `v1,whsec_${key.toString("base64")}`;
    expect(await verifyStandardWebhook(raw, headers, secret, timestamp)).toBe(true);
    expect(await verifyStandardWebhook(raw, headers, secret, timestamp + 301)).toBe(false);
  });

  it("mantém endpoints desligados por padrão e segredos fora do navegador", () => {
    const envExample = read("../.env.example");
    const start = read("../netlify/functions/auth-whatsapp-start.ts");
    const hook = read("../netlify/functions/supabase-send-sms-hook.ts");
    expect(envExample).toContain("WHATSAPP_AUTH_ENABLED=false");
    expect(envExample).toContain("WHATSAPP_AUTH_ACCESS_MODE=disabled");
    expect(envExample).toContain("VITE_WHATSAPP_AUTH_ENABLED=false");
    expect(envExample).toContain("VITE_WHATSAPP_AUTH_PILOT_ENABLED=false");
    expect(start).toContain("whatsappAuthEnabled");
    expect(hook).toContain("verifyStandardWebhook");
    expect(hook).toContain("META_WHATSAPP_ACCESS_TOKEN");
    expect(envExample).not.toContain("VITE_META_WHATSAPP_ACCESS_TOKEN");
  });

  it("cria somente telemetria privada e nunca persiste OTP", () => {
    const migration = read(
      "../supabase/migrations/20260821092506_whatsapp_auth_hook_foundation.sql",
    );
    expect(migration).toContain("private.auth_delivery_attempts");
    expect(migration).toContain("private.whatsapp_auth_requests");
    expect(migration).toContain("server_check_whatsapp_auth_request");
    expect(migration).toContain("server_has_pending_whatsapp_auth_request");
    expect(migration).toContain("requested_by_user_id uuid references auth.users");
    expect(migration).toContain("requested_actor_user_id uuid default null");
    expect(migration).toContain("revoke all");
    expect(migration).toMatch(/from public, anon, authenticated/g);
    expect(migration).not.toMatch(/\botp\s+(text|varchar|char|jsonb|bytea)\b/i);
    expect(migration).not.toContain("code_hash");
    expect(migration).not.toContain("phone_e164");
  });

  it("mantem a tela do piloto subordinada a flag e aos papeis internos", () => {
    const access = read("./AccessApp.tsx");
    const pilot = read("./WhatsAppAuthPilot.tsx");
    expect(access).toContain("VITE_WHATSAPP_AUTH_PILOT_ENABLED");
    expect(access).toContain('(role === "owner" || role === "manager")');
    expect(pilot).toContain("Authorization: `Bearer ${accessToken}`");
    expect(pilot).not.toContain("setSession");
  });
});
