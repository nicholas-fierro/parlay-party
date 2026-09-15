"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BOOKS, sideLabel, sidesFor, STATS } from "./books";
import { USER_BY_ID } from "./fixtures/users";
import { hasStarted, randomCode, snapshotPrices, validateNewLeg, type Result } from "./rules";
import type { SlateIndex } from "./slate";
import type { Activity, ActivityType, BookId, Leg, Market, Room, RoomSettings, Side } from "./types";

/**
 * Mock backend for rooms/legs/activity. Shared state lives in localStorage and syncs
 * across tabs via `storage` events + BroadcastChannel, standing in for PocketBase realtime.
 * Odds come from `/api/slate` (see lib/slate.ts). The signed-in user is per tab.
 */

export interface DB {
  version: 2;
  rooms: Room[];
  legs: Leg[];
  activity: Activity[];
  attested: Record<string, boolean>;
  presence: Record<string, { roomId: string | null; at: number }>;
}

export const PRESENCE_TTL_MS = 15_000;

const DB_KEY = "pp:db:v2";
const USER_KEY = "pp:user";
const channel = typeof window !== "undefined" ? new BroadcastChannel("parlay-party") : null;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedDb: DB | null = null;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function empty(): DB {
  return { version: 2, rooms: [], legs: [], activity: [], attested: { alex: true, sam: true, jordan: true }, presence: {} };
}

function act(roomId: string, actorId: string, type: ActivityType, text: string, at = Date.now()): Activity {
  return { id: uid("act"), roomId, actorId, type, text, at };
}

function describe(leg: Pick<Leg, "playerName" | "stat" | "side">) {
  if (leg.stat === "anytime_td") return `${leg.playerName} Anytime TD`;
  return `${leg.playerName} ${sideLabel(leg.side)} ${STATS[leg.stat].short}`;
}

function read(): DB {
  const raw = localStorage.getItem(DB_KEY);
  if (raw && raw === cachedRaw && cachedDb) return cachedDb;
  if (raw) {
    try {
      cachedDb = JSON.parse(raw) as DB;
      cachedRaw = raw;
      return cachedDb;
    } catch {
      // fall through and reset
    }
  }
  // Seed silently: this runs inside getSnapshot, so no listener notifications.
  const fresh = empty();
  cachedRaw = JSON.stringify(fresh);
  cachedDb = fresh;
  localStorage.setItem(DB_KEY, cachedRaw);
  return fresh;
}

function write(db: DB) {
  const raw = JSON.stringify(db);
  localStorage.setItem(DB_KEY, raw);
  cachedRaw = raw;
  cachedDb = db;
  listeners.forEach((l) => l());
  channel?.postMessage("changed");
}

/** Read-modify-write against the latest stored copy. */
function mutate(fn: (db: DB) => void) {
  const db = structuredClone(read());
  fn(db);
  write(db);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY || e.key === null) listener();
  };
  const onMessage = () => listener();
  window.addEventListener("storage", onStorage);
  channel?.addEventListener("message", onMessage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onMessage);
  };
}

export function useDB(): DB | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// --- session (per tab) ---

const sessionListeners = new Set<() => void>();

export function useCurrentUserId(): string | null | undefined {
  return useSyncExternalStore(
    (l) => {
      sessionListeners.add(l);
      return () => sessionListeners.delete(l);
    },
    () => sessionStorage.getItem(USER_KEY),
    () => undefined,
  );
}

export function signIn(userId: string) {
  sessionStorage.setItem(USER_KEY, userId);
  sessionListeners.forEach((l) => l());
}

export function signOut() {
  sessionStorage.removeItem(USER_KEY);
  sessionListeners.forEach((l) => l());
}

// --- clock ---

let now = typeof window !== "undefined" ? Date.now() : 0;
const clockListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  setInterval(() => {
    now = Date.now();
    clockListeners.forEach((l) => l());
  }, 5_000);
}

