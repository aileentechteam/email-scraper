import { Client } from "@notionhq/client";
import { getNotionFieldMap, requiredEnvMissing } from "./config.js";

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
  const requiredFields = Object.values(fields);
  const existing = new Set(Object.keys(db.properties));
  const missingFields = requiredFields.filter((field) => !existing.has(field));

  const databaseTitle = Array.isArray((db as any).title)
    ? (db as any).title.map((t: any) => t.plain_text).join("")
    : "Untitled";

  console.log("Notion database check");
  console.log(`Database title: ${databaseTitle}`);
  console.log(`Domain field: ${fields.domainProperty}`);
  console.log(`Verifier mode: ${process.env.EMAIL_VERIFIER_PROVIDER ?? "none"}`);

  if (missingFields.length) {
    console.log(`Missing properties: ${missingFields.join(", ")}`);
    throw new Error("Notion schema is missing required fields.");
  }

  console.log("All required properties found.");
}
