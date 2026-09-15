import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BOOK_IDS } from "../books";
import type { Slate } from "../types";
import { normalizeEvents, type SgoEvent } from "./normalize";

const BASE = "https://api.sportsgameodds.com/v2";
export const CACHE_MS = 30 * 60_000;
/** Minimum gap between forced refreshes (lock). */
const FORCE_MIN_MS = 2 * 60_000;
const MONTHLY_LIMIT = 2500;
/** Stop spending objects near the cap; a full NFL refresh is ~16 objects. */
const BUDGET_STOP = 2400;
const LOOKAHEAD_MS = 8 * 24 * 60 * 60_000;
const DISK_CACHE = join(process.cwd(), ".sgo-cache", "slate.json");

let memory: Slate | null = null;
let inflight: Promise<Slate> | null = null;

async function sgoGet<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "x-api-key": key }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SGO ${res.status}: ${body?.error ?? "request failed"}`);
  return body as T;
}

async function usedThisMonth(key: string): Promise<number> {
  const body = await sgoGet<{ data: { rateLimits: { "per-month": { "current-entities": number } } } }>(
    "/account/usage",
    {},
    key,
  );
  return body.data.rateLimits["per-month"]["current-entities"];
}

async function fetchSlate(key: string): Promise<Slate> {
  const used = await usedThisMonth(key);
  if (used >= BUDGET_STOP) throw new BudgetError(used);

  const events: SgoEvent[] = [];
  let cursor: string | undefined;
  do {
    const page = await sgoGet<{ data: SgoEvent[]; nextCursor?: string }>(
      "/events",
      {
        leagueID: "NFL",
        oddsAvailable: "true",
        started: "false",
        startsBefore: new Date(Date.now() + LOOKAHEAD_MS).toISOString(),
        bookmakerID: BOOK_IDS.join(","),
        limit: "50",
        ...(cursor ? { cursor } : {}),
      },
      key,
    ).catch((err: Error) => {
      // SGO may return a cursor with no further results (404).
      if (cursor && err.message.startsWith("SGO 404")) return { data: [], nextCursor: undefined };
      throw err;
    });
    events.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);

  return {
    source: "sgo",
    fetchedAt: Date.now(),
    ...normalizeEvents(events),
    usage: { used: used + events.length, limit: MONTHLY_LIMIT },
  };
}

export class BudgetError extends Error {
  constructor(public used: number) {
    super(`Monthly odds budget nearly used (${used}/${MONTHLY_LIMIT})`);
  }
}

async function readDisk(): Promise<Slate | null> {
  try {
    return JSON.parse(await readFile(DISK_CACHE, "utf8")) as Slate;
  } catch {
    return null;
  }
}

async function writeDisk(slate: Slate) {
  try {
    await mkdir(join(process.cwd(), ".sgo-cache"), { recursive: true });
    await writeFile(DISK_CACHE, JSON.stringify(slate));
  } catch {
    // Read-only filesystem in some hosts; memory cache still applies.
  }
}

/**
 * Cached slate. Serves memory/disk cache under 30 min; `force` (used on lock)
 * refreshes if the cache is older than 2 min. Falls back to stale data with a
 * warning when the budget guard or API fails.
 */
export async function getSgoSlate(key: string, force = false): Promise<Slate> {
  memory ??= await readDisk();
  const age = memory ? Date.now() - memory.fetchedAt : Infinity;
  if (memory && age < (force ? FORCE_MIN_MS : CACHE_MS)) return memory;

  inflight ??= fetchSlate(key)
    .then(async (slate) => {
      memory = slate;
      await writeDisk(slate);
      return slate;
    })
    .catch((err: Error) => {
      if (memory) return { ...memory, warning: `${err.message}. Showing cached odds.` };
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