export function useNow(): number {
  return useSyncExternalStore(
    (l) => {
      clockListeners.add(l);
      return () => clockListeners.delete(l);
    },
    () => now,
    () => 0,
  );
}

// --- presence ---

export function usePresence(userId: string | null | undefined, roomId: string | null) {
  useEffect(() => {
    if (!userId) return;
    const beat = () =>
      mutate((db) => {
        db.presence[userId] = { roomId, at: Date.now() };
      });
    beat();
    const t = setInterval(beat, 5_000);
    return () => clearInterval(t);
  }, [userId, roomId]);
}

export function isOnline(db: DB, userId: string, roomId: string, at: number) {
  const p = db.presence[userId];
  return !!p && p.roomId === roomId && at - p.at < PRESENCE_TTL_MS;
}

// --- actions ---

function legFrom(market: Market, index: SlateIndex, base: Pick<Leg, "roomId" | "ownerId" | "side">): Leg {
  const player = index.playerById[market.playerId];
  const game = index.gameById[market.gameId];
  const teamAbbr = [game?.home, game?.away].find((t) => t?.id === player?.teamId)?.abbr ?? "";
  return {
    id: uid("leg"),
    ...base,
    marketId: market.id,
    createdAt: Date.now(),
    playerId: market.playerId,
    playerName: player?.name ?? market.playerId,
    teamAbbr,
    gameId: market.gameId,
    stat: market.stat,
  };
}

