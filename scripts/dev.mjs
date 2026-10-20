// Runs the API (with reload) and the Vite dev server side by side.
import { spawn } from "node:child_process";

const procs = [
  spawn("npx", ["tsx", "watch", "server/index.ts"], { stdio: "inherit", shell: true }),
  spawn("npx", ["vite", "--config", "vite.config.ts"], { stdio: "inherit", shell: true }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
