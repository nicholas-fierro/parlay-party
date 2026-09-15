import type { BookId, Side, Sportsbook, StatKey } from "./types";

// Leg caps are placeholders until verified against each book.
export const BOOKS: Record<BookId, Sportsbook> = {
  fanduel: { id: "fanduel", name: "FanDuel", short: "FD", color: "#1493ff", maxLegs: 25 },
  draftkings: { id: "draftkings", name: "DraftKings", short: "DK", color: "#61b510", maxLegs: 25 },
  betmgm: { id: "betmgm", name: "BetMGM", short: "MGM", color: "#c5a562", maxLegs: 20 },
  caesars: { id: "caesars", name: "Caesars", short: "CZR", color: "#b8a36a", maxLegs: 15 },
  espnbet: { id: "espnbet", name: "ESPN BET", short: "ESPN", color: "#ed174c", maxLegs: 20 },
};

export const BOOK_IDS = Object.keys(BOOKS) as BookId[];

export interface StatDef {
  key: StatKey;
  label: string;
  short: string;
  /** SGO statID + betTypeID this maps to. */
  sgoStatID: string;
  betType: "ou" | "yn";
}

export const STATS: Record<StatKey, StatDef> = {
  pass_yds: { key: "pass_yds", label: "Pass Yards", short: "Pass Yds", sgoStatID: "passing_yards", betType: "ou" },
  pass_tds: { key: "pass_tds", label: "Pass TDs", short: "Pass TDs", sgoStatID: "passing_touchdowns", betType: "ou" },
  completions: { key: "completions", label: "Completions", short: "Comp", sgoStatID: "passing_completions", betType: "ou" },
  pass_att: { key: "pass_att", label: "Pass Attempts", short: "Pass Att", sgoStatID: "passing_attempts", betType: "ou" },
  ints: { key: "ints", label: "Interceptions", short: "INTs", sgoStatID: "passing_interceptions", betType: "ou" },
  rush_yds: { key: "rush_yds", label: "Rush Yards", short: "Rush Yds", sgoStatID: "rushing_yards", betType: "ou" },
  rush_att: { key: "rush_att", label: "Rush Attempts", short: "Rush Att", sgoStatID: "rushing_attempts", betType: "ou" },
  receptions: { key: "receptions", label: "Receptions", short: "Rec", sgoStatID: "receiving_receptions", betType: "ou" },
  rec_yds: { key: "rec_yds", label: "Receiving Yards", short: "Rec Yds", sgoStatID: "receiving_yards", betType: "ou" },
  rush_rec_yds: { key: "rush_rec_yds", label: "Rush + Rec Yards", short: "Rush+Rec", sgoStatID: "rushing+receiving_yards", betType: "ou" },
  pass_rush_yds: { key: "pass_rush_yds", label: "Pass + Rush Yards", short: "Pass+Rush", sgoStatID: "passing+rushing_yards", betType: "ou" },
  anytime_td: { key: "anytime_td", label: "Anytime TD", short: "Anytime TD", sgoStatID: "touchdowns", betType: "yn" },
};

export const STAT_KEYS = Object.keys(STATS) as StatKey[];

export const STAT_BY_SGO: Record<string, StatKey> = Object.fromEntries(
  STAT_KEYS.map((k) => [`${STATS[k].sgoStatID}|${STATS[k].betType}`, k]),
);

export function sidesFor(stat: StatKey): Side[] {
  return STATS[stat].betType === "yn" ? ["yes"] : ["over", "under"];
}

export function sideLabel(side: Side): string {
  return side === "over" ? "Over" : side === "under" ? "Under" : "Yes";
}

// --- odds math ---

export function americanToDecimal(american: number): number {
  return american >= 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) return 0;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export function formatAmerican(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}
