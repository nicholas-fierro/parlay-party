export type BookId = "fanduel" | "draftkings" | "betmgm" | "caesars" | "espnbet";

export type StatKey =
  | "pass_yds"
  | "pass_tds"
  | "completions"
  | "pass_att"
  | "ints"
  | "rush_yds"
  | "rush_att"
  | "receptions"
  | "rec_yds"
  | "rush_rec_yds"
  | "pass_rush_yds"
  | "anytime_td";

export type Side = "over" | "under" | "yes";

export interface Sportsbook {
  id: BookId;
  name: string;
  short: string;
  color: string;
  /** Max legs in one parlay. Placeholder until verified per book. */
  maxLegs: number;
}

export interface Team {
  id: string;
  abbr: string;
  name: string;
  color: string;
}

export interface Game {
  id: string;
  away: Team;
  home: Team;
  /** Epoch ms. */
  startsAt: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  gameId: string;
}

export interface Price {
  /** Null for yes/no markets. */
  line: number | null;
  /** American odds. */
  odds: number;
  deeplink?: string;
}

/** One player + one stat; both sides live inside. Mirrors SGO odds grouped by statID + playerID. */
export interface Market {
  id: string;
  playerId: string;
  gameId: string;
  stat: StatKey;
  /** Vig-free consensus (SGO `fairOverUnder` / `fairOdds`). */
  fair: Partial<Record<Side, Price>>;
  byBook: Partial<Record<BookId, Partial<Record<Side, Price>>>>;
}

export interface Slate {
  source: "sgo" | "mock";
  fetchedAt: number;
  games: Game[];
  players: Player[];
  markets: Market[];
  usage?: { used: number; limit: number };
  warning?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface RoomSettings {
  picksPerPerson: number;
  maxMembers: number;
  /** `"ALL"` or an explicit allowlist. */
  propTypes: "ALL" | StatKey[];
  gameIds: string[];
}

export type RoomStatus = "open" | "locked" | "sent";

export interface LockSnapshot {
  lockedAt: number;
  /** legId -> book -> price for the leg's side (null when the book doesn't offer it). */
  prices: Record<string, Partial<Record<BookId, Price | null>>>;
  fair: Record<string, Price | null>;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  memberIds: string[];
  settings: RoomSettings;
  /** Denormalized so the room renders even after games drop off the slate. */
  games: Game[];
  status: RoomStatus;
  createdAt: number;
  snapshot?: LockSnapshot;
}

export interface Leg {
  id: string;
  roomId: string;
  ownerId: string;
  marketId: string;
  side: Side;
  createdAt: number;
  // Denormalized for display and future grading.
  playerId: string;
  playerName: string;
  teamAbbr: string;
  gameId: string;
  stat: StatKey;
}

export type ActivityType =
  | "created"
  | "joined"
  | "added"
  | "removed"
  | "host_removed"
  | "locked"
  | "unlocked"
  | "sent";

export interface Activity {
  id: string;
  roomId: string;
  actorId: string;
  type: ActivityType;
  text: string;
  at: number;
}
