import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumePublicRateLimits,
  ipRateLimitRule,
} from "./public-rate-limit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proteção compartilhada dos endpoints públicos", () => {
  it("falha fechado quando o pepper protegido não está configurado", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      consumePublicRateLimits({
        supabaseUrl: "https://homologacao.supabase.co",
        secretKey: "segredo-de-teste",
        pepper: "curto",
        rules: [
          {
            bucket: "feedback",
            subject: "ip:203.0.113.8",
            windowSeconds: 60,
            maxRequests: 5,
          },
        ],
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
      failed: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prioriza o IP da Netlify e envia somente o hash do identificador", async () => {
    const request = new Request("https://homologacao.netlify.app/api/feedback", {
      headers: {
        "x-nf-client-connection-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.5, 198.51.100.6",
      },
    });
    const rule = ipRateLimitRule(request, "feedback", 300, 4);
    expect(rule.subject).toBe("ip:203.0.113.10");

    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      expect(body.requested_bucket).toBe("feedback");
      expect(body.requested_subject_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(body)).not.toContain("203.0.113.10");
      expect(body.requested_window_seconds).toBe(300);
      expect(body.requested_max_requests).toBe(4);
      return new Response(JSON.stringify({ allowed: true, remaining: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      consumePublicRateLimits({
        supabaseUrl: "https://homologacao.supabase.co",
        secretKey: "segredo-de-teste",
        pepper: "pepper-de-homologacao-comprido",
        rules: [rule],
      }),
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      failed: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aplica todas as regras e preserva o maior tempo de espera", async () => {
    const responses = [
      { allowed: false, retry_after_seconds: 12 },
      { allowed: false, retry_after_seconds: 90 },
    ];
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      consumePublicRateLimits({
        supabaseUrl: "https://homologacao.supabase.co",
        secretKey: "segredo-de-teste",
        pepper: "pepper-de-homologacao-comprido",
        rules: [
          {
            bucket: "feedback-ip",
            subject: "ip:203.0.113.11",
            windowSeconds: 60,
            maxRequests: 4,
          },
          {
            bucket: "feedback-phone",
            subject: "phone:5585999999999",
            windowSeconds: 600,
            maxRequests: 2,
          },
        ],
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 90,
      failed: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("falha fechado quando o armazenamento do limite não responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "indisponível" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      consumePublicRateLimits({
        supabaseUrl: "https://homologacao.supabase.co",
        secretKey: "segredo-de-teste",
        pepper: "pepper-de-homologacao-comprido",
        rules: [
          {
            bucket: "service-request",
            subject: "ip:203.0.113.12",
            windowSeconds: 60,
            maxRequests: 4,
          },
        ],
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
      failed: true,
    });
  });
});
