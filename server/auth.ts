import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { one, q, getMeta, setMeta } from "./db.js";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

const COOKIE = "df_session";
const MAX_AGE_MS = 60 * 86400_000;
let secret = process.env.SESSION_SECRET || "";

async function hashPassword(pw: string): Promise<string> {
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
 * Creates or updates the login from APP_EMAIL / APP_PASSWORD on boot,
 * and makes sure there is a session signing secret.
 */
export async function setupAuth(): Promise<void> {
  if (!secret) {
    secret = (await getMeta("session_secret")) ?? "";
    if (!secret) {
      secret = crypto.randomBytes(32).toString("hex");
      await setMeta("session_secret", secret);
    }
  }

  const email = (process.env.APP_EMAIL || "").trim().toLowerCase();
  const password = process.env.APP_PASSWORD || "";
  if (!email || !password) {
    const count = await one<{ n: number }>("select count(*)::int as n from users");
    if (!count?.n) console.warn("No login yet. Set APP_EMAIL and APP_PASSWORD to create one.");
    return;
  }
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
    await q("update users set password_hash = $2 where id = $1", [existing.id, await hashPassword(password)]);
    console.log(`Updated password for ${email}.`);
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

function sessionUserId(req: Request): string | null {
  const token = readCookie(req);
  if (!token) return null;
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig) return null;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
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
  const id = sessionUserId(req);
  if (id && (await one("select 1 from users where id = $1", [id]))) {
    req.userId = id;
    return next();
  }
  res.status(401).json({ error: "Log in to continue." });
}

export async function me(req: Request, res: Response) {
  const id = sessionUserId(req);
  const user = id ? await one("select id, email, name from users where id = $1", [id]) : undefined;
  res.json({ user: user ?? null });
}

const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export async function login(req: Request, res: Response) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= 10) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = email
    ? await one<{ id: string; password_hash: string }>("select id, password_hash from users where lower(email) = $1", [email])
    : undefined;
  const ok = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    if (!entry || now - entry.first >= WINDOW_MS) attempts.set(ip, { count: 1, first: now });
    else entry.count++;
    const anyUser = await one<{ n: number }>("select count(*)::int as n from users");
    return res.status(anyUser?.n ? 401 : 503).json({
      error: anyUser?.n
        ? "That email and password don't match."
        : "No login exists yet. Set APP_EMAIL and APP_PASSWORD in your Railway variables, then redeploy.",
    });
  }

  attempts.delete(ip);
  const exp = String(now + MAX_AGE_MS);
  res.cookie(COOKIE, `${user.id}.${exp}.${sign(`${user.id}.${exp}`)}`, {
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
