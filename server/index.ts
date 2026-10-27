import { migrate, pool } from "./db.js";
import { setupAuth } from "./auth.js";
import { startDigestSchedule } from "./digest.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;

async function main() {
  await migrate();
  await setupAuth();
  const server = createApp().listen(port, () => console.log(`CRM listening on :${port}`));
  const stopDigest = startDigestSchedule();

  // Railway sends SIGTERM on every redeploy: finish in-flight requests, then close the pool.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down.`);
    stopDigest();
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
