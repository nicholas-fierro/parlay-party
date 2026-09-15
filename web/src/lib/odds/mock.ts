import { BOOK_IDS } from "../books";
import type { BookId, Game, Market, Player, Price, Side, Slate, StatKey, Team } from "../types";

/** Offline fixture slate in the same shape as the SGO adapter output. */

const TEAMS: Record<string, Team> = {
  DAL: { id: "DALLAS_COWBOYS_NFL", abbr: "DAL", name: "Cowboys", color: "#003594" },
  PHI: { id: "PHILADELPHIA_EAGLES_NFL", abbr: "PHI", name: "Eagles", color: "#004C54" },
  KC: { id: "KANSAS_CITY_CHIEFS_NFL", abbr: "KC", name: "Chiefs", color: "#AA0114" },
  BUF: { id: "BUFFALO_BILLS_NFL", abbr: "BUF", name: "Bills", color: "#00338D" },
  CIN: { id: "CINCINNATI_BENGALS_NFL", abbr: "CIN", name: "Bengals", color: "#FB4F14" },
  BAL: { id: "BALTIMORE_RAVENS_NFL", abbr: "BAL", name: "Ravens", color: "#241773" },
  DET: { id: "DETROIT_LIONS_NFL", abbr: "DET", name: "Lions", color: "#0076B6" },
  SF: { id: "SAN_FRANCISCO_49ERS_NFL", abbr: "SF", name: "49ers", color: "#AA0000" },
};

// [away, home, minutes from epoch]
const GAME_SEEDS: [string, string, number][] = [
  ["DAL", "PHI", -25],
  ["KC", "BUF", 120],
  ["CIN", "BAL", 120],
  ["DET", "SF", 305],
];

type Pos = "QB" | "RB" | "WR" | "TE";
const PLAYER_SEEDS: [string, string, Pos, number][] = [
  ["Dak Prescott", "DAL", "QB", 1.03],
  ["CeeDee Lamb", "DAL", "WR", 1.25],
  ["Jalen Hurts", "PHI", "QB", 0.9],
  ["Saquon Barkley", "PHI", "RB", 1.3],
  ["Patrick Mahomes", "KC", "QB", 1.05],
  ["Travis Kelce", "KC", "TE", 0.9],
  ["Josh Allen", "BUF", "QB", 1.02],
  ["James Cook", "BUF", "RB", 1.05],
  ["Joe Burrow", "CIN", "QB", 1.12],
  ["Ja'Marr Chase", "CIN", "WR", 1.35],
  ["Lamar Jackson", "BAL", "QB", 0.95],
  ["Derrick Henry", "BAL", "RB", 1.35],
  ["Jared Goff", "DET", "QB", 1.06],
  ["Amon-Ra St. Brown", "DET", "WR", 1.2],
  ["Jahmyr Gibbs", "DET", "RB", 1.2],
  ["Christian McCaffrey", "SF", "RB", 1.25],
];

const STAT_BASE: Record<StatKey, { base: number; drift: number; positions: Pos[]; sgo: string }> = {
  pass_yds: { base: 245, drift: 6, positions: ["QB"], sgo: "passing_yards" },
  pass_tds: { base: 1.5, drift: 0, positions: ["QB"], sgo: "passing_touchdowns" },
  completions: { base: 22.5, drift: 1, positions: ["QB"], sgo: "passing_completions" },
  pass_att: { base: 34.5, drift: 1, positions: ["QB"], sgo: "passing_attempts" },
  ints: { base: 0.5, drift: 0, positions: ["QB"], sgo: "passing_interceptions" },
  rush_yds: { base: 68.5, drift: 4, positions: ["RB"], sgo: "rushing_yards" },
  rush_att: { base: 15.5, drift: 1, positions: ["RB"], sgo: "rushing_attempts" },
  receptions: { base: 5.5, drift: 1, positions: ["RB", "WR", "TE"], sgo: "receiving_receptions" },
  rec_yds: { base: 62.5, drift: 4, positions: ["WR", "TE"], sgo: "receiving_yards" },
  rush_rec_yds: { base: 92.5, drift: 5, positions: ["RB"], sgo: "rushing+receiving_yards" },
  pass_rush_yds: { base: 270.5, drift: 6, positions: ["QB"], sgo: "passing+rushing_yards" },
  anytime_td: { base: 0, drift: 0, positions: ["RB", "WR", "TE"], sgo: "touchdowns" },
};

