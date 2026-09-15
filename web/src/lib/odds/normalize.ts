import { BOOK_IDS, STAT_BY_SGO } from "../books";
import type { BookId, Game, Market, Player, Price, Side } from "../types";

// Minimal shapes of the SGO v2 /events response fields we read.
export interface SgoBookOdds {
  odds?: string;
  overUnder?: string;
  available?: boolean;
  deeplink?: string;
}

export interface SgoOdd {
  oddID: string;
  statID: string;
  statEntityID: string;
  periodID: string;
  betTypeID: string;
  sideID: string;
  playerID?: string;
  fairOdds?: string;
  fairOverUnder?: string;
  byBookmaker?: Record<string, SgoBookOdds>;
}

export interface SgoTeam {
  teamID: string;
  names?: { long?: string; medium?: string; short?: string };
  colors?: { primary?: string };
}

export interface SgoEvent {
  eventID: string;
  teams: { home: SgoTeam; away: SgoTeam };
  status: { startsAt: string; started?: boolean };
  players?: Record<string, { playerID: string; teamID: string; name?: string; firstName?: string; lastName?: string }>;
  odds?: Record<string, SgoOdd>;
}

const SIDES: Record<string, Side> = { over: "over", under: "under", yes: "yes" };

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function team(t: SgoTeam) {
  return {
    id: t.teamID,
    abbr: t.names?.short ?? t.teamID.slice(0, 3),
    name: t.names?.medium ?? t.names?.long ?? t.teamID,
    color: t.colors?.primary || "#334155",
  };
}

/** Converts SGO events into our slate shape, keeping only v1 stats and books. */
export function normalizeEvents(events: SgoEvent[]) {
  const games: Game[] = [];
  const players: Player[] = [];
  const markets = new Map<string, Market>();

  for (const ev of events) {
    const game: Game = {
      id: ev.eventID,
      away: team(ev.teams.away),
      home: team(ev.teams.home),
      startsAt: Date.parse(ev.status.startsAt),
    };
    games.push(game);

    const seenPlayers = new Set<string>();
    for (const odd of Object.values(ev.odds ?? {})) {
      if (odd.periodID !== "game" || !odd.playerID) continue;
      const stat = STAT_BY_SGO[`${odd.statID}|${odd.betTypeID}`];
      const side = SIDES[odd.sideID];
      if (!stat || !side) continue;

      const byBook: Partial<Record<BookId, Price>> = {};
      for (const book of BOOK_IDS) {
        const bo = odd.byBookmaker?.[book];
        const odds = num(bo?.odds);
        if (!bo || bo.available === false || odds === null) continue;
        byBook[book] = { line: num(bo.overUnder), odds, ...(bo.deeplink ? { deeplink: bo.deeplink } : {}) };
      }
      if (Object.keys(byBook).length === 0) continue;

      const id = `${odd.statID}-${odd.playerID}`;
      const market: Market = markets.get(id) ?? { id, playerId: odd.playerID, gameId: game.id, stat, fair: {}, byBook: {} };
      const fairOdds = num(odd.fairOdds);
      if (fairOdds !== null) market.fair[side] = { line: num(odd.fairOverUnder), odds: fairOdds };
      for (const [book, price] of Object.entries(byBook) as [BookId, Price][]) {
        market.byBook[book] = { ...market.byBook[book], [side]: price };
      }
      markets.set(id, market);

      if (!seenPlayers.has(odd.playerID)) {
        seenPlayers.add(odd.playerID);
        const p = ev.players?.[odd.playerID];
        players.push({
          id: odd.playerID,
          name: p?.name ?? ([p?.firstName, p?.lastName].filter(Boolean).join(" ") || odd.playerID),
          teamId: p?.teamID ?? "",
          gameId: game.id,
        });
      }
    }
  }

  games.sort((a, b) => a.startsAt - b.startsAt);
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { games, players, markets: [...markets.values()] };
}
