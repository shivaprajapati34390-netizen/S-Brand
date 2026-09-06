// compare.js
// Connects the S-Brand "Compare" input bar to the live backend API.
// Supports both text search and photo-upload search (via Claude vision).

const BACKEND_URL = "http://localhost:4000"; // change this after you deploy the backend

document.addEventListener("DOMContentLoaded", () => {
  const compareSection = document.getElementById("compare");
  if (!compareSection) return;

  const input = compareSection.querySelector('input[type="text"]');
  const sendBtn = compareSection.querySelector('button[aria-label="Send"]');
  const cameraBtn = compareSection.querySelector('button[aria-label="Upload photo"]');
  const cardsGrid = compareSection.querySelector(".grid");
  const leadText = compareSection.querySelector("p.text-sm.text-zinc-400.mb-4");

  if (!input || !sendBtn || !cardsGrid) {
    console.warn("compare.js: expected elements not found in #compare section");
    return;
  }

  // --- Text search ---
  sendBtn.addEventListener("click", () => runTextSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runTextSearch(input.value);
  });

  // --- Photo search ---
  // Create a hidden file input the camera button triggers
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  if (cameraBtn) {
    cameraBtn.addEventListener("click", () => fileInput.click());
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    await runImageSearch(file);
    fileInput.value = ""; // reset so the same file can be picked again later
  });

  // ---- Core functions ----

  async function runTextSearch(rawQuery) {
    const query = rawQuery.trim();
    if (!query) return;

    setLoadingState("Searching live brand stock…");

    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      renderResults(data.count, data.results, `Found ${data.count} match(es) for "${query}".`);
    } catch (err) {
      console.error("Text search failed:", err);
      renderError();
    }
  }

  async function runImageSearch(file) {
    setLoadingState("Looking at your photo…");
    if (input) input.value = "";

    try {
      const { base64, mediaType } = await fileToBase64(file);

      const res = await fetch(`${BACKEND_URL}/api/search-by-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();

      if (input) input.value = data.identifiedAs; // show what the AI thought it was

      renderResults(
        data.count,
        data.results,
        `Identified as "${data.identifiedAs}" — found ${data.count} match(es).`
      );
    } catch (err) {
      console.error("Image search failed:", err);
      renderError("Couldn't identify that photo. Try a clearer image, or type the item instead.");
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result; // "data:image/jpeg;base64,xxxxx"
        const [prefix, base64] = result.split(",");
        const mediaType = prefix.match(/data:(.*);base64/)[1];
        resolve({ base64, mediaType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setLoadingState(message) {
    if (leadText) leadText.textContent = message;
    cardsGrid.innerHTML = "";
  }

  function renderError(message) {
    if (leadText) {
      leadText.textContent =
        message || "Couldn't reach the comparison service. Is the backend running?";
    }
    cardsGrid.innerHTML = "";
  }

  function renderResults(count, results, leadMessage) {
    if (leadText) {
      leadText.textContent =
        count > 0 ? leadMessage : `No live matches found. Try a different item or photo.`;
    }
    cardsGrid.innerHTML = "";
    results.forEach((item) => cardsGrid.appendChild(buildCard(item)));
  }

  function buildCard(item) {
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.className =
      "group block bg-zinc-800/60 border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-400/50 transition-colors";

    const stockLabel =
      item.stockStatus === "in" ? "In stock" : item.stockStatus === "low" ? "Low stock" : "Sold out";

    const stockClass =
      item.stockStatus === "in"
        ? "stock-in bg-emerald-400/10 text-emerald-400"
        : item.stockStatus === "low"
        ? "stock-low bg-amber-400/10 text-amber-400"
        : "stock-out bg-red-400/10 text-red-400";

    const priceLabel = item.price != null ? `₹${item.price.toLocaleString("en-IN")}` : "—";

    a.innerHTML = `
      <div class="relative aspect-[4/3] overflow-hidden bg-zinc-700">
        <span class="${stockClass} absolute top-3 left-3 text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center">${stockLabel}</span>
        <img src="${item.image || ""}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="${item.productName}" loading="lazy">
      </div>
      <div class="p-4">
        <p class="text-[11px] uppercase tracking-wide text-zinc-500">${item.brand}</p>
        <p class="text-sm font-medium mt-1">${item.productName}</p>
        <div class="flex justify-between items-center mt-3">
          <span class="font-semibold">${priceLabel}</span>
        </div>
      </div>
    `;

    return a;
  }
});
