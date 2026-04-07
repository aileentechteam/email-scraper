import { discoverEmails } from "../core/discovery.js";
import { syncNotionDatabase } from "../notion/sync.js";

async function main(): Promise<void> {
  const [command, arg, extra] = process.argv.slice(2);

  if (command === "inspect" && arg) {
    const forceRefresh = extra === "--force";
    const result = await discoverEmails(arg, forceRefresh);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "notion-sync") {
    const forceRefresh = arg === "--force";
    await syncNotionDatabase(forceRefresh);
    console.log("Notion sync complete");
    return;
  }

  console.log("Usage:");
  console.log("  npm run dev -- inspect https://example.com [--force]");
  console.log("  npm run dev -- notion-sync [--force]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
