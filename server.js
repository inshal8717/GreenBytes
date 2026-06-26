import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

loadLocalEnv();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && url.pathname === "/api/itinerary") {
      await handleItinerary(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Al Qua'a app running at http://127.0.0.1:${port}/`);
});

async function handleItinerary(req, res) {
  const body = await readJsonBody(req);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    sendJson(res, 200, {
      source: "local-fallback",
      itinerary: buildFallbackPlan(body),
    });
    return;
  }

  const prompt = buildPrompt(body);
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 500,
        },
      }),
    },
  );

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    sendJson(res, 502, { error: `Gemini request failed: ${text}` });
    return;
  }

  const geminiJson = await geminiRes.json();
  const itinerary =
    geminiJson.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ||
    buildFallbackPlan(body);
  sendJson(res, 200, { source: "gemini", itinerary });
}

function buildPrompt(body) {
  return [
    "Create a concise evening itinerary for a tourist visiting Al Qua'a.",
    "Keep the schedule practical, safe, and focused on spending with local farms, restaurants, and shops.",
    `Arrival time: ${body.arrival || "17:00"}.`,
    `Budget in AED: ${body.budget || 250}.`,
    `Listings: ${JSON.stringify(body.listings || [])}.`,
    `Local restaurants and shops: ${JSON.stringify(body.localSpots || [])}.`,
    "Return 3 to 5 time-stamped stops. Mention booking costs where useful.",
  ].join("\n");
}

function buildFallbackPlan(body) {
  const budget = Number(body.budget || 250);
  const arrival = body.arrival || "17:00";
  const listings = body.listings || [];
  const localSpots = body.localSpots || [];
  const activities = listings
    .flatMap((listing) =>
      (listing.activities || []).map((activity) => ({
        listing,
        activity,
      })),
    )
    .filter((item) => Number(item.activity.price) <= budget)
    .sort((a, b) => Number(b.activity.price) - Number(a.activity.price));
  const choice = activities[0];
  const dinner = localSpots.find((spot) => spot.type === "Restaurant") || localSpots[0];

  if (!choice) {
    return `${arrival} - Arrive in Al Qua'a and visit a local shop.\n18:30 - Choose a low-cost restaurant stop.\n20:00 - Use the map to pick an available safe-zone activity.`;
  }

  return [
    `${arrival} - Arrive near Al Qua'a and buy water or snacks locally.`,
    dinner ? `18:30 - Dinner at ${dinner.name}, approx. AED ${dinner.price}.` : "18:30 - Dinner at a local restaurant.",
    `${choice.activity.slots?.[0] || "20:00"} - ${choice.activity.name} at ${choice.listing.title}, AED ${choice.activity.price}.`,
    "After the visit - Check out so live location sharing stops.",
  ].join("\n");
}

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requestedPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = join(rootDir, safePath);
  if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  const content = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function loadLocalEnv() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  });
}