export const actions = {
  attest(userId: string) {
    mutate((db) => {
      db.attested[userId] = true;
    });
  },

  createRoom(userId: string, name: string, settings: RoomSettings, index: SlateIndex): string {
    const code = randomCode();
    mutate((db) => {
      const room: Room = {
        id: uid("room"),
        code,
        name: name.trim() || "Untitled room",
        hostId: userId,
        memberIds: [userId],
        settings,
        games: settings.gameIds.map((id) => index.gameById[id]).filter(Boolean),
        status: "open",
        createdAt: Date.now(),
      };
      db.rooms.unshift(room);
      db.activity.push(act(room.id, userId, "created", "created the room"));
    });
    return code;
  },

  /** Demo helper: a room with two friends who already added picks from the current slate. */
  createDemoRoom(userId: string, index: SlateIndex): string {
    const nowMs = Date.now();
    const upcoming = index.slate.games.filter((g) => !hasStarted(g, nowMs));
    const friends = ["alex", "sam", "jordan", "taylor"].filter((id) => id !== userId).slice(0, 2);
    const code = randomCode();
    mutate((db) => {
      const room: Room = {
        id: uid("room"),
        code,
        name: "Demo Slate",
        hostId: userId,
        memberIds: [userId, ...friends],
        settings: { picksPerPerson: 2, maxMembers: 4, propTypes: "ALL", gameIds: upcoming.map((g) => g.id) },
        games: upcoming,
        status: "open",
        createdAt: nowMs,
      };
      db.rooms.unshift(room);
      db.activity.push(act(room.id, userId, "created", "created the room", nowMs - 60_000));
      friends.forEach((f) => db.attested[f] = true);

      // Markets offered by the most books give the ranking something to compare.
      const candidates = index.slate.markets
        .filter((m) => room.settings.gameIds.includes(m.gameId))
        .map((m) => {
          const side = sidesFor(m.stat)[0];
          return { m, side, books: Object.values(m.byBook).filter((b) => b?.[side]).length };
        })
        .sort((a, b) => b.books - a.books);
      const usedPlayers = new Set<string>();
      let i = 0;
      for (const friend of friends) {
        db.activity.push(act(room.id, friend, "joined", "joined", nowMs - 50_000));
        let added = 0;
        while (added < 2 && i < candidates.length) {
          const { m, side } = candidates[i++];
          if (usedPlayers.has(m.playerId)) continue;
          usedPlayers.add(m.playerId);
          const leg = legFrom(m, index, { roomId: room.id, ownerId: friend, side });
          db.legs.push(leg);
          db.activity.push(act(room.id, friend, "added", `added ${describe(leg)}`, nowMs - 40_000 + added));
          added++;
        }
      }
    });
    return code;
  },

  joinRoom(userId: string, code: string): Result & { code?: string } {
    const db = read();
    const room = db.rooms.find((r) => r.code === code.trim().toUpperCase());
    if (!room) return { ok: false, reason: "No room with that code" };
    if (room.memberIds.includes(userId)) return { ok: true, code: room.code };
    if (room.status !== "open") return { ok: false, reason: "Room is locked" };
    if (room.memberIds.length >= room.settings.maxMembers) return { ok: false, reason: "Room is full" };
    mutate((d) => {
      const r = d.rooms.find((x) => x.id === room.id)!;
      r.memberIds.push(userId);
      d.activity.push(act(r.id, userId, "joined", "joined"));
    });
    return { ok: true, code: room.code };
  },

  addLeg(userId: string, roomId: string, market: Market, side: Side, index: SlateIndex): Result {
    const db = read();
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, reason: "Room not found" };
    const legs = db.legs.filter((l) => l.roomId === roomId);
    const result = validateNewLeg({ room, legs, userId, market, side, now: Date.now() });
    if (!result.ok) return result;
    mutate((d) => {
      const leg = legFrom(market, index, { roomId, ownerId: userId, side });
      d.legs.push(leg);
      d.activity.push(act(roomId, userId, "added", `added ${describe(leg)}`));
    });
    return { ok: true };
  },

  removeLeg(userId: string, legId: string) {
    mutate((db) => {
      const leg = db.legs.find((l) => l.id === legId);
      const room = leg && db.rooms.find((r) => r.id === leg.roomId);
      if (!leg || !room || room.status !== "open") return;
      if (leg.ownerId !== userId && room.hostId !== userId) return;
      db.legs = db.legs.filter((l) => l.id !== legId);
      const own = leg.ownerId === userId;
      const owner = USER_BY_ID[leg.ownerId]?.name ?? "someone";
      db.activity.push(
        act(
          room.id,
          userId,
          own ? "removed" : "host_removed",
          own ? `removed ${describe(leg)}` : `removed ${owner}'s ${describe(leg)}`,
        ),
      );
    });
  },

  /** Caller refreshes the slate first so the snapshot uses current prices. */
  lock(userId: string, roomId: string, index: SlateIndex) {
    mutate((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room || room.hostId !== userId || room.status !== "open") return;
      const legs = db.legs.filter((l) => l.roomId === roomId);
      room.status = "locked";
      room.snapshot = snapshotPrices(legs, index, Date.now());
      db.activity.push(act(roomId, userId, "locked", "locked the slip"));
    });
  },

  unlock(userId: string, roomId: string) {
    mutate((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room || room.hostId !== userId || room.status === "open") return;
      room.status = "open";
      delete room.snapshot;
      db.activity.push(act(roomId, userId, "unlocked", "unlocked the slip"));
    });
  },

  logSend(userId: string, roomId: string, book: BookId, via: string) {
    mutate((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room || room.status === "open") return;
      room.status = "sent";
      db.activity.push(act(roomId, userId, "sent", `sent to ${BOOKS[book].name} (${via})`));
    });
  },

  deleteRoom(userId: string, roomId: string) {
    mutate((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room || room.hostId !== userId) return;
      db.rooms = db.rooms.filter((r) => r.id !== roomId);
      db.legs = db.legs.filter((l) => l.roomId !== roomId);
      db.activity = db.activity.filter((a) => a.roomId !== roomId);
    });
  },

  resetDemo() {
    localStorage.removeItem(DB_KEY);
    cachedRaw = null;
    cachedDb = null;
    write(empty());
  },
};
