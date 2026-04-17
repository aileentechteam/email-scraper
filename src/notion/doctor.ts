import { Client } from "@notionhq/client";
import { getNotionFieldMap, requiredEnvMissing } from "./config.js";

const EXPECTED_TYPES: Record<string, string[]> = {
  domainProperty: ["url", "rich_text", "title"],
  recommended1: ["rich_text"],
  recommended2: ["rich_text"],
  recommended3: ["rich_text"],
  bestEmail: ["rich_text"],
  confidenceSummary: ["rich_text"],
  verificationStatus: ["rich_text"],
  outreachNotes: ["rich_text"],
  processedAt: ["date"],
  error: ["rich_text"],
};

export async function runNotionDoctor(): Promise<void> {
  const missing = requiredEnvMissing();
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_DATABASE_ID!;
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("properties" in db)) throw new Error("Could not read database properties");

  const fields = getNotionFieldMap();
  const fieldEntries = Object.entries(fields) as Array<[keyof typeof fields, string]>;
  const existing = db.properties as Record<string, { type: string }>;
  const missingFields = fieldEntries.filter(([, field]) => !existing[field]).map(([, field]) => field);
  const databaseTitle = Array.isArray((db as any).title)
    ? (db as any).title.map((t: any) => t.plain_text).join("")
    : "Untitled";

  console.log("Notion database check");
  console.log(`Database title: ${databaseTitle}`);
  console.log(`Database id: ${databaseId}`);
  console.log(`Verifier mode: ${process.env.EMAIL_VERIFIER_PROVIDER ?? "none"}`);

  if (missingFields.length) {
    console.log(`Missing properties: ${missingFields.join(", ")}`);
    throw new Error("Notion schema is missing required fields.");
  }

  let hasTypeMismatch = false;
  console.log("Property validation:");
  for (const [key, field] of fieldEntries) {
    const actualType = existing[field].type;
    const allowed = EXPECTED_TYPES[key] ?? [];
    const ok = allowed.includes(actualType);
    if (!ok) hasTypeMismatch = true;
    console.log(`- ${field}: ${actualType}${ok ? "" : ` (expected ${allowed.join(" or ")})`}`);
  }

  if (hasTypeMismatch) {
    throw new Error("Notion schema types do not match expected field types.");
  }

  console.log("All required properties and types look good.");
}
