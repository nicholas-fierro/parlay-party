"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { BOOK_IDS, formatAmerican, sideLabel, sidesFor, STATS } from "@/lib/books";
import { hasStarted, statAllowed, validateNewLeg } from "@/lib/rules";
import type { SlateIndex } from "@/lib/slate";
import { actions } from "@/lib/store";
import type { Leg, Market, Player, Room, Side } from "@/lib/types";
import { BookChip, Button, cx, kickoffLabel, Sheet } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  index: SlateIndex;
  room: Room;
  legs: Leg[];
  userId: string;
  now: number;
}

export function AddPickSheet({ open, onClose, index, room, legs, userId, now }: Props) {
  const [query, setQuery] = useState("");
  const [gameId, setGameId] = useState<string | "all">("all");
  const [player, setPlayer] = useState<Player | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gameById = useMemo(() => new Map(room.games.map((g) => [g.id, g])), [room.games]);

  const marketsByPlayer = useMemo(() => {
    const map = new Map<string, Market[]>();
    for (const m of index.slate.markets) {
      if (!gameById.has(m.gameId) || !statAllowed(room.settings, m.stat)) continue;
      map.set(m.playerId, [...(map.get(m.playerId) ?? []), m]);
    }
    return map;
  }, [index, gameById, room.settings]);

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    const started = (p: Player) => {
      const g = gameById.get(p.gameId);
      return g ? hasStarted(g, now) : true;
    };
    return index.slate.players
      .filter((p) => marketsByPlayer.has(p.id))
      .filter((p) => gameId === "all" || p.gameId === gameId)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || teamOf(p)?.abbr.toLowerCase() === q)
      .sort(
        (a, b) =>
          Number(started(a)) - Number(started(b)) ||
          (marketsByPlayer.get(b.id)?.length ?? 0) - (marketsByPlayer.get(a.id)?.length ?? 0),
      );

    function teamOf(p: Player) {
      const g = gameById.get(p.gameId);
      return [g?.home, g?.away].find((t) => t?.id === p.teamId);
    }
  }, [query, gameId, index, marketsByPlayer, gameById, now]);

  function close() {
    setPlayer(null);
    setMarket(null);
    setError(null);
    setQuery("");
    onClose();
  }

  function add(side: Side) {
    if (!market) return;
    const res = actions.addLeg(userId, room.id, market, side, index);
    if (!res.ok) return setError(res.reason);
    close();
  }

  const title = market ? "Pick a side" : player ? player.name : "Add a pick";

  return (
    <Sheet open={open} onClose={close} title={title}>
      {!player && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players or team (KC)"
              className="w-full h-11 rounded-xl bg-surface-2 border border-border pl-9 pr-3 outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
            <GameChip active={gameId === "all"} onClick={() => setGameId("all")}>
              All games
            </GameChip>
            {room.games.map((g) => (
              <GameChip key={g.id} active={gameId === g.id} onClick={() => setGameId(g.id)}>
                {g.away.abbr} @ {g.home.abbr}
              </GameChip>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {players.map((p) => {
              const game = gameById.get(p.gameId);
              const started = game ? hasStarted(game, now) : false;
              const team = [game?.home, game?.away].find((t) => t?.id === p.teamId);
              return (
                <li key={p.id}>
                  <button
                    disabled={started}
                    onClick={() => setPlayer(p)}
                    className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-40"
                  >
                    <span
                      className="size-9 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: team?.color ?? "#334155" }}
                    >
                      {team?.abbr ?? "?"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{p.name}</span>
                      <span className="block text-xs text-muted">
                        {game ? `${game.away.abbr} @ ${game.home.abbr} · ` : ""}
                        {marketsByPlayer.get(p.id)?.length ?? 0} props
                      </span>
                    </span>
                    <span className={cx("text-xs", started ? "text-danger" : "text-muted")}>
                      {game ? (started ? "Started" : kickoffLabel(game.startsAt, now)) : ""}
                    </span>
                  </button>
                </li>
              );
            })}
            {players.length === 0 && <li className="py-6 text-center text-sm text-muted">No players match</li>}
          </ul>
        </div>
      )}

      {player && !market && (
        <div className="space-y-3">
          <BackLink onClick={() => setPlayer(null)}>All players</BackLink>
          <ul className="space-y-2">
            {(marketsByPlayer.get(player.id) ?? []).map((m) => {
              const taken = legs.find((l) => l.marketId === m.id);
              const side = sidesFor(m.stat)[0];
              const fair = m.fair[side];
              return (
                <li key={m.id}>
                  <button
                    disabled={!!taken}
                    onClick={() => {
                      setError(null);
                      setMarket(m);
                    }}
                    className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left disabled:opacity-50 hover:border-accent/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{STATS[m.stat].label}</span>
                      {fair && (
                        <span className="text-xs text-muted tabular">
                          fair {fair.line != null ? fair.line : formatAmerican(fair.odds)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {BOOK_IDS.filter((b) => m.byBook[b]?.[side]).map((b) => (
                        <BookChip key={b} book={b} />
                      ))}
                    </div>
                    {taken && <div className="mt-2 text-xs text-warn">Already on slip</div>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {player && market && (
        <div className="space-y-4">
          <BackLink onClick={() => setMarket(null)}>{player.name}</BackLink>
          <div className="text-center text-lg font-semibold">{STATS[market.stat].label}</div>
          <div className={cx("grid gap-3", sidesFor(market.stat).length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {sidesFor(market.stat).map((side) => {
              const check = validateNewLeg({ room, legs, userId, market, side, now });
              const fair = market.fair[side];
              return (
                <div key={side} className="space-y-2">
                  <Button
                    variant={side === "under" ? "secondary" : "primary"}
                    className="w-full h-12"
                    disabled={!check.ok}
                    onClick={() => add(side)}
                  >
                    {sideLabel(side)}
                    {fair?.line != null ? ` ${fair.line}` : ""}
                  </Button>
                  <ul className="rounded-xl border border-border divide-y divide-border text-sm">
                    {BOOK_IDS.map((b) => {
                      const p = market.byBook[b]?.[side];
                      return (
                        <li key={b} className="flex items-center justify-between px-2.5 py-1.5">
                          <BookChip book={b} />
                          <span className={cx("tabular", !p && "text-muted")}>
                            {p ? `${p.line != null ? `${p.line} · ` : ""}${formatAmerican(p.odds)}` : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {!check.ok && <p className="text-[11px] text-warn text-center">{check.reason}</p>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted text-center">
            Your pick isn&apos;t tied to one book. The best payout is chosen when the host locks the slip.
          </p>
          {error && <p className="text-sm text-danger text-center">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}

function GameChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "h-8 px-3 rounded-full border text-xs whitespace-nowrap",
        active ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted",
      )}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <ChevronLeft size={16} /> {children}
    </button>
  );
}
