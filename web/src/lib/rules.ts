import { americanToDecimal, BOOK_IDS, BOOKS, decimalToAmerican, formatAmerican, sideLabel, STATS } from "./books";
import type { SlateIndex } from "./slate";
import type { BookId, Game, Leg, LockSnapshot, Market, Price, Room, RoomSettings, Side, StatKey } from "./types";
import { USER_BY_ID } from "./fixtures/users";

export const MAX_PARLAY_LEGS = Math.max(...BOOK_IDS.map((b) => BOOKS[b].maxLegs));

export function hasStarted(game: Pick<Game, "startsAt">, now: number): boolean {
  return game.startsAt <= now;
}

export function statAllowed(settings: RoomSettings, stat: StatKey): boolean {
  return settings.propTypes === "ALL" || settings.propTypes.includes(stat);
}

export type Result = { ok: true } | { ok: false; reason: string };

interface AddLegInput {
  room: Room;
  legs: Leg[];
  userId: string;
  market: Market;
  side: Side;
  now: number;
}

/** Spec §5: one leg per player+stat, per-person pick limit, allowed games/props, not started. */
export function validateNewLeg({ room, legs, userId, market, side, now }: AddLegInput): Result {
  if (room.status !== "open") return { ok: false, reason: "Room is locked" };
  if (!room.memberIds.includes(userId)) return { ok: false, reason: "Join the room to add picks" };

  const mine = legs.filter((l) => l.ownerId === userId).length;
  if (mine >= room.settings.picksPerPerson) {
    return { ok: false, reason: `You've used all ${room.settings.picksPerPerson} of your picks` };
  }
  const game = room.games.find((g) => g.id === market.gameId);
  if (!game) return { ok: false, reason: "Game not allowed in this room" };
  if (hasStarted(game, now)) return { ok: false, reason: "Game already started" };
  if (!statAllowed(room.settings, market.stat)) return { ok: false, reason: "Prop type not allowed in this room" };
  if (!BOOK_IDS.some((b) => market.byBook[b]?.[side])) return { ok: false, reason: "No book offers this side" };

  const existing = legs.find((l) => l.marketId === market.id);
  if (existing) {
    const who = USER_BY_ID[existing.ownerId]?.name ?? "someone";
    if (existing.side === side) return { ok: false, reason: `Already on slip, added by ${who}` };
    return { ok: false, reason: `${who} already has the other side of this prop` };
  }
  return { ok: true };
}

export function canEditLeg(room: Room, leg: Leg, userId: string): boolean {
  return room.status === "open" && (leg.ownerId === userId || room.hostId === userId);
}

export function isLegStarted(room: Room, leg: Leg, now: number): boolean {
  const game = room.games.find((g) => g.id === leg.gameId);
  return !!game && hasStarted(game, now);
}

export function lockBlocker(room: Room, legs: Leg[], now: number): string | null {
  if (room.status !== "open") return "Room isn't open";
  if (legs.length === 0) return "Add at least one pick";
  const started = legs.filter((l) => isLegStarted(room, l, now)).length;
  if (started > 0) return `${started} pick${started > 1 ? "s" : ""} from started games must be swapped or removed`;
  return null;
}

/** Spec §4 size warning. Warns only; never blocks. */
export function sizeWarning(settings: Pick<RoomSettings, "picksPerPerson" | "maxMembers">) {
  const size = settings.picksPerPerson * settings.maxMembers;
  const accepting = BOOK_IDS.filter((b) => BOOKS[b].maxLegs >= size);
  return { size, accepting, fitsAll: accepting.length === BOOK_IDS.length };
}

export function snapshotPrices(legs: Leg[], index: SlateIndex, now: number): LockSnapshot {
  const prices: LockSnapshot["prices"] = {};
  const fair: LockSnapshot["fair"] = {};
  for (const leg of legs) {
    const market = index.marketById[leg.marketId];
    fair[leg.id] = market?.fair[leg.side] ?? null;
    prices[leg.id] = Object.fromEntries(BOOK_IDS.map((b) => [b, market?.byBook[b]?.[leg.side] ?? null]));
  }
  return { lockedAt: now, prices, fair };
}

/** Positive = better number than consensus for the picked side. Null for yes/no. */
export function lineDiff(side: Side, fair: Price | null | undefined, price: Price | null | undefined): number | null {
  if (!fair || !price || fair.line === null || price.line === null) return null;
  return side === "over" ? fair.line - price.line : side === "under" ? price.line - fair.line : null;
}

export function isWorseLine(diff: number | null, fair: Price | null | undefined): boolean {
  if (diff === null || !fair?.line) return false;
  return diff <= -Math.max(1, fair.line * 0.02);
}

