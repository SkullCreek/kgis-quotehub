/**
 * Single shared password authentication.
 *
 * There is one password, held in APP_PASSWORD. On a correct entry we
 * set a cookie holding an expiry timestamp plus an HMAC of it, signed
 * with AUTH_SECRET. Nothing is stored server side, so this works on
 * serverless without a session table.
 *
 * Everything here uses Web Crypto so it also runs in the Edge runtime,
 * which is where middleware executes.
 */

export const SESSION_COOKIE = "quotehub_session";
const SESSION_DAYS = 30;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 32",
    );
  }
  return secret;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(new Uint8Array(sig));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in time independent of how early they differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Builds the cookie value for a fresh login. */
export async function createSessionToken(): Promise<{
  value: string;
  maxAge: number;
}> {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expiresAt = Date.now() + maxAge * 1000;
  const payload = String(expiresAt);
  const signature = await hmac(payload, getSecret());
  return { value: `${payload}.${signature}`, maxAge };
}

/** Returns true when the cookie is well formed, correctly signed and unexpired. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = await hmac(payload, getSecret());
  } catch {
    return false;
  }
  if (!timingSafeEqual(signature, expected)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

/**
 * Checks a submitted password against APP_PASSWORD.
 *
 * Both sides are hashed with SHA-256 before comparison. That makes the
 * comparison fixed width, so neither the timing nor the length of the
 * check says anything about the real password.
 */
export async function checkPassword(submitted: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256(submitted), sha256(expected)]);
  return timingSafeEqual(a, b);
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return bytesToHex(new Uint8Array(digest));
}
