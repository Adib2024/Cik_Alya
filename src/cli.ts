/**
 * Zernio CLI for Cik Alya.
 *
 *   npm run zernio -- accounts
 *   npm run zernio -- upload ./media/photo.jpg
 *   npm run zernio -- post --content "..." --to instagram --media ./media/photo.jpg [--at 2026-12-01T10:00:00+08:00 | --now]
 *   npm run zernio -- bulk ./examples/posts.example.json [--dry-run]
 */
import { parseArgs } from "node:util";
import { createPost, listAccounts, resolveTargets, uploadMedia } from "./zernio.js";
import { loadPosts } from "./bulk.js";

const HELP = `Usage: npm run zernio -- <command> [options]

Commands:
  accounts                 List connected social accounts (read-only)
  upload <file>            Upload a local image/video and print its public URL
  post                     Create a post (saved as a draft unless --at or --now)
      --content <text>       Caption
      --to <name|id>         Target platform/username/account id (repeatable; default: all)
      --media <path|url>     Attach media (repeatable)
      --at <iso-datetime>    Schedule for this time
      --tz <timezone>        Timezone, e.g. Asia/Kuala_Lumpur
      --now                  Publish immediately
  bulk <file.json|csv>     Create every post in a batch file
      --dry-run              Validate and show what would be created, without calling the API
`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      content: { type: "string" },
      to: { type: "string", multiple: true },
      media: { type: "string", multiple: true },
      at: { type: "string" },
      tz: { type: "string" },
      now: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });

  switch (command) {
    case "accounts": {
      const accounts = await listAccounts();
      if (accounts.length === 0) console.log("No accounts connected yet. Connect them at https://zernio.com.");
      console.table(accounts.map(({ id, platform, username, isActive }) => ({ platform, username, id, isActive })));
      return;
    }
    case "upload": {
      if (!positionals[0]) throw new Error("upload needs a file path.");
      console.log(await uploadMedia(positionals[0]));
      return;
    }
    case "post": {
      const result = await createPost({
        content: values.content,
        targets: values.to,
        media: values.media,
        scheduledFor: values.at,
        timezone: values.tz,
        publishNow: values.now,
      });
      report(result);
      return;
    }
    case "bulk": {
      if (!positionals[0]) throw new Error("bulk needs a .json or .csv file.");
      const posts = await loadPosts(positionals[0]);
      if (values["dry-run"]) {
        console.log(`Dry run: ${posts.length} post(s) are valid.`);
        console.dir(posts, { depth: 4 });
        return;
      }
      const accounts = await listAccounts();
      // Resolve every target up front so a typo fails before anything is created.
      posts.forEach((p) => resolveTargets(p.targets, accounts));
      let failed = 0;
      for (const [i, p] of posts.entries()) {
        try {
          report(await createPost(p, accounts), `#${i + 1}`);
        } catch (err) {
          failed++;
          console.error(`#${i + 1} failed: ${(err as Error).message}`);
        }
      }
      console.log(`Done: ${posts.length - failed} created, ${failed} failed.`);
      if (failed) process.exitCode = 1;
      return;
    }
    default:
      console.log(HELP);
      if (command && command !== "help") process.exitCode = 1;
  }
}

function report(r: Awaited<ReturnType<typeof createPost>>, label = "Post") {
  const where = r.platforms.map((p) => p.platform).join(", ");
  console.log(`${label} ${r.id} [${r.isDraft ? "draft" : r.status}] -> ${where}`);
}

main().catch((err) => {
  console.error(`Error: ${err?.message ?? err}`);
  process.exit(1);
});
