/**
 * Tiny VOTable (TABLEDATA) reader. IRSA's observation list and DataLink responses are small,
 * flat tables, so a regex reader is enough; BINARY serializations are not supported.
 */

export interface VoTable {
  fields: string[];
  rows: string[][];
  params: Record<string, string>;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseVoTable(xml: string): VoTable {
  const results = /<RESOURCE[^>]*type="results"[^>]*>([\s\S]*?)<\/RESOURCE>/.exec(xml)?.[1] ?? xml;
  const fields = [...results.matchAll(/<FIELD\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
  const rows: string[][] = [];
  for (const tr of results.matchAll(/<TR>([\s\S]*?)<\/TR>/g)) {
    const cells = [...tr[1].matchAll(/<TD>([\s\S]*?)<\/TD>|<TD\s*\/>/g)].map((m) => decodeEntities(m[1] ?? "").trim());
    rows.push(cells);
  }
  const params: Record<string, string> = {};
  for (const m of xml.matchAll(/<PARAM\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/g)) params[m[1]] = decodeEntities(m[2]);
  return { fields, rows, params };
}

export function toRecords(table: VoTable): Record<string, string>[] {
  return table.rows.map((row) => Object.fromEntries(table.fields.map((f, i) => [f, row[i] ?? ""])));
}
