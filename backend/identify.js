// identify.js
// Sends an uploaded clothing photo to the Claude API and gets back
// a short, clean search term (e.g. "grey henley shirt") that can be
// fed straight into fetcher.js's searchAllBrands().

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not set. Photo search will not work until you add it to your .env file."
  );
}

/**
 * @param {string} base64Image - raw base64 (no data: prefix)
 * @param {string} mediaType - e.g. "image/jpeg", "image/png"
 * @returns {Promise<string>} a short search term describing the garment
 */
async function identifyGarment(base64Image, mediaType) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text:
                "Look at this clothing item. Respond with ONLY a short search query (3-6 words) describing it — garment type, color, and style. " +
                'Example good responses: "grey henley shirt", "black oversized hoodie", "blue slim fit jeans". ' +
                "No punctuation, no explanation, just the search term.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((block) => block.type === "text");
  const searchTerm = textBlock ? textBlock.text.trim() : "";

  if (!searchTerm) {
    throw new Error("Claude did not return a usable search term");
  }

  return searchTerm;
}

module.exports = { identifyGarment };
