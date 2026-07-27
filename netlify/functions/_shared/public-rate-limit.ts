export type PublicRateLimitRule = {
  bucket: string;
  subject: string;
  windowSeconds: number;
  maxRequests: number;
};

type RateLimitResponse = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

export type PublicRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  failed: boolean;
};

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function subjectHash(
  bucket: string,
  subject: string,
  pepper: string,
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${bucket}\u0000${subject}\u0000${pepper}`),
  );
  return toHex(digest);
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function ipRateLimitRule(
  request: Request,
  bucket: string,
  windowSeconds: number,
  maxRequests: number,
): PublicRateLimitRule {
  return {
    bucket,
    subject: `ip:${clientIp(request)}`,
    windowSeconds,
    maxRequests,
  };
}

export async function consumePublicRateLimits(input: {
  supabaseUrl: string;
  secretKey: string;
  pepper: string;
  rules: PublicRateLimitRule[];
}): Promise<PublicRateLimitResult> {
  if (!input.pepper || input.pepper.length < 16) {
    return { allowed: false, retryAfterSeconds: 60, failed: true };
  }

  let retryAfterSeconds = 0;
  try {
    for (const rule of input.rules) {
      const digest = await subjectHash(
        rule.bucket,
        rule.subject,
        input.pepper,
      );
      const response = await fetch(
        `${input.supabaseUrl}/rest/v1/rpc/consume_public_endpoint_rate_limit_bff`,
        {
          method: "POST",
          headers: {
            apikey: input.secretKey,
            Authorization: `Bearer ${input.secretKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requested_bucket: rule.bucket,
            requested_subject_hash: digest,
            requested_window_seconds: rule.windowSeconds,
            requested_max_requests: rule.maxRequests,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | RateLimitResponse
        | null;
      if (!response.ok || !payload) {
        return { allowed: false, retryAfterSeconds: 60, failed: true };
      }
      if (payload.allowed !== true) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Number(payload.retry_after_seconds || 60),
        );
      }
    }
  } catch {
    return { allowed: false, retryAfterSeconds: 60, failed: true };
  }

  return {
    allowed: retryAfterSeconds === 0,
    retryAfterSeconds,
    failed: false,
  };
}
