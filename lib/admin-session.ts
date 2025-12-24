type SessionPayload = {
  u: string;
  exp: number;
};

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

function textEncoder() {
  return new TextEncoder();
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array | null {
  if (!input) return null;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  return null;
}

async function hmacSign(data: string, secret: string): Promise<Uint8Array> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error("WebCrypto is not available");
  }

  const key = await cryptoObj.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await cryptoObj.subtle.sign("HMAC", key, textEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function getAdminSessionCookieName() {
  return COOKIE_NAME;
}

export function getAdminSessionMaxAgeSeconds() {
  return Math.floor(SESSION_TTL_MS / 1000);
}

export async function createAdminSessionToken(username: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET not set");

  const payload: SessionPayload = {
    u: username,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const payloadBytes = textEncoder().encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncodeBytes(payloadBytes);
  const sigBytes = await hmacSign(payloadB64, secret);
  const sigB64 = base64UrlEncodeBytes(sigBytes);

  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminSessionToken(
  token: string | null | undefined
): Promise<{ ok: boolean; username?: string }> {
  if (!token) return { ok: false };

  const secret = getSessionSecret();
  if (!secret) return { ok: false };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, sigB64] = parts;

  try {
    const expectedSig = await hmacSign(payloadB64, secret);
    const expectedSigB64 = base64UrlEncodeBytes(expectedSig);
    if (!timingSafeEqual(sigB64, expectedSigB64)) return { ok: false };

    const payloadBytes = base64UrlDecodeToBytes(payloadB64);
    if (!payloadBytes) return { ok: false };

    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload?.u || !payload?.exp) return { ok: false };
    if (Date.now() > payload.exp) return { ok: false };

    return { ok: true, username: payload.u };
  } catch {
    return { ok: false };
  }
}

export function getAdminAuthConfig() {
  const username = process.env.ADMIN_USER?.trim() || "";
  const password = process.env.ADMIN_PASSWORD?.trim() || "";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() || "";

  if (!username || !password || !sessionSecret) return null;
  return { username, password, sessionSecret };
}
