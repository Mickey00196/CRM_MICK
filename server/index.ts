import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate, pool } from "./db.js";
import { HttpError } from "./validate.js";
import { login, logout, me, requireAuth, setupAuth } from "./auth.js";
import { startDigestSchedule } from "./digest.js";
import { tasks } from "./routes/tasks.js";
import { activities } from "./routes/activities.js";
import { accounts } from "./routes/accounts.js";
import { contacts } from "./routes/contacts.js";
import { misc } from "./routes/misc.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", async (_req, res) => {
  await pool.query("select 1");
  res.json({ ok: true });
});

app.post("/api/login", login);
app.post("/api/logout", logout);
app.get("/api/me", me);

app.use("/api", requireAuth, tasks, activities, accounts, contacts, misc);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Serve the built web app (dist-web) with client-side routing.
const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = [path.resolve(here, "../../dist-web"), path.resolve(here, "../dist-web")].find((d) => fs.existsSync(d));
if (webDir) {
  app.use(express.static(webDir, { index: false, maxAge: "1h" }));
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
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server. Check the logs." });
});

const port = Number(process.env.PORT) || 3000;

migrate()
  .then(setupAuth)
  .then(() => {
    app.listen(port, () => console.log(`CRM listening on :${port}`));
    startDigestSchedule();
  })
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
