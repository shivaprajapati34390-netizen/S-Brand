# Compare Backend

Fetches live product data (price, stock, image, link) from Shopify-based
D2C brands and serves it to your S-Brand Compare widget.

## Setup

```bash
npm install
npm start
```

Server runs at `http://localhost:4000`.

Requires Node 18+ (uses the built-in `fetch`).

## How it works

1. `fetcher.js` holds the list of brands in `BRANDS` — each just needs a
   `name` and `domain`. It only works for brands running on Shopify that
   expose a public `/products.json` endpoint (no login/API key needed).
2. On each search, it calls `https://<domain>/products.json` for every
   brand in parallel, filters products whose title/tags/type match your
   search term, and normalizes the result.
3. Stock status is derived from Shopify's `variants[].available` field:
   - `in` → 3+ variants (sizes/colors) in stock
   - `low` → 1-2 variants in stock
   - `out` → nothing in stock
4. Results are merged across brands and sorted cheapest-first.

## Check if a brand qualifies

Before adding a brand to `BRANDS`, visit `https://<their-domain>/products.json`
directly in your browser. If it returns JSON, you're good. If it 404s or
redirects, that brand isn't on Shopify (or has this endpoint disabled) and
needs a different approach — that's a Tier 2/3 brand, not Tier 1.

## API

```
GET /api/search?q=henley
```

Response:
```json
{
  "query": "henley",
  "count": 3,
  "results": [
    {
      "brand": "Mecnex",
      "productName": "Henley Coffee Brown",
      "price": 999,
      "currency": "INR",
      "stockStatus": "in",
      "image": "https://...",
      "url": "https://mecnex.com/products/henley-coffee-brown",
      "availableSizes": ["S", "M", "L"]
    }
  ]
}
```

## Wiring it to your Compare section

In your S-Brand HTML, replace the hardcoded brand cards with a fetch call
triggered by the input bar's send button:

```js
async function runSearch(query) {
  const res = await fetch(`http://localhost:4000/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  renderCards(data.results); // build your own function to inject cards into .grid
}
```

## Next steps

- Deploy this backend somewhere reachable by your live site (Render,
  Railway, Fly.io, or a VPS all work for a Node/Express app).
- Add a simple in-memory or Redis cache (products.json doesn't change
  every second — cache each brand's response for a few minutes to avoid
  hammering their servers).
- Extend `BRANDS` as you confirm more Shopify-based stores.
- For non-Shopify brands (Myntra, Amazon, Flipkart, legacy mall brands),
  this script won't work — those need affiliate API integration or are
  reference-only (no live stock).
