import { Client } from "@notionhq/client";
import { discoverEmails } from "../core/discovery.js";
import { getNotionFieldMap } from "./config.js";

export interface SyncStats {
  totalRows: number;
  processed: number;
  skipped: number;
  failed: number;
}

export async function syncNotionDatabase(forceRefresh = false, limit?: number): Promise<SyncStats> {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error("NOTION_DATABASE_ID is required");

  const fields = getNotionFieldMap();
  const stats: SyncStats = { totalRows: 0, processed: 0, skipped: 0, failed: 0 };

  let cursor: string | undefined;
  outer: do {
    const page = await notion.databases.query({ database_id: databaseId, start_cursor: cursor });
    for (const row of page.results) {
      if (!("properties" in row)) continue;
      stats.totalRows += 1;
      const properties = row.properties as Record<string, any>;
      const domain = extractDomainValue(properties[fields.domainProperty]);
      if (!domain) {
        stats.skipped += 1;
        continue;
      }
      if (!forceRefresh && hasProcessedValue(properties[fields.processedAt])) {
        stats.skipped += 1;
        continue;
      }
      if (limit && stats.processed >= limit) break outer;

      try {
        const result = await discoverEmails(domain, forceRefresh);
        const candidates = result.candidates;
        const update: Record<string, any> = {
          [fields.recommended1]: richText(candidates[0]?.email ?? ""),
          [fields.recommended2]: richText(candidates[1]?.email ?? ""),
          [fields.recommended3]: richText(candidates[2]?.email ?? ""),
          [fields.bestEmail]: richText(result.bestFirstOutreach?.email ?? ""),
          [fields.confidenceSummary]: richText(result.confidenceSummary),
          [fields.verificationStatus]: richText(result.bestFirstOutreach?.verification.status ?? "inferred only"),
          [fields.outreachNotes]: richText(result.outreachNotes),
          [fields.processedAt]: dateProperty(new Date().toISOString()),
          [fields.error]: richText(""),
        };

        await notion.pages.update({ page_id: row.id, properties: update as any });
        stats.processed += 1;
        console.log(`Processed ${domain}`);
      } catch (error) {
        stats.failed += 1;
        await notion.pages.update({
          page_id: row.id,
          properties: {
            [fields.error]: richText(String(error).slice(0, 1800)),
            [fields.processedAt]: dateProperty(new Date().toISOString()),
          } as any,
        });
        console.error(`Failed ${domain}: ${String(error)}`);
      }
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);

  return stats;
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
