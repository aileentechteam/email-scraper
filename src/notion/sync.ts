import { Client } from "@notionhq/client";
import { discoverEmails } from "../core/discovery.js";

export async function syncNotionDatabase(forceRefresh = false): Promise<void> {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error("NOTION_DATABASE_ID is required");

  const domainProperty = process.env.NOTION_DOMAIN_PROPERTY ?? "Website";
  const processedAtProperty = process.env.NOTION_PROCESSED_AT_PROPERTY ?? "processed_at";
  const errorProperty = process.env.NOTION_ERROR_PROPERTY ?? "notes_error";

  let cursor: string | undefined;
  do {
    const page = await notion.databases.query({ database_id: databaseId, start_cursor: cursor });
    for (const row of page.results) {
      if (!("properties" in row)) continue;
      const properties = row.properties as Record<string, any>;
      const domain = extractDomainValue(properties[domainProperty]);
      if (!domain) continue;
      if (!forceRefresh && hasProcessedValue(properties[processedAtProperty])) continue;

      try {
        const result = await discoverEmails(domain, forceRefresh);
        const candidates = result.candidates;
        const update: Record<string, any> = {
          [process.env.NOTION_RECOMMENDED_EMAIL_1_PROPERTY ?? "recommended_email_1"]: richText(candidates[0]?.email ?? ""),
          [process.env.NOTION_RECOMMENDED_EMAIL_2_PROPERTY ?? "recommended_email_2"]: richText(candidates[1]?.email ?? ""),
          [process.env.NOTION_RECOMMENDED_EMAIL_3_PROPERTY ?? "recommended_email_3"]: richText(candidates[2]?.email ?? ""),
          [process.env.NOTION_BEST_EMAIL_PROPERTY ?? "best_email"]: richText(result.bestFirstOutreach?.email ?? ""),
          [process.env.NOTION_CONFIDENCE_SUMMARY_PROPERTY ?? "confidence_summary"]: richText(result.confidenceSummary),
          [process.env.NOTION_VERIFICATION_STATUS_PROPERTY ?? "verification_status"]: richText(result.bestFirstOutreach?.verification.status ?? "no result"),
          [process.env.NOTION_OUTREACH_NOTES_PROPERTY ?? "outreach_notes"]: richText(result.outreachNotes),
          [processedAtProperty]: dateProperty(new Date().toISOString()),
          [errorProperty]: richText(""),
        };

        await notion.pages.update({ page_id: row.id, properties: update as any });
      } catch (error) {
        await notion.pages.update({
          page_id: row.id,
          properties: {
            [errorProperty]: richText(String(error).slice(0, 1800)),
            [processedAtProperty]: dateProperty(new Date().toISOString()),
          } as any,
        });
      }
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
}

function richText(content: string) {
  return { rich_text: content ? [{ text: { content } }] : [] };
}

function dateProperty(iso: string) {
  return { date: { start: iso } };
}

function extractDomainValue(property: any): string | null {
  if (!property) return null;
  if (property.type === "url") return property.url ?? null;
  if (property.type === "rich_text") return property.rich_text?.map((item: any) => item.plain_text).join("").trim() || null;
  if (property.type === "title") return property.title?.map((item: any) => item.plain_text).join("").trim() || null;
  return null;
}

function hasProcessedValue(property: any): boolean {
  return property?.type === "date" && !!property?.date?.start;
}
