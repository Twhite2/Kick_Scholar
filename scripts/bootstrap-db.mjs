/**
 * Builds a populated development database from nothing but this repository.
 *
 * Every extraction file is committed, so the full catalogue is reproducible
 * without passing a dump between machines. That matters for more than
 * convenience: it means the pipeline itself is verifiable, and a reviewer can
 * confirm that what is in the database really did come from the crawled pages.
 *
 * Slower than restoring a dump. Use `docs/LOCAL_SETUP.md` to choose.
 *
 *   npm run db:bootstrap
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const steps = [
  { name: "Apply migrations", cmd: "npx", args: ["prisma", "migrate", "deploy"] },
  { name: "Generate Prisma client", cmd: "npx", args: ["prisma", "generate"] },
  { name: "Sync source registry", cmd: "npm", args: ["run", "sources:sync"] },
  {
    name: "Import universities from ROR (network-bound, no API key needed)",
    cmd: "npm",
    args: ["run", "ingest:ror"],
  },
];

// Load whichever extraction directories actually exist, so the script keeps
// working as sources are added or removed.
const extractedRoot = path.join(process.cwd(), "data", "extracted");
if (existsSync(extractedRoot)) {
  for (const dir of readdirSync(extractedRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    steps.push({
      name: `Load extraction files: ${dir.name}`,
      cmd: "npm",
      args: ["run", "pipeline:load", "--", path.join("data", "extracted", dir.name)],
    });
  }
}

steps.push({ name: "Build scholarship -> institution links", cmd: "npm", args: ["run", "link:build"] });

function run({ name, cmd, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${name} ===`);
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`"${name}" exited with code ${code}`)),
    );
  });
}

const started = Date.now();
for (const step of steps) {
  try {
    await run(step);
  } catch (err) {
    console.error(`\nBootstrap stopped: ${err.message}`);
    console.error("Fix the step above, then re-run. Every step is idempotent, so");
    console.error("re-running from the start is safe and will not duplicate data.");
    process.exit(1);
  }
}

const minutes = ((Date.now() - started) / 60000).toFixed(1);
console.log(`\nBootstrap complete in ${minutes} minutes.`);
console.log("Start the app with `npm run dev`, then sign up to create an account.");
