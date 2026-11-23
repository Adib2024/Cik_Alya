# Affiliate content library

Products and Threads posts used for Cik Alya affiliate promotion, kept for reuse.

- `products.json`: each product's affiliate links (TikTok, Shopee), verified facts,
  claims to avoid, the reply text used, and the dates it was posted.
- `threads/*.json`: the exact thread text posted for each series. Each file is a list
  of threads; each thread is a list of 3 parts (`threadItems`).

## Format that works

- Thread = pure health tips: common habit, then the surprise ("tapi pakar kata..."),
  named source, practical steps, one natural Islamic touch. No product in the thread.
- Product only in the auto-reply (`firstComment`), labelled "affiliate".
- 3 dense parts per thread, natural lowercase Malay, "RM" always uppercase,
  no questions or calls to comment/share.

## Reusing a series

Before reposting, re-check: links still work, prices/stock, sold counts quoted in
replies, and any statistics (dengue cases, survey numbers) are still current.
Space repeats out (weeks, not days) and rewrite the hook so it is not a duplicate.
