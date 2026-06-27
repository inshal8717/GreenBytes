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
          temperature: 0.3,
          maxOutputTokens: 900,
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
  const activityCatalog = (body.listings || []).flatMap((listing) =>
    (listing.activities || []).map((activity) => ({
      listingId: listing.id,
      experience: listing.title,
      host: listing.businessName || listing.ownerName,
      safeZoneMapped: Array.isArray(listing.safeZone) && listing.safeZone.length >= 3,
      activityId: activity.id,
      activity: activity.name,
      priceAED: Number(activity.price),
      duration: activity.duration || listing.duration,
      bestTime: activity.bestTime || listing.bestTime,
      availableStartTimes: activity.slots || [],
      includes: listing.includes || [],
    })),
  );
  const businessCatalog = (body.localSpots || []).map((spot) => ({
    name: spot.name,
    type: spot.type,
    estimatedPriceAED: Number(spot.price),
    priceRange: spot.priceLabel,
    hours: spot.hours,
    description: spot.description,
  }));

  return [
    "You are the itinerary planner inside an Al Qua'a local tourism marketplace.",
    "Create a detailed, practical schedule tailored to the visitor's interests.",
    "STRICT GROUNDING: use only activities and businesses in the supplied catalogs. Never invent a stop, activity, host, price, time slot, or inclusion.",
    "Schedule activities only at an availableStartTime and never before arrival.",
    "Stay within budget and prioritize close matches to the visitor request.",
    "For each activity state the exact experience, activity, host, duration, start time, AED cost, inclusions, and mapped-safe-zone reminder.",
    "Label local-business costs as estimates.",
    `Arrival time: ${body.arrival || "17:00"}.`,
    `Budget in AED: ${body.budget || 250}.`,
    `Visitor interests and constraints: ${String(body.preferences || "No preference supplied").slice(0, 500)}.`,
    `AVAILABLE ACTIVITIES: ${JSON.stringify(activityCatalog)}.`,
    `AVAILABLE LOCAL BUSINESSES: ${JSON.stringify(businessCatalog)}.`,
    "Return plain text without Markdown. Use one line per item:",
    "TIME–TIME | STOP OR ACTIVITY | Host/business; details; duration; AED cost; why it matches.",
    "Finish with TOTAL | AED amount | cost breakdown, then REMAINING | AED amount | budget remaining.",
    "Return 3 to 6 useful lines. If a request is unavailable, name the closest catalog alternative.",
  ].join("\n");
}

function buildFallbackPlan(body) {
  const budget = Number(body.budget || 250);
  const arrival = body.arrival || "17:00";
  const preferences = String(body.preferences || "").toLowerCase();
  const listings = body.listings || [];
  const localSpots = body.localSpots || [];
  const activities = listings
    .flatMap((listing) =>
      (listing.activities || []).map((activity) => ({
        listing,
        activity,
      })),
    )
    .map((item) => ({
      ...item,
      availableSlots: (item.activity.slots || []).filter((slot) => timeToMinutes(slot) >= timeToMinutes(arrival)),
      matchScore: preferenceScore(preferences, item),
    }))
    .filter((item) => Number(item.activity.price) <= budget && item.availableSlots.length)
    .sort((a, b) => b.matchScore - a.matchScore || Number(b.activity.price) - Number(a.activity.price));
  const dinner = localSpots.find((spot) => spot.type === "Restaurant") || localSpots[0];
  const dinnerCost = dinner ? Number(dinner.price || 0) : 0;
  const choice = activities.find((item) => Number(item.activity.price) + dinnerCost <= budget) || activities[0];

  if (!choice) {
    return `${arrival} | ARRIVAL | No available marketplace activity fits both this arrival time and the AED ${budget} budget.\nTOTAL | AED 0 | No booking selected.\nREMAINING | AED ${budget} | Adjust the arrival time, budget, or requested activity.`;
  }

  const activityCost = Number(choice.activity.price || 0);
  const canAddDinner = dinner && activityCost + dinnerCost <= budget;
  const total = activityCost + (canAddDinner ? dinnerCost : 0);
  const slot = choice.availableSlots[0];
  const host = choice.listing.businessName || choice.listing.ownerName;
  const duration = choice.activity.duration || choice.listing.duration || "duration confirmed by host";
  const includes = (choice.listing.includes || []).join(", ") || "see listing details";

  return [
    `${arrival} | ARRIVAL | Reach the visitor area, carry water, and review the blue safe-zone boundary.`,
    canAddDinner ? `${arrival} onward | ${dinner.name} | ${dinner.description}; estimated AED ${dinnerCost}; open ${dinner.hours}.` : null,
    `${slot} | ${choice.activity.name} | ${choice.listing.title}, hosted by ${host}; ${duration}; AED ${activityCost}; includes ${includes}; remain inside the mapped safe zone.`,
    `TOTAL | AED ${total} | Activity${canAddDinner ? " plus estimated local-business spending" : " only"}.`,
    `REMAINING | AED ${Math.max(0, budget - total)} | Available within the stated budget.`,
  ].filter(Boolean).join("\n");
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function preferenceScore(preferences, item) {
  if (!preferences) return 0;
  const searchable = [
    item.activity.name,
    item.listing.title,
    item.listing.description,
    ...(item.listing.includes || []),
  ].join(" ").toLowerCase();
  const words = preferences.match(/[a-z0-9]+/g) || [];
  return words.filter((word) => word.length > 2 && searchable.includes(word)).length;
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
