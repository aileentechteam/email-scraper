import "dotenv/config";
import { discoverEmails } from "../core/discovery.js";
import { runNotionDoctor } from "../notion/doctor.js";
import { syncNotionDatabase } from "../notion/sync.js";

async function main(): Promise<void> {
  const [command, arg, extra] = process.argv.slice(2);

  if (command === "inspect" && arg) {
    const forceRefresh = extra === "--force";
    const result = await discoverEmails(arg, forceRefresh);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "doctor") {
    await runNotionDoctor();
    return;
  }

  if (command === "notion-sync") {
    const forceRefresh = arg === "--force" || extra === "--force";
    const limitArg = [arg, extra].find((value) => value?.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
    const stats = await syncNotionDatabase(forceRefresh, limit);
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log("Usage:");
  console.log("  npm run dev -- doctor");
  console.log("  npm run dev -- inspect https://example.com [--force]");
  console.log("  npm run dev -- notion-sync [--force] [--limit=25]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
