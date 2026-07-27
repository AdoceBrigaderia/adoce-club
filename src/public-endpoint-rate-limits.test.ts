import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727120000_public_endpoint_rate_limits.sql",
    import.meta.url,
  ),
  "utf8",
);
const helper = readFileSync(
  new URL(
    "../netlify/functions/_shared/public-rate-limit.ts",
    import.meta.url,
  ),
  "utf8",
);
const feedback = readFileSync(
  new URL("../netlify/functions/public-feedback.ts", import.meta.url),
  "utf8",
);
const serviceRequest = readFileSync(
  new URL("../netlify/functions/public-service-request.ts", import.meta.url),
  "utf8",
);
const analytics = readFileSync(
  new URL("../netlify/functions/public-analytics-event.ts", import.meta.url),
  "utf8",
);

describe("rate limit dos endpoints públicos", () => {
  it("serializa contadores no banco e autoriza somente service_role", () => {
    expect(migration).toContain("private.public_endpoint_rate_limits");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("for update");
    expect(migration).toContain("observed_at timestamptz");
    expect(migration).toContain("'allowed', false");
    expect(migration).toMatch(
      /revoke all on function public\.consume_public_endpoint_rate_limit_bff\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toContain("to service_role");
  });

  it("armazena somente hash SHA-256 e nunca IP ou WhatsApp em claro", () => {
    expect(helper).toMatch(/crypto\.subtle\.digest\(\s+"SHA-256"/);
    expect(helper).toContain("requested_subject_hash: digest");
    expect(helper).not.toContain("requested_subject:");
    expect(migration).toContain("subject_hash text not null");
    expect(migration).not.toContain("client_ip");
    expect(migration).not.toContain("phone_number");
  });

  it("limita pré-reservas por IP e WhatsApp antes da escrita", () => {
    const limiter = serviceRequest.indexOf("consumePublicRateLimits");
    const write = serviceRequest.indexOf("submit_service_request_bff");
    expect(limiter).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(limiter);
    expect(serviceRequest).toContain('"service-request:ip"');
    expect(serviceRequest).toContain('bucket: "service-request:phone"');
    expect(serviceRequest).toContain("rate_limited");
  });

  it("limita feedback por IP e contato antes da escrita", () => {
    const limiter = feedback.indexOf("consumePublicRateLimits");
    const write = feedback.indexOf("submit_site_feedback_bff");
    expect(limiter).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(limiter);
    expect(feedback).toContain('"feedback:ip"');
    expect(feedback).toContain('bucket: "feedback:contact"');
    expect(feedback).toContain("retry_after_seconds");
  });

  it("limita telemetria por IP sem quebrar a navegação pública", () => {
    const limiter = analytics.indexOf("consumePublicRateLimits");
    const write = analytics.indexOf("record_site_analytics_event");
    expect(limiter).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(limiter);
    expect(analytics).toContain('"analytics:ip"');
    expect(analytics).toContain(
      'ipRateLimitRule(request, "analytics:ip", 3600, 300)',
    );
    expect(analytics).toContain("rate_limited: !rateLimit.failed");
    expect(analytics).toContain("202");
  });

  it("falha fechado em escrita e degrada telemetria quando o limite não responde", () => {
    expect(helper).toContain(
      "return { allowed: false, retryAfterSeconds: 60, failed: true }",
    );
    expect(feedback).toContain("rateLimit.failed ? 503 : 429");
    expect(serviceRequest).toContain("rateLimit.failed ? 503 : 429");
    expect(analytics).toContain("return secureJson(");
    expect(analytics).toContain("accepted: false");
  });
});
