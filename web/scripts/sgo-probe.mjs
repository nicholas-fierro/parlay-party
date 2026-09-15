#!/usr/bin/env node
// Probe SportsGameOdds with minimal usage (1 event object) to verify what the
// free tier returns for NFL pick'em props. Raw responses land in .sgo-cache/.
//
// Usage: node scripts/sgo-probe.mjs            (1 upcoming NFL event)
//        node scripts/sgo-probe.mjs --usage    (account usage only, no objects)

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://api.sportsgameodds.com/v2";
const PICKEM = ["prizepicks", "underdog", "sleeper"];

function loadKey() {
  if (process.env.SGO_API_KEY) return process.env.SGO_API_KEY;
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("SGO_API_KEY="));
  return line?.slice("SGO_API_KEY=".length).trim().replace(/^["']|["']$/g, "") || null;
}

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-api-key": key } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

function save(name, data) {
  const dir = join(root, ".sgo-cache");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2));
  return join(".sgo-cache", name);
}

const key = loadKey();
if (!key) {
  console.error("No SGO_API_KEY found in environment or web/.env.local");
  process.exit(1);
}

const usage = await get("/account/usage");
console.log("Usage file:", save("usage.json", usage));
console.log(JSON.stringify(usage.data ?? usage, null, 2).slice(0, 1500));
if (process.argv.includes("--usage")) process.exit(0);

// Step 1: one upcoming NFL event, all bookmakers, to learn which books the tier includes.
const all = await get("/events", { leagueID: "NFL", oddsAvailable: true, started: false, limit: 1 });
const event = all.data?.[0];
if (!event) {
  console.log("No upcoming NFL events with odds.");
  process.exit(0);
}
console.log("\nEvent file:", save("event-all-books.json", all));
console.log(`Event ${event.eventID}: ${event.teams?.away?.names?.short} @ ${event.teams?.home?.names?.short} ${event.status?.startsAt}`);

const odds = Object.values(event.odds ?? {});
const books = new Map();
const playerStats = new Map();
const deeplinks = {};
for (const o of odds) {
  for (const [book, bo] of Object.entries(o.byBookmaker ?? {})) {
    books.set(book, (books.get(book) ?? 0) + 1);
    if (PICKEM.includes(book) && bo.deeplink && !deeplinks[book]) deeplinks[book] = bo.deeplink;
  }
  const isPlayer = !["all", "home", "away"].includes(o.statEntityID);
  if (isPlayer && o.periodID === "game") {
    const k = `${o.statID} (${o.betTypeID})`;
    const entry = playerStats.get(k) ?? { markets: 0, pickem: new Set() };
    entry.markets++;
    for (const b of Object.keys(o.byBookmaker ?? {})) if (PICKEM.includes(b)) entry.pickem.add(b);
    playerStats.set(k, entry);
  }
}

console.log(`\nBookmakers in response (${books.size}):`);
for (const [b, n] of [...books].sort((a, z) => z[1] - a[1])) console.log(`  ${b.padEnd(20)} ${n} odds`);

console.log("\nPick'em coverage:", PICKEM.map((b) => `${b}=${books.has(b) ? "yes" : "NO"}`).join("  "));

console.log("\nPlayer game-period statIDs:");
for (const [k, v] of [...playerStats].sort()) {
  console.log(`  ${k.padEnd(40)} ${String(v.markets).padStart(4)} odds  pickem: ${[...v.pickem].join(",") || "-"}`);
}

console.log("\nSample pick'em deeplinks:", deeplinks);

const samplePlayer = Object.values(event.players ?? {})[0];
console.log("\nSample player object:", JSON.stringify(samplePlayer, null, 2));

const sampleProp = odds.find((o) => !["all", "home", "away"].includes(o.statEntityID) && o.betTypeID === "ou");
console.log("\nSample player O/U odd:", JSON.stringify(sampleProp, null, 2)?.slice(0, 2000));
