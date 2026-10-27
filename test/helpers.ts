// Boots the real app against a throwaway Postgres schema, with two users.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/crm_test";
delete process.env.APP_EMAIL;
delete process.env.APP_PASSWORD;
delete process.env.RESEND_API_KEY;

export const USERS = {
  a: { email: "a@test.nl", password: "correct-horse-a" },
  b: { email: "b@test.nl", password: "correct-horse-b" },
};

export interface Env {
  base: string;
  q: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
}

export async function start(): Promise<Env> {
  const { pool, migrate, q } = await import("../server/db.js");
  await pool.query("drop schema if exists public cascade; create schema public;");
  await migrate();
  const { setupAuth, hashPassword } = await import("../server/auth.js");
  await setupAuth();
  for (const u of Object.values(USERS)) {
    await q("insert into users (email, password_hash) values ($1, $2)", [u.email, await hashPassword(u.password)]);
  }
  const { createApp } = await import("../server/app.js");
  const server: Server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}/api`,
    q,
    close: async () => {
      await new Promise((r) => server.close(r));
      await pool.end();
    },
  };
}

/** A browser-like client: keeps the session cookie and sends the app header unless told not to. */
export class Client {
  cookie = "";
  constructor(private base: string) {}

  async req(method: string, path: string, body?: unknown, opts: { appHeader?: boolean } = {}) {
    const headers: Record<string, string> = {};
    if (opts.appHeader !== false) headers["X-CRM-Request"] = "1";
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* CSV etc. */
    }
    return { status: res.status, data, headers: res.headers };
  }

  get = (path: string) => this.req("GET", path);
  post = (path: string, body?: unknown) => this.req("POST", path, body ?? {});
  patch = (path: string, body: unknown) => this.req("PATCH", path, body);

  async login(user: { email: string; password: string }) {
    const r = await this.post("/login", user);
    if (r.status !== 200) throw new Error(`login failed: ${r.status} ${JSON.stringify(r.data)}`);
    return this;
  }
}
