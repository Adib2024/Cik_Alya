# Affiliate content library

Two tables (CSV) of everything promoted for Cik Alya, kept for reuse. GitHub shows
them as searchable tables; fetch the raw file to use the data in code.

| File | One row per | Key columns |
|---|---|---|
| `products.csv` | product | `product_id`, `name`, `category`, `tiktok_link`, `shopee_link`, `verified_facts`, `avoid_claims`, `reply_text`, `first_used`, `last_used`, `times_used` |
| `threads.csv` | posted thread | `thread_id`, `series`, `product_id`, `scheduled_at_myt`, `part_1`–`part_3`, `reply_text`, `zernio_post_id`, `views`, `likes`, `replies`, `reposts` |

`threads.product_id` links to `products.product_id`. List values inside a cell
(facts, claims) are separated by ` | `. The engagement columns are filled in after
the posts go live.

Fetch example:

```bash
curl -sL https://raw.githubusercontent.com/Adib2024/Cik_Alya/main/content/affiliate/products.csv
```

## Format that works

- Thread = pure health tips: common habit, then the surprise ("tapi pakar kata..."),
  named source, practical steps, one natural Islamic touch. No product in the thread.
- Product only in the auto-reply (Zernio `firstComment`), labelled "affiliate".
- 3 dense parts per thread, natural lowercase Malay, "RM" always uppercase,
  no questions or calls to comment/share.

## Reusing a series

Before reposting, re-check: links still work, prices/stock, sold counts quoted in
replies, and any statistics (dengue cases, survey numbers) are still current.
Space repeats out (weeks, not days) and rewrite the hook so it is not a duplicate.

## Daily automation

A scheduled task runs every morning (10:43 MYT):

1. `npm run affiliate-stats` refreshes status, times and engagement in `threads.csv`
   and prints the account's golden hours and any blow-ups.
2. **Blow-up** (>= 2,000 views or >= 5x the affiliate median): a follow-up thread on
   the same product with a different angle is saved as a Zernio draft, and the owner
   gets a notification.
3. **One affiliate thread per day**: if tomorrow has none, a new one is written for the
   least recently used product (never the same product two days running) and scheduled.
4. **Sunday recycle**: the 3 best affiliate threads older than 21 days are rewritten
   with a new hook/angle and become the next days' affiliate posts.
5. **Golden hours**: new posts rotate 17:00 / 18:00 / 19:00. Once each slot has 3+
   affiliate posts, the best slot becomes the default (1 in 4 posts keeps testing).

Thread layout in Zernio: `content` = part 1, `platformSpecificData.threadItems` =
parts 1–3, `firstComment` = reply_text, `topic_tag` = Kesihatan.
