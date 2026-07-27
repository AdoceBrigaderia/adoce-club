import { createSign } from "node:crypto";

export type GoogleWalletEnvReader = (name: string) => string | undefined;

export type GoogleWalletConfig = {
  issuerId: string;
  classId: string;
  serviceAccountEmail: string;
  privateKey: string;
  origins: string[];
};

export type GoogleWalletCustomerPass = {
  profileId: string;
  fullName: string;
  memberCode: string;
  currentProgress: number;
  availableRewards: number;
  objectSuffix: string;
  accountUri: string;
};

export type GoogleWalletConfigResult =
  | { configured: true; config: GoogleWalletConfig; missing: [] }
  | { configured: false; missing: string[] };

const REQUIRED_GOOGLE_WALLET_ENV = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_CLASS_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
] as const;

function normalizePrivateKey(value: string) {
  return value.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n").trim();
}

function normalizeOrigins(value: string | undefined, siteUrl: string | undefined) {
  const entries = [...(value || "").split(","), siteUrl || ""]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return [...new Set(entries)];
}

function normalizedClassId(issuerId: string, value: string) {
  const trimmed = value.trim();
  return trimmed.includes(".")
    ? trimmed
    : `${issuerId}.${safeWalletIdPart(trimmed)}`;
}

export function readGoogleWalletConfig(
  readEnv: GoogleWalletEnvReader,
): GoogleWalletConfigResult {
  const missing = REQUIRED_GOOGLE_WALLET_ENV.filter(
    (name) => !readEnv(name)?.trim(),
  );
  if (missing.length) return { configured: false, missing: [...missing] };

  const issuerId = readEnv("GOOGLE_WALLET_ISSUER_ID")!.trim();
  const classId = normalizedClassId(
    issuerId,
    readEnv("GOOGLE_WALLET_CLASS_ID")!,
  );
  const origins = normalizeOrigins(
    readEnv("GOOGLE_WALLET_ORIGINS"),
    readEnv("SITE_URL"),
  );
  if (!origins.length)
    return { configured: false, missing: ["GOOGLE_WALLET_ORIGINS"] };

  return {
    configured: true,
    missing: [],
    config: {
      issuerId,
      classId,
      serviceAccountEmail: readEnv("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL")!.trim(),
      privateKey: normalizePrivateKey(readEnv("GOOGLE_WALLET_PRIVATE_KEY")!),
      origins,
    },
  };
}

export function safeWalletIdPart(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .slice(0, 64);
  if (!normalized) throw new Error("Identificador do passe inválido.");
  return normalized;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function localized(value: string) {
  return {
    defaultValue: {
      language: "pt-BR",
      value,
    },
  };
}

export function buildGoogleWalletObject(
  config: GoogleWalletConfig,
  customer: GoogleWalletCustomerPass,
) {
  const progress = Math.max(
    0,
    Math.min(14, Number(customer.currentProgress || 0)),
  );
  const rewards = Math.max(0, Number(customer.availableRewards || 0));
  const memberCode = customer.memberCode.trim();
  const objectSuffix = safeWalletIdPart(
    customer.objectSuffix || customer.profileId,
  );

  return {
    id: `${config.issuerId}.${objectSuffix}`,
    classId: config.classId,
    state: "ACTIVE",
    cardTitle: localized("Clube Adoce"),
    header: localized(customer.fullName.trim() || "Cliente Adoce"),
    hexBackgroundColor: "#E99AB4",
    barcode: {
      type: "QR_CODE",
      value: `adoce-member:${memberCode}`,
      alternateText: memberCode,
    },
    textModulesData: [
      {
        id: "stamps",
        header: "CARIMBOS",
        body: `${progress} de 14`,
      },
      {
        id: "rewards",
        header: "FATIAS GRÁTIS",
        body: String(rewards),
      },
    ],
    linksModuleData: {
      uris: [
        {
          id: "account",
          uri: customer.accountUri,
          description: "Abrir meu Clube Adoce",
        },
      ],
    },
  };
}

export function createGoogleWalletSaveUrl(
  config: GoogleWalletConfig,
  customer: GoogleWalletCustomerPass,
  issuedAt = Math.floor(Date.now() / 1000),
) {
  const walletObject = buildGoogleWalletObject(config, customer);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: issuedAt,
    origins: config.origins,
    payload: {
      genericObjects: [walletObject],
    },
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(config.privateKey);
  const token = `${signingInput}.${base64Url(signature)}`;

  if (token.length > 1800)
    throw new Error(
      "O passe excedeu o tamanho seguro aceito pelo Google Wallet.",
    );

  return {
    saveUrl: `https://pay.google.com/gp/v/save/${token}`,
    token,
    objectId: walletObject.id,
  };
}

export const GOOGLE_WALLET_REQUIRED_ENV = [...REQUIRED_GOOGLE_WALLET_ENV];
