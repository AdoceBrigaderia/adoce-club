import { readBffCsrfToken, type BffAuthSurface, type BffSession } from "./bff-auth";

type StartPayload = {
  challengeId: string;
  options: Record<string, unknown>;
  action: "authentication" | "registration";
  surface: BffAuthSurface;
};

type RegistrationResult = {
  registered: true;
  passkey: { id: string; friendly_name?: string; created_at?: string };
};

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const toBase64Url = (value: ArrayBuffer | null) => {
  if (!value) return null;
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function creationOptions(input: Record<string, unknown>) {
  const user = input.user as { id?: string } | undefined;
  const excludeCredentials = input.excludeCredentials as Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }> | undefined;
  return {
    ...input,
    challenge: fromBase64Url(String(input.challenge || "")),
    user: user ? { ...user, id: fromBase64Url(String(user.id || "")) } : undefined,
    excludeCredentials: excludeCredentials?.map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  } as unknown as PublicKeyCredentialCreationOptions;
}

function requestOptions(input: Record<string, unknown>) {
  const allowCredentials = input.allowCredentials as Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }> | undefined;
  return {
    ...input,
    challenge: fromBase64Url(String(input.challenge || "")),
    allowCredentials: allowCredentials?.map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  } as unknown as PublicKeyCredentialRequestOptions;
}

function serializeCredential(credential: PublicKeyCredential) {
  const response = credential.response;
  const base = {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  if (response instanceof AuthenticatorAssertionResponse) {
    return {
      ...base,
      response: {
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.authenticatorData),
        signature: toBase64Url(response.signature),
        userHandle: toBase64Url(response.userHandle),
      },
    };
  }
  const registration = response as AuthenticatorAttestationResponse;
  return {
    ...base,
    response: {
      clientDataJSON: toBase64Url(registration.clientDataJSON),
      attestationObject: toBase64Url(registration.attestationObject),
      transports: typeof registration.getTransports === "function"
        ? registration.getTransports()
        : [],
    },
  };
}

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a chave de acesso.");
  return body;
}

async function start(
  action: "authentication" | "registration",
  surface: BffAuthSurface,
) {
  const csrf = readBffCsrfToken();
  const response = await fetch("/api/auth-bff-passkey-start", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(action === "registration" && csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: JSON.stringify({ action, surface }),
  });
  return json<StartPayload>(response);
}

async function finish<T>(
  startPayload: StartPayload,
  credential: PublicKeyCredential,
  remember = true,
) {
  const csrf = readBffCsrfToken();
  const response = await fetch("/api/auth-bff-passkey-finish", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(startPayload.action === "registration" && csrf
        ? { "X-CSRF-Token": csrf }
        : {}),
    },
    body: JSON.stringify({
      action: startPayload.action,
      challengeId: startPayload.challengeId,
      credential: serializeCredential(credential),
      surface: startPayload.surface,
      remember,
    }),
  });
  return json<T>(response);
}

export function passkeysSupported() {
  return window.isSecureContext &&
    "PublicKeyCredential" in window &&
    Boolean(navigator.credentials);
}

export async function signInWithPasskeyBff(
  surface: BffAuthSurface,
  remember = true,
) {
  if (!passkeysSupported())
    throw new Error("Este aparelho ou navegador não oferece chave de acesso.");
  const challenge = await start("authentication", surface);
  const credential = await navigator.credentials.get({
    publicKey: requestOptions(challenge.options),
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("A autenticação biométrica foi cancelada.");
  return finish<BffSession & { csrfToken: string }>(challenge, credential, remember);
}

export async function registerPasskeyBff(surface: BffAuthSurface) {
  if (!passkeysSupported())
    throw new Error("Este aparelho ou navegador não oferece chave de acesso.");
  const challenge = await start("registration", surface);
  const credential = await navigator.credentials.create({
    publicKey: creationOptions(challenge.options),
  });
  if (!(credential instanceof PublicKeyCredential))
    throw new Error("O cadastro da chave de acesso foi cancelado.");
  return finish<RegistrationResult>(challenge, credential);
}
