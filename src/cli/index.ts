import "dotenv/config";
import { discoverEmails } from "../core/discovery.js";
import { runNotionDoctor } from "../notion/doctor.js";
import { syncNotionDatabase } from "../notion/sync.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, firstArg] = args;

  if (command === "inspect" && firstArg) {
    const forceRefresh = args.includes("--force");
    const result = await discoverEmails(firstArg, forceRefresh);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "doctor") {
    await runNotionDoctor();
    return;
  }

  if (command === "notion-sync") {
    const forceRefresh = args.includes("--force");
    const dryRun = args.includes("--dry-run");
    const limitArg = args.find((value) => value.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
    const stats = await syncNotionDatabase({ forceRefresh, limit, dryRun });
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log("Usage:");
  console.log("  npm run dev -- doctor");
  console.log("  npm run dev -- inspect https://example.com [--force]");
  console.log("  npm run dev -- notion-sync [--dry-run] [--force] [--limit=25]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
