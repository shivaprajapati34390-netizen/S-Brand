// fetcher.js
// Fetches live product data from Shopify-based D2C brands' public
// /products.json endpoints, filters by search term, and normalizes
// the results into a common shape the frontend can render directly.

const BRANDS = [
  // --- Originally confirmed (10) ---
  { name: "Mecnex", domain: "mecnex.com" },
  { name: "Offduty India", domain: "offduty.in" },
  { name: "The Bear House", domain: "thebearhouse.com" },
  { name: "LoveGen", domain: "lovegen.com" },
  { name: "Gritstones", domain: "gritstones.com" },
  { name: "5feet11", domain: "5feet11.com" },
  { name: "Fugazee", domain: "fugazee.com" },
  { name: "Vastrado", domain: "vastrado.com" },
  { name: "Snitch", domain: "snitch.co.in" },
  { name: "Offdaze", domain: "offdaze.in" },

  // --- Newly added (7) ---
  { name: "Bewakoof", domain: "bewakoof.com" },
  { name: "The Souled Store", domain: "thesouledstore.com" },
  { name: "Urban Monkey", domain: "urbanmonkey.com" },
  { name: "Bonkers Corner", domain: "bonkerscorner.com" },
  { name: "Veirdo", domain: "veirdo.in" },
  { name: "Gen Rage", domain: "genrage.com" }, // this is what "gen.rage" refers to
  { name: "Chokore", domain: "chokore.com" },

  // Still unresolved — need a confirmed domain before adding:
  // - balloonclothin (Instagram-only, no standalone website found)
  // - oldgrab (couldn't confirm this brand — different spelling?)
  // - LINEN COLLECTION (too generic — is this a specific brand, or a
  //   product category on one of the brands above?)
];

const FETCH_TIMEOUT_MS = 8000;
const RESULTS_PER_BRAND = 5;

/**
 * Fetches with a timeout so one slow/dead brand site doesn't
 * hang the whole search.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CompareBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pulls live products.json for one brand, filters by the search
 * term against title + tags, and normalizes each match.
 */
async function fetchBrandProducts(brand, query) {
  const url = `https://${brand.domain}/products.json?limit=250`;

  let data;
  try {
    data = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  } catch (err) {
    console.warn(`[${brand.name}] fetch failed:`, err.message);
    return []; // fail gracefully — skip this brand, don't break the whole search
  }

  const products = data.products || [];
  const q = query.toLowerCase();

  const matches = products.filter((p) => {
    const title = (p.title || "").toLowerCase();
    const tags = (p.tags || []).join(" ").toLowerCase();
    const productType = (p.product_type || "").toLowerCase();
    return title.includes(q) || tags.includes(q) || productType.includes(q);
  });

  return matches.slice(0, RESULTS_PER_BRAND).map((p) => normalizeProduct(p, brand));
}

/**
 * Converts a raw Shopify product object into the flat shape
 * the frontend comparison cards expect.
 */
function normalizeProduct(product, brand) {
  const variants = product.variants || [];
  const inStockVariants = variants.filter((v) => v.available);

  let stockStatus = "out"; // out | low | in
  if (inStockVariants.length > 0) {
    stockStatus = inStockVariants.length <= 2 ? "low" : "in";
  }

  const prices = variants.map((v) => parseFloat(v.price)).filter((n) => !isNaN(n));
  const minPrice = prices.length ? Math.min(...prices) : null;

  const image =
    product.images && product.images.length > 0 ? product.images[0].src : null;

  return {
    brand: brand.name,
    productName: product.title,
    price: minPrice,
    currency: "INR",
    stockStatus,
    image,
    url: `https://${brand.domain}/products/${product.handle}`,
    availableSizes: inStockVariants.map((v) => v.title),
  };
}

/**
 * Searches all configured brands in parallel and merges results.
 */
async function searchAllBrands(query) {
  const brandResults = await Promise.all(
    BRANDS.map((brand) => fetchBrandProducts(brand, query))
  );

  const merged = brandResults.flat();
  merged.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  return merged;
}

module.exports = { searchAllBrands, BRANDS };
