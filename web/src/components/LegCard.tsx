"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { americanToDecimal, BOOK_IDS, formatAmerican, sideLabel, STATS } from "@/lib/books";
import { USER_BY_ID } from "@/lib/fixtures/users";
import { isWorseLine, lineDiff } from "@/lib/rules";
import type { BookId, Game, Leg, Price } from "@/lib/types";
import { Avatar, BookChip, cx } from "./ui";

interface Props {
  leg: Leg;
  game?: Game;
  /** Snapshot prices when locked; live slate prices otherwise. */
  prices: Partial<Record<BookId, Price | null>>;
  fair: Price | null;
  started: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

export function LegCard({ leg, game, prices, fair, started, canRemove, onRemove }: Props) {
  const owner = USER_BY_ID[leg.ownerId];
  const quotes = BOOK_IDS.map((book) => {
    const price = prices[book] ?? null;
    const diff = lineDiff(leg.side, fair, price);
    return { book, price, diff, worse: isWorseLine(diff, fair) };
  });

  // Best = best line first, then best payout.
  const best = quotes
    .filter((q) => q.price)
    .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0) || americanToDecimal(b.price!.odds) - americanToDecimal(a.price!.odds))[0];
  const isTd = leg.stat === "anytime_td";

  return (
    <div className={cx("rounded-2xl border bg-surface p-3.5 space-y-3", started ? "border-danger/50" : "border-border")}>
      <div className="flex items-start gap-3">
        <Avatar user={owner} size={26} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{leg.playerName}</span>
            <span className="text-xs text-muted">
              {leg.teamAbbr}
              {game ? ` · ${game.away.abbr} @ ${game.home.abbr}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cx(
                "text-xs font-bold uppercase px-1.5 rounded",
                leg.side === "under" ? "bg-sky-400/15 text-sky-300" : "bg-accent/15 text-accent",
              )}
            >
              {sideLabel(leg.side)}
            </span>
            <span className="text-sm">{STATS[leg.stat].label}</span>
            {fair && (
              <span className="text-xs text-muted tabular">
                fair {isTd ? formatAmerican(fair.odds) : fair.line}
              </span>
            )}
          </div>
        </div>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 text-muted hover:text-danger" aria-label="Remove pick">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {quotes.map(({ book, price, worse }) => (
          <div
            key={book}
            className={cx(
              "rounded-lg border px-1 py-1.5 flex flex-col items-center gap-0.5 min-w-0",
              price && best?.book === book ? "border-accent/50 bg-accent/5" : "border-border bg-surface-2",
            )}
          >
            <BookChip book={book} className="!h-4 !text-[9px]" />
            {price ? (
              <>
                {!isTd && (
                  <span className={cx("text-[13px] font-medium tabular leading-none mt-0.5", worse && "text-warn")}>
                    {price.line}
                  </span>
                )}
                <span className="text-[11px] text-muted tabular leading-none">{formatAmerican(price.odds)}</span>
              </>
            ) : (
              <span className="text-xs text-muted mt-1">—</span>
            )}
          </div>
        ))}
      </div>

      {started && (
        <div className="flex items-center gap-2 text-xs text-danger">
          <AlertTriangle size={14} /> Game started — {owner.name} or the host must swap or remove this pick
        </div>
      )}
    </div>
  );
}
