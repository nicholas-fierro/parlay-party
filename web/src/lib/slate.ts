"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Game, Market, Player, Slate } from "./types";

/** Client cache of `/api/slate`. The server owns the SGO key, caching and budget. */

export interface SlateIndex {
  slate: Slate;
  gameById: Record<string, Game>;
  playerById: Record<string, Player>;
  marketById: Record<string, Market>;
}

let current: Slate | null = null;
let error: string | null = null;
let loading: Promise<Slate | null> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function loadSlate(force = false): Promise<Slate | null> {
  if (loading && !force) return loading;
  loading = fetch(`/api/slate${force ? "?force=1" : ""}`, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Odds request failed (${res.status})`);
      current = (await res.json()) as Slate;
      error = null;
      return current;
    })
    .catch((err: Error) => {
      error = err.message;
      return current;
    })
    .finally(() => {
      loading = null;
      emit();
    });
  return loading;
}

export function useSlate(): { index: SlateIndex | null; error: string | null } {
  const slate = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );

  useEffect(() => {
    if (!current) void loadSlate();
  }, []);

  const index = useMemo(() => (slate ? buildIndex(slate) : null), [slate]);
  return { index, error };
}

export function buildIndex(slate: Slate): SlateIndex {
  return {
    slate,
    gameById: Object.fromEntries(slate.games.map((g) => [g.id, g])),
    playerById: Object.fromEntries(slate.players.map((p) => [p.id, p])),
    marketById: Object.fromEntries(slate.markets.map((m) => [m.id, m])),
  };
}
