import pg from "pg";
import { MIGRATIONS } from "./migrations.js";

// DATE columns as plain "YYYY-MM-DD" strings, NUMERIC as numbers, TIME as "HH:MM".
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1083, (v) => (v === null ? null : v.slice(0, 5)));
// date[] arrays
pg.types.setTypeParser(1182 as any, (v: string) => (v === null ? [] : v.replace(/[{}]/g, "").split(",").filter(Boolean)));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add a Postgres database and set DATABASE_URL.");
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 8,
});

// An idle connection dropping (database restart, network blip) must not crash the app; the pool reconnects.
pool.on("error", (err) => console.error("Database connection lost; will reconnect:", err.message));

export interface Db {
  q<T = any>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = any>(text: string, params?: unknown[]): Promise<T | undefined>;
}

function wrap(runner: pg.Pool | pg.PoolClient): Db {
  return {
    async q(text, params = []) {
      const res = await runner.query(text, params);
      return res.rows;
    },
    async one(text, params = []) {
      const res = await runner.query(text, params);
      return res.rows[0];
    },
  };
}

export const db = wrap(pool);
export const q = db.q;
export const one = db.one;

/** Runs fn inside a transaction; rolls back on any error. */
export async function tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const MIGRATION_LOCK = 4242_0001;

/** Applies pending migrations, one transaction each. An advisory lock stops two instances migrating at once. */
export async function migrate(): Promise<void> {
  const lock = await pool.connect();
  try {
    await lock.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
    await pool.query(`create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )`);
    const done = new Set((await q<{ id: string }>("select id from schema_migrations")).map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await tx(async (t) => {
        await t.q(m.sql);
        await t.q("insert into schema_migrations (id) values ($1)", [m.id]);
      });
      if (process.env.NODE_ENV !== "test") console.log(`Applied migration ${m.id}`);
    }
  } finally {
    await lock.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => {});
    lock.release();
  }
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await one<{ value: string }>("select value from meta where key = $1", [key]))?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await q("insert into meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [
    key,
    value,
  ]);
}
