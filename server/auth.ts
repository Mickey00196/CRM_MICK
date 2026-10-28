import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { one, q, getMeta } from "./db.js";
import { TIMEZONE } from "./time.js";
import { aiEnabled } from "./domain/enrich.js";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

const COOKIE = "df_session";
const MAX_AGE_MS = 60 * 86400_000;
let secret = process.env.SESSION_SECRET || "";

/** Header every state-changing API request must carry. Browsers can't add it cross-site without CORS approval. */
export const APP_HEADER = "x-crm-request";

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const hash = await scrypt(pw, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

/**
 * Makes sure there is a session signing secret, and creates or updates the login from APP_EMAIL / APP_PASSWORD.
 * A changed password signs out all existing sessions.
 */
export async function setupAuth(): Promise<void> {
  if (!secret) {
    // Insert-if-missing, then read back, so instances starting together agree on one secret.
    await q("insert into meta (key, value) values ('session_secret', $1) on conflict (key) do nothing", [
      crypto.randomBytes(32).toString("hex"),
    ]);
    secret = (await getMeta("session_secret"))!;
  }

  const email = (process.env.APP_EMAIL || "").trim().toLowerCase();
  const password = process.env.APP_PASSWORD || "";
  if (!email || !password) {
    const count = await one<{ n: number }>("select count(*)::int as n from users");
    if (!count?.n) console.warn("No login yet. Set APP_EMAIL and APP_PASSWORD to create one.");
    return;
  }
  if (password.length < 10) console.warn("APP_PASSWORD is shorter than 10 characters. Use a longer one.");
  const existing = await one<{ id: string; password_hash: string }>(
    "select id, password_hash from users where lower(email) = $1",
    [email],
  );
  if (!existing) {
    await q("insert into users (email, name, password_hash) values ($1, $2, $3)", [
      email,
      process.env.APP_NAME || "",
      await hashPassword(password),
    ]);
    console.log(`Created login for ${email}.`);
  } else if (!(await verifyPassword(password, existing.password_hash))) {
    await q("update users set password_hash = $2, session_version = session_version + 1 where id = $1", [
      existing.id,
      await hashPassword(password),
    ]);
    console.log(`Updated password for ${email}; existing sessions are signed out.`);
  }
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Token format: userId.sessionVersion.expiry.signature */
function readSession(req: Request): { userId: string; version: number } | null {
  const token = readCookie(req);
  if (!token) return null;
  const [userId, version, exp, sig] = token.split(".");
  if (!userId || !version || !exp || !sig) return null;
  const expected = sign(`${userId}.${version}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return { userId, version: Number(version) };
}

async function sessionUser(req: Request) {
  const s = readSession(req);
  if (!s) return undefined;
  const user = await one<{ id: string; email: string; name: string; session_version: number }>(
    "select id, email, name, session_version from users where id = $1",
    [s.userId],
  );
  return user && user.session_version === s.version ? user : undefined;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** The signed-in user's id. Only call behind requireAuth. */
export function uid(req: Request): string {
  if (!req.userId) throw new Error("uid() called without auth");
  return req.userId;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await sessionUser(req);
  if (!user) return res.status(401).json({ error: "Log in to continue." });
  req.userId = user.id;
  next();
}

/** CSRF defence in depth (on top of SameSite=Lax cookies): writes must come from our own front end. */
export function requireAppHeader(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.headers[APP_HEADER] === "1") return next();
  res.status(403).json({ error: "This request didn't come from the app." });
}

export async function me(req: Request, res: Response) {
  const user = await sessionUser(req);
  res.json({ user: user ? { id: user.id, email: user.email, name: user.name } : null, timezone: TIMEZONE, ai_enabled: aiEnabled() });
}

const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export async function login(req: Request, res: Response) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.first >= WINDOW_MS) attempts.delete(k);
  const entry = attempts.get(ip);
  if (entry && entry.count >= 10) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = email
    ? await one<{ id: string; password_hash: string; session_version: number }>(
        "select id, password_hash, session_version from users where lower(email) = $1",
        [email],
      )
    : undefined;
  const ok = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    if (entry) entry.count++;
    else attempts.set(ip, { count: 1, first: now });
    const anyUser = await one<{ n: number }>("select count(*)::int as n from users");
    return res.status(anyUser?.n ? 401 : 503).json({
      error: anyUser?.n
        ? "That email and password don't match."
        : "No login exists yet. Set APP_EMAIL and APP_PASSWORD in your Railway variables, then redeploy.",
    });
  }

  attempts.delete(ip);
  const exp = String(now + MAX_AGE_MS);
  const payload = `${user.id}.${user.session_version}.${exp}`;
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

/** Signs out every device, including this one. */
export async function logoutEverywhere(req: Request, res: Response) {
  await q("update users set session_version = session_version + 1 where id = $1", [uid(req)]);
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}
