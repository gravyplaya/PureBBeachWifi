import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { cookies } from "next/headers";

const TOKEN_NAME = "auth_token";
const TOKEN_MAX_AGE = 60 * 60 * 24;

const secretKey = new TextEncoder().encode(env.auth.jwtSecret);

interface TokenPayload {
  email: string;
  role: "admin";
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
    .setIssuedAt()
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

export async function setSession(payload: TokenPayload): Promise<void> {
  const token = await createToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_NAME);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function verifyAdmin(
  email: string,
  password: string,
): Promise<boolean> {
  const expectedEmail = env.auth.adminEmail;
  const expectedHash = env.auth.adminPasswordHash;

  if (!expectedEmail || !expectedHash) {
    return false;
  }

  if (email !== expectedEmail) {
    return false;
  }

  const hash = await hashPassword(password);
  return hash === expectedHash;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { TOKEN_NAME };
