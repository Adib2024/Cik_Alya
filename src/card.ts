/**
 * Render a branded 1080x1350 image card for a Threads post and (optionally)
 * upload it to Zernio, printing the public URL.
 *
 *   npm run card -- --kind market --title "KLCI naik 0.8%" --subtitle "Penutupan Jumaat 6 Nov" --out card.png [--upload]
 *
 * Uses the Playwright + Chromium already installed on the machine.
 */
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { uploadMedia } from "./zernio.js";

const KINDS = {
  isu:      { label: "ISU SEMASA",  bg: "#14213d", accent: "#ef476f" },
  market:   { label: "UPDATE MARKET", bg: "#0b3d2e", accent: "#2ec27e" },
  kewangan: { label: "KEWANGAN",    bg: "#3d2c0b", accent: "#f4b942" },
  edukasi:  { label: "EDUKASI LABUR", bg: "#1d1b4b", accent: "#8b7cf6" },
  santai:   { label: "RANDOM THOUGHT", bg: "#4b1d3f", accent: "#ff8fab" },
} as const;
export type CardKind = keyof typeof KINDS;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function cardHtml(kind: CardKind, title: string, subtitle = ""): string {
  const k = KINDS[kind];
  const size = title.length > 90 ? 76 : title.length > 50 ? 92 : 118;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1080px; height: 1350px; background: ${k.bg}; color: #fff;
    font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif; padding: 96px 88px;
    display: flex; flex-direction: column; }
  main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .tag { display: inline-block; background: ${k.accent}; color: ${k.bg}; font-weight: 800;
    letter-spacing: 4px; font-size: 30px; padding: 14px 26px; border-radius: 999px; }
  h1 { font-size: ${size}px; line-height: 1.12; font-weight: 800; margin-top: 56px; }
  p { font-size: 44px; line-height: 1.35; opacity: .85; margin-top: 40px; }
  .bar { width: 160px; height: 12px; background: ${k.accent}; border-radius: 6px; margin-top: 56px; }
  footer { display: flex; justify-content: space-between; font-size: 34px; opacity: .8; }
  </style></head><body>
  <main><div><span class="tag">${k.label}</span></div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}<div class="bar"></div></main>
  <footer><span>@miss_cikalya</span><span>Reply pendapat korang 👇</span></footer>
  </body></html>`;
}

export async function renderCard(kind: CardKind, title: string, subtitle: string, out: string) {
  const require = createRequire(import.meta.url);
  let playwright;
  try { playwright = require("playwright"); }
  catch { playwright = require(require.resolve("playwright", { paths: ["/usr/lib/node_modules", "/usr/local/lib/node_modules"] })); }
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(cardHtml(kind, title, subtitle), { waitUntil: "load" });
    await page.screenshot({ path: out, type: out.endsWith(".jpg") ? "jpeg" : "png" });
  } finally {
    await browser.close();
  }
  return out;
}

async function main() {
  const { values } = parseArgs({
    options: {
      kind: { type: "string", default: "isu" },
      title: { type: "string" },
      subtitle: { type: "string", default: "" },
      out: { type: "string", default: "card.png" },
      upload: { type: "boolean", default: false },
    },
  });
  if (!values.title) throw new Error("--title is required");
  if (!(values.kind! in KINDS)) throw new Error(`--kind must be one of: ${Object.keys(KINDS).join(", ")}`);
  const file = await renderCard(values.kind as CardKind, values.title, values.subtitle!, values.out!);
  console.log(`Rendered ${file}`);
  if (values.upload) console.log(JSON.stringify(await uploadMedia(file)));
}

if (process.argv[1]?.endsWith("card.ts")) {
  main().catch((err) => { console.error(`Error: ${err?.message ?? err}`); process.exit(1); });
}