const MISSING_RATE: Record<BookId, number> = {
  fanduel: 0.03,
  draftkings: 0.06,
  betmgm: 0.2,
  caesars: 0.35,
  espnbet: 0.25,
};

function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function slugId(name: string) {
  return `${name.toUpperCase().replace(/[^A-Z]+/g, "_").replace(/^_|_$/g, "")}_1_NFL`;
}

function juice(key: string): number {
  // -105 .. -125 or occasionally plus money
  const r = rand(key);
  return r > 0.9 ? 100 + Math.round(r * 20) : -105 - Math.round(r * 22);
}

export function mockSlate(epoch: number): Slate {
  const games: Game[] = GAME_SEEDS.map(([away, home, offset], i) => ({
    id: `mock_game_${i + 1}`,
    away: TEAMS[away],
    home: TEAMS[home],
    startsAt: epoch + offset * 60_000,
  }));

  const players: Player[] = [];
  const markets: Market[] = [];

  for (const [name, abbr, pos, factor] of PLAYER_SEEDS) {
    const team = TEAMS[abbr];
    const game = games.find((g) => g.away.abbr === abbr || g.home.abbr === abbr)!;
    const player: Player = { id: slugId(name), name, teamId: team.id, gameId: game.id };
    players.push(player);

    for (const [stat, def] of Object.entries(STAT_BASE) as [StatKey, (typeof STAT_BASE)[StatKey]][]) {
      if (!def.positions.includes(pos)) continue;
      const id = `${def.sgo}-${player.id}`;
      const market: Market = { id, playerId: player.id, gameId: game.id, stat, fair: {}, byBook: {} };

      if (stat === "anytime_td") {
        const fairYes = factor > 1.2 ? -120 : factor > 1 ? 130 : 210;
        market.fair.yes = { line: null, odds: fairYes };
        for (const book of BOOK_IDS) {
          if (rand(`${id}:${book}:miss`) < MISSING_RATE[book]) continue;
          const shift = Math.round((rand(`${id}:${book}`) - 0.6) * 40);
          market.byBook[book] = { yes: { line: null, odds: bump(fairYes, shift), deeplink: link(book, id, "yes") } };
        }
      } else {
        const fairLine = def.drift === 0 ? def.base : Math.floor(def.base * factor) + 0.5;
        market.fair.over = { line: fairLine, odds: -110 };
        market.fair.under = { line: fairLine, odds: -110 };
        for (const book of BOOK_IDS) {
          if (rand(`${id}:${book}:miss`) < MISSING_RATE[book]) continue;
          const line = Math.max(0.5, fairLine + Math.round((rand(`${id}:${book}`) * 2 - 1) * def.drift));
          const sides: Partial<Record<Side, Price>> = {
            over: { line, odds: juice(`${id}:${book}:o`), deeplink: link(book, id, "over") },
            under: { line, odds: juice(`${id}:${book}:u`), deeplink: link(book, id, "under") },
          };
          market.byBook[book] = sides;
        }
      }
      if (Object.keys(market.byBook).length > 0) markets.push(market);
    }
  }

  return { source: "mock", fetchedAt: Date.now(), games, players, markets };
}

function bump(american: number, shift: number): number {
  const v = american + shift;
  if (v > -100 && v < 100) return v >= 0 ? 100 + v : -100 + v;
  return v;
}

function link(book: BookId, marketId: string, side: Side): string {
  const sel = Math.floor(rand(`${marketId}:${side}`) * 90_000_000) + 10_000_000;
  switch (book) {
    case "fanduel":
      return `https://sportsbook.fanduel.com/addToBetslip?marketId=42.${sel}&selectionId=${sel % 100000}`;
    case "draftkings":
      return `https://sportsbook.draftkings.com/event/34118255?outcomes=0QA${sel}`;
    case "betmgm":
      return `https://sports.betmgm.com/en/sports?options=${sel}-${sel + 1}`;
    case "caesars":
      return `https://sportsbook.caesars.com/us/bet/betslip?selectionIds=mock-${sel}`;
    case "espnbet":
      return `https://espnbet.app.link/?market_selection_id[0]=mock-${sel}`;
  }
}