export interface LegQuote {
  legId: string;
  price: Price | null;
  diff: number | null;
  worse: boolean;
}

export interface BookRecommendation {
  book: BookId;
  qualified: boolean;
  missingLegIds: string[];
  overCap: boolean;
  quotes: LegQuote[];
  /** Combined parlay odds across offered legs. */
  decimal: number;
  american: number;
}

/** Spec §7 (sportsbook pivot): filter to books offering every leg, rank by combined payout. */
export function recommend(legs: Leg[], snapshot: LockSnapshot): BookRecommendation[] {
  const recs = BOOK_IDS.map((book) => {
    const quotes = legs.map((leg) => {
      const price = snapshot.prices[leg.id]?.[book] ?? null;
      const fair = snapshot.fair[leg.id];
      const diff = lineDiff(leg.side, fair, price);
      return { legId: leg.id, price, diff, worse: isWorseLine(diff, fair) };
    });
    const missingLegIds = quotes.filter((q) => !q.price).map((q) => q.legId);
    const decimal = quotes.reduce((acc, q) => (q.price ? acc * americanToDecimal(q.price.odds) : acc), 1);
    const overCap = legs.length > BOOKS[book].maxLegs;
    return {
      book,
      qualified: missingLegIds.length === 0 && !overCap && legs.length > 0,
      missingLegIds,
      overCap,
      quotes,
      decimal,
      american: decimalToAmerican(decimal),
    };
  });
  return recs.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.decimal - a.decimal);
}

export function legTitle(leg: Leg, price?: Price | null): string {
  if (leg.stat === "anytime_td") return `${leg.playerName} Anytime TD`;
  const line = price?.line;
  return `${leg.playerName} ${sideLabel(leg.side)}${line != null ? ` ${line}` : ""} ${STATS[leg.stat].short}`;
}

export function payoutText(decimal: number, stake = 10): string {
  const payout = (stake * decimal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${stake} pays $${payout}`;
}

export function slipText(roomName: string, legs: Leg[], rec: BookRecommendation): string {
  const rows = legs.map((leg, i) => {
    const q = rec.quotes.find((x) => x.legId === leg.id);
    return `${i + 1}. ${legTitle(leg, q?.price)}${q?.price ? ` (${formatAmerican(q.price.odds)})` : ""}`;
  });
  return [
    `${roomName} — ${BOOKS[rec.book].name} ${legs.length}-leg parlay ${formatAmerican(rec.american)}`,
    ...rows,
    payoutText(rec.decimal),
  ].join("\n");
}

/**
 * Best-effort single link that adds every leg to the bet slip.
 * Multi-selection formats are UNVERIFIED; the per-leg checklist is always shown too.
 */
export function combinedLink(book: BookId, rec: BookRecommendation): string | null {
  const links = rec.quotes.map((q) => q.price?.deeplink);
  if (!rec.qualified || links.some((l) => !l)) return null;
  const urls = (links as string[]).map((l) => new URL(l));
  const params = (name: string) => urls.map((u) => u.searchParams.get(name)).filter(Boolean) as string[];

  switch (book) {
    case "fanduel": {
      const markets = params("marketId");
      const selections = params("selectionId");
      if (markets.length !== urls.length || selections.length !== urls.length) return null;
      const qs = markets.map((m, i) => `marketId[${i}]=${m}&selectionId[${i}]=${selections[i]}`).join("&");
      return `https://sportsbook.fanduel.com/addToBetslip?${qs}`;
    }
    case "caesars": {
      const ids = params("selectionIds");
      if (ids.length !== urls.length) return null;
      return `${urls[0].origin}${urls[0].pathname}?selectionIds=${ids.join(",")}`;
    }
    case "espnbet": {
      const ids = params("market_selection_id[0]");
      if (ids.length !== urls.length) return null;
      return `https://espnbet.app.link/?${ids.map((id, i) => `market_selection_id[${i}]=${id}`).join("&")}`;
    }
    case "betmgm": {
      const opts = params("options");
      if (opts.length !== urls.length) return null;
      return `${urls[0].origin}/en/sports?options=${opts.join(",")}`;
    }
    case "draftkings":
      return null;
  }
}

export const BOOK_HOME: Record<BookId, string> = {
  fanduel: "https://sportsbook.fanduel.com/",
  draftkings: "https://sportsbook.draftkings.com/",
  betmgm: "https://sports.betmgm.com/",
  caesars: "https://sportsbook.caesars.com/",
  espnbet: "https://espnbet.com/",
};

export function formatDiff(diff: number): string {
  if (diff === 0) return "±0";
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}`;
}

export function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
