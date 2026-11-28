/**
 * Refresh content/affiliate/threads.csv from Zernio and report what is working.
 *
 *   npm run affiliate-stats            # update the CSV and print the report
 *   npm run affiliate-stats -- --json  # same, plus a machine-readable summary on the last line
 *
 * For every row it pulls the post's current status and time, then matches the
 * published post in Zernio analytics (by the first 50 characters of part_1) and
 * fills views / likes / replies / reposts. Replies exclude our own 3 auto-replies
 * (2 thread parts + the affiliate reply).
 *
 * The report shows views per posting hour (all Threads posts older than 36h, so
 * we know the account's golden hours) and flags affiliate posts that "blew up":
 * >= 2,000 views, or >= 5x the affiliate median.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseCsv } from "./bulk.js";

const CSV = "content/affiliate/threads.csv";
const API = "https://zernio.com/api/v1";
const OWN_REPLIES = 3;
const BLOWUP_VIEWS = 2000;
const BLOWUP_MULTIPLE = 5;

const headers = (): Record<string, string> => {
  // In the cloud sessions the proxy injects the key; locally use ZERNIO_API_KEY.
  const key = process.env.ZERNIO_API_KEY ?? "proxy-injected";
  return { Authorization: `Bearer ${key}` };
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: headers() });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPost = any;

async function allThreadsAnalytics(): Promise<AnyPost[]> {
  const out = new Map<string, AnyPost>();
  for (let page = 1; page <= 20; page++) {
    const { posts = [] } = await api<{ posts?: AnyPost[] }>(
      `/analytics?platform=threads&limit=100&page=${page}&sortBy=date&order=desc`,
    );
    posts.forEach((p) => out.set(p._id, p));
    if (posts.length < 100) break;
  }
  return [...out.values()];
}

const norm = (s = "") => s.replace(/\s+/g, " ").trim().slice(0, 50);
const myt = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3);
const mytString = (iso: string) => myt(iso).toISOString().slice(0, 16).replace("T", " ");
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

function toCsv(rows: string[][]): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

async function main() {
  const rows = parseCsv(await readFile(CSV, "utf8")).filter((r) => r.some((c) => c.trim()));
  const [head, ...body] = rows;
  const col = (k: string) => {
    const i = head.indexOf(k);
    if (i < 0) throw new Error(`threads.csv has no "${k}" column`);
    return i;
  };
  const analytics = await allThreadsAnalytics();

  const affiliate: { id: string; series: string; at: string; views: number }[] = [];
  for (const r of body) {
    const postId = r[col("zernio_post_id")];
    if (!postId) continue;
    const { post } = await api<{ post: AnyPost }>(`/posts/${postId}`).catch(() => ({ post: null }));
    if (post) {
      r[col("status")] = post.status;
      const when = post.platforms?.[0]?.publishedAt ?? post.platforms?.[0]?.scheduledFor ?? post.scheduledFor;
      if (when) r[col("scheduled_at_myt")] = mytString(when);
    }
    const match = analytics.find((p) => norm(p.content) === norm(r[col("part_1")]));
    if (match?.analytics) {
      const a = match.analytics;
      r[col("views")] = String(a.views ?? 0);
      r[col("likes")] = String(a.likes ?? 0);
      r[col("replies")] = String(Math.max(0, (a.comments ?? 0) - OWN_REPLIES));
      r[col("reposts")] = String(a.reposts ?? 0);
      affiliate.push({ id: r[0], series: r[col("series")], at: mytString(match.publishedAt), views: a.views ?? 0 });
    }
  }
  await writeFile(CSV, toCsv([head, ...body]));

  // Golden hours across every Threads post old enough to have settled.
  const settled = analytics.filter((p) => p.publishedAt && Date.now() - Date.parse(p.publishedAt) > 36 * 3600e3);
  const byHour = new Map<number, number[]>();
  for (const p of settled) {
    const h = myt(p.publishedAt).getUTCHours();
    byHour.set(h, [...(byHour.get(h) ?? []), p.analytics?.views ?? 0]);
  }
  const hours = [...byHour.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([h, v]) => ({ hour: h, posts: v.length, median: median(v) }))
    .sort((a, b) => b.median - a.median);

  const affMedian = median(affiliate.map((a) => a.views));
  const blowups = affiliate.filter(
    (a) => a.views >= BLOWUP_VIEWS || (affMedian > 0 && a.views >= BLOWUP_MULTIPLE * affMedian),
  );

  console.log(`Updated ${CSV}: ${affiliate.length} published affiliate threads with stats.`);
  console.log(`Affiliate median views: ${affMedian}`);
  console.log("Golden hours (MYT, median views, >=3 posts):");
  hours.slice(0, 6).forEach((h) => console.log(`  ${String(h.hour).padStart(2, "0")}:00  median ${h.median}  (${h.posts} posts)`));
  console.log(blowups.length ? "BLOW UP:" : "No affiliate blow-ups.");
  blowups.forEach((b) => console.log(`  ${b.id} ${b.series} ${b.at} ${b.views} views`));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ affiliateMedian: affMedian, goldenHours: hours.slice(0, 6), blowups, affiliate }));
  }
}

main().catch((err) => {
  console.error(`Error: ${err?.message ?? err}`);
  process.exit(1);
});
