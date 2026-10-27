import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { HttpError } from "./validate.js";
import { login, logout, logoutEverywhere, me, requireAppHeader, requireAuth } from "./auth.js";
import { tasks } from "./routes/tasks.js";
import { activities } from "./routes/activities.js";
import { accounts } from "./routes/accounts.js";
import { contacts } from "./routes/contacts.js";
import { misc } from "./routes/misc.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React sets a few inline style attributes (positions on the lease timeline).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

/** One line per API request: id, method, path, status, duration. No bodies, so no client data in logs. */
function requestLog(req: Request, res: Response, next: NextFunction) {
  const id = crypto.randomUUID().slice(0, 8);
  const start = process.hrtime.bigint();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  res.on("finish", () => {
    // originalUrl, because routers strip their mount path from req.url. Query strings left out on purpose.
    const path = req.originalUrl.split("?")[0];
    if (!path.startsWith("/api") || process.env.NODE_ENV === "test") return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${id} ${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(requestLog);
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", async (_req, res) => {
    await pool.query("select 1");
    res.json({ ok: true });
  });

  app.use("/api", requireAppHeader);
  app.post("/api/login", login);
  app.post("/api/logout", logout);
  app.get("/api/me", me);

  app.use("/api", requireAuth);
  app.post("/api/logout-everywhere", logoutEverywhere);
  app.use("/api", tasks, activities, accounts, contacts, misc);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  // The built web app, with client-side routing.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDir = [path.resolve(here, "../../dist-web"), path.resolve(here, "../dist-web")].find((d) => fs.existsSync(d));
  if (webDir) {
    app.use(express.static(webDir, { index: false, maxAge: "1y", immutable: true }));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webDir, "index.html"));
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Couldn't read that request." });
    if (err?.code === "23505") return res.status(409).json({ error: "That would create a duplicate." });
    if (err?.code === "23514") return res.status(400).json({ error: "One of the values isn't allowed." });
    console.error(`${res.locals.requestId ?? "-"} unhandled error`, err);
    res.status(500).json({ error: "Something went wrong on the server. Check the logs." });
  });

  return app;
}
