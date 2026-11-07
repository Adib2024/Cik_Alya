/**
 * Load a batch of posts from a JSON or CSV file.
 *
 * JSON: an array of PostInput objects (see examples/posts.example.json).
 * CSV columns: content, scheduledFor, targets, media, timezone, hashtags, title
 *   - list columns (targets, media, hashtags) are separated by "|"
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import type { PostInput } from "./zernio.js";

export async function loadPosts(filePath: string): Promise<PostInput[]> {
  const raw = await readFile(filePath, "utf8");
  const posts = extname(filePath).toLowerCase() === ".csv" ? parseCsvPosts(raw) : parseJsonPosts(raw);

  // Resolve local media paths relative to the batch file.
  const base = dirname(resolve(filePath));
  for (const p of posts) {
    p.media = p.media?.map((m) => (/^https?:\/\//i.test(m) || isAbsolute(m) ? m : resolve(base, m)));
  }
  posts.forEach(validate);
  return posts;
}

function parseJsonPosts(raw: string): PostInput[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("JSON batch file must be an array of posts.");
  return parsed as PostInput[];
}

const list = (v?: string) => (v ? v.split("|").map((s) => s.trim()).filter(Boolean) : undefined);

function parseCsvPosts(raw: string): PostInput[] {
  const rows = parseCsv(raw).filter((r) => r.some((c) => c.trim() !== ""));
  const [header, ...body] = rows;
  if (!header) return [];
  const cols = header.map((h) => h.trim());
  return body.map((row) => {
    const r = Object.fromEntries(cols.map((c, i) => [c, row[i]?.trim() || undefined]));
    return {
      content: r.content,
      scheduledFor: r.scheduledFor,
      timezone: r.timezone,
      title: r.title,
      targets: list(r.targets),
      media: list(r.media),
      hashtags: list(r.hashtags),
    };
  });
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function validate(p: PostInput, i: number) {
  const where = `Post #${i + 1}`;
  if (!p.content && !p.media?.length) throw new Error(`${where}: needs content or media.`);
  if (p.scheduledFor) {
    const t = Date.parse(p.scheduledFor);
    if (Number.isNaN(t)) throw new Error(`${where}: invalid scheduledFor "${p.scheduledFor}".`);
    if (t < Date.now()) throw new Error(`${where}: scheduledFor ${p.scheduledFor} is in the past.`);
  }
}
