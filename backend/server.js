// server.js
// Backend for the "Compare" widget — fetches live product data
// from Shopify-based brand stores and returns matched results.
// Also supports photo-based search via Claude's vision API.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { searchAllBrands } = require("./fetcher");
const { identifyGarment } = require("./identify");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" })); // images need a bigger body limit than default

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Compare backend running" });
});

// Text search endpoint
// GET /api/search?q=henley
app.get("/api/search", async (req, res) => {
  const query = (req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing query param 'q'" });
  }

  try {
    const results = await searchAllBrands(query);
    res.json({ query, count: results.length, results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Failed to fetch brand data" });
  }
});

// Photo search endpoint
// POST /api/search-by-image
// body: { image: "<base64 string, no data: prefix>", mediaType: "image/jpeg" }
app.post("/api/search-by-image", async (req, res) => {
  const { image, mediaType } = req.body;

  if (!image || !mediaType) {
    return res.status(400).json({ error: "Missing 'image' or 'mediaType' in request body" });
  }

  try {
    // Step 1: ask Claude what the garment is
    const searchTerm = await identifyGarment(image, mediaType);

    // Step 2: use that term to search live brand stock
    const results = await searchAllBrands(searchTerm);

    res.json({
      identifiedAs: searchTerm,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("Image search error:", err);
    res.status(500).json({ error: "Failed to process image search", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Compare backend listening on http://localhost:${PORT}`);
});
