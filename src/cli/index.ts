import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { discoverEmails } from "../core/discovery.js";
import { discoveryResultsToCsv } from "../core/report.js";
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

  if (command === "inspect-file" && firstArg) {
    const forceRefresh = args.includes("--force");
    const outArg = args.find((value) => value.startsWith("--out="));
    const input = await readFile(firstArg, "utf8");
    const domains = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const results = [];
    for (const domain of domains) {
      results.push(await discoverEmails(domain, forceRefresh));
    }
    const csv = discoveryResultsToCsv(results);
    if (outArg) {
      const outPath = outArg.split("=")[1];
      await writeFile(outPath, csv);
      console.log(`Wrote CSV to ${outPath}`);
    } else {
      console.log(csv);
    }
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
  console.log("  npm run dev -- inspect-file ./sample-domains.txt [--out=./results.csv] [--force]");
  console.log("  npm run dev -- notion-sync [--dry-run] [--force] [--limit=25]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
