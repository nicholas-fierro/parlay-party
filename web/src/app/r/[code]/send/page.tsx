"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, Share2, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BookChip, Button, Card, cx, Pill, timeAgo } from "@/components/ui";
import { BOOKS, formatAmerican } from "@/lib/books";
import { USER_BY_ID } from "@/lib/fixtures/users";
import {
  BOOK_HOME,
  combinedLink,
  formatDiff,
  legTitle,
  payoutText,
  recommend,
  slipText,
  type BookRecommendation,
} from "@/lib/rules";
import { actions, useNow, type DB } from "@/lib/store";
import type { BookId, Leg, Room, User } from "@/lib/types";

export default function SendPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <AppShell back={{ href: `/r/${code}`, label: "Room" }}>
      {({ db, user }) => <SendView db={db} user={user} code={code.toUpperCase()} />}
    </AppShell>
  );
}

function SendView({ db, user, code }: { db: DB; user: User; code: string }) {
  const now = useNow();
  const room = db.rooms.find((r) => r.code === code);
  const legs = room ? db.legs.filter((l) => l.roomId === room.id).sort((a, b) => a.createdAt - b.createdAt) : [];
  const recs = room?.snapshot ? recommend(legs, room.snapshot) : [];
  const [selected, setSelected] = useState<BookId | null>(null);
  const [expanded, setExpanded] = useState<BookId | null>(null);

  if (!room || !room.snapshot) {
    return (
      <Card className="p-6 text-center space-y-3">
        <p className="font-semibold">{room ? "Slip isn't locked yet" : `Room ${code} not found`}</p>
        <p className="text-sm text-muted">The host locks the slip before anyone can send it.</p>
        <Link href={room ? `/r/${room.code}` : "/"} className="text-accent text-sm">
          Back
        </Link>
      </Card>
    );
  }

  const best = recs.find((r) => r.qualified) ?? null;
  const active = recs.find((r) => r.book === (selected ?? best?.book ?? recs[0].book))!;
  const sends = db.activity.filter((a) => a.roomId === room.id && a.type === "sent").sort((a, b) => b.at - a.at);

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl font-bold">{room.name}</h1>
        <p className="text-sm text-muted">
          {legs.length}-leg parlay · odds locked {timeAgo(room.snapshot.lockedAt, now)}
        </p>
      </div>

      {best ? (
        <Card className="p-4 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-3">
            <Trophy className="text-accent shrink-0" size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-accent">Best payout</div>
              <div className="text-lg font-bold">{BOOKS[best.book].name}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular text-accent">{formatAmerican(best.american)}</div>
              <div className="text-[11px] text-muted">{payoutText(best.decimal)}</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border-warn/40 bg-warn/5 flex gap-3">
          <AlertTriangle className="text-warn shrink-0" size={20} />
          <div className="text-sm">
            <b>No book offers every leg.</b>
            <p className="text-muted mt-1">Ask the host to unlock and swap the legs flagged below.</p>
          </div>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted">Books</h2>
        {recs.map((rec, i) => (
          <RecCard
            key={rec.book}
            rank={i + 1}
            rec={rec}
            legs={legs}
            room={room}
            selected={active.book === rec.book}
            expanded={expanded === rec.book}
            onSelect={() => setSelected(rec.book)}
            onToggle={() => setExpanded(expanded === rec.book ? null : rec.book)}
          />
        ))}
        <p className="text-[11px] text-muted">
          Ranked by combined parlay odds. Lines shown in amber are noticeably worse than the fair line. Books can still
          reject same-game combinations at checkout.
        </p>
      </section>

      <SendPanel rec={active} room={room} legs={legs} user={user} />

      {sends.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted">Sent</h2>
          <Card className="divide-y divide-border">
            {sends.map((a) => (
              <div key={a.id} className="px-3 py-2.5 text-sm flex justify-between gap-2">
                <span>
                  <b className="font-medium">{a.actorId === user.id ? "You" : USER_BY_ID[a.actorId].name}</b>{" "}
                  <span className="text-muted">{a.text}</span>
                </span>
                <span className="text-[11px] text-muted shrink-0">{timeAgo(a.at, now)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function RecCard({
  rank,
  rec,
  legs,
  room,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  rank: number;
  rec: BookRecommendation;
  legs: Leg[];
  room: Room;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const book = BOOKS[rec.book];
  const worse = rec.quotes.filter((q) => q.worse).length;
  const reasons = [
    rec.missingLegIds.length > 0 && `Missing ${rec.missingLegIds.length} leg${rec.missingLegIds.length > 1 ? "s" : ""}`,
    rec.overCap && `Max ${book.maxLegs} legs`,
  ].filter(Boolean) as string[];

  return (
    <Card className={cx("overflow-hidden transition", selected && "border-accent/60")}>
      <div className="flex items-center gap-3 p-3">
        <button onClick={onSelect} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <span
            className={cx("w-4 text-center text-sm font-bold tabular", rec.qualified ? "text-foreground" : "text-muted")}
          >
            {rank}
          </span>
          <BookChip book={rec.book} />
          <span className="flex-1 min-w-0">
            <span className="block font-medium">{book.name}</span>
            <span className="flex gap-1.5 flex-wrap mt-0.5">
              {rec.qualified ? (
                <Pill tone="accent">All legs</Pill>
              ) : (
                reasons.map((r) => (
                  <Pill key={r} tone="danger">
                    {r}
                  </Pill>
                ))
              )}
              {worse > 0 && <Pill tone="warn">{worse} worse line{worse > 1 ? "s" : ""}</Pill>}
            </span>
          </span>
          <span className="text-right">
            <span className={cx("block text-lg font-semibold tabular", !rec.qualified && "text-muted")}>
              {rec.qualified ? formatAmerican(rec.american) : "—"}
            </span>
            {rec.qualified && <span className="block text-[10px] text-muted">{payoutText(rec.decimal)}</span>}
          </span>
        </button>
        <button onClick={onToggle} className="p-1 text-muted" aria-label="Show legs">
          <ChevronDown size={18} className={cx("transition", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && (
        <ul className="border-t border-border divide-y divide-border bg-surface-2/50">
          {legs.map((leg) => {
            const q = rec.quotes.find((x) => x.legId === leg.id)!;
            const fair = room.snapshot?.fair[leg.id];
            return (
              <li key={leg.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className={cx("min-w-0", !q.price && "text-muted line-through")}>
                  <span className="block truncate">{legTitle(leg, q.price)}</span>
                  {q.diff !== null && fair?.line != null && (
                    <span className={cx("text-[11px]", q.worse ? "text-warn" : "text-muted")}>
                      fair {fair.line} · {formatDiff(q.diff)}
                    </span>
                  )}
                </span>
                <span className={cx("tabular text-xs shrink-0", !q.price && "text-danger")}>
                  {q.price ? formatAmerican(q.price.odds) : "not offered"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SendPanel({ rec, room, legs, user }: { rec: BookRecommendation; room: Room; legs: Leg[]; user: User }) {
  const book = BOOKS[rec.book];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const combined = combinedLink(rec.book, rec);
  const text = slipText(room.name, legs, rec);

  function log(via: string) {
    const key = `${rec.book}:${via}`;
    if (logged[key]) return;
    setLogged((l) => ({ ...l, [key]: true }));
    actions.logSend(user.id, room.id, rec.book, via);
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-muted">Send to {book.name}</h2>
      <Card className="p-4 space-y-4">
        {!rec.qualified ? (
          <div className="flex gap-2.5 text-sm">
            <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{book.name} can&apos;t take this parlay.</p>
              {rec.overCap && (
                <p className="text-muted">
                  Slip has {legs.length} legs; {book.name} allows {book.maxLegs}.
                </p>
              )}
              {rec.missingLegIds.length > 0 && (
                <p className="text-muted">
                  Not offered: {rec.missingLegIds.map((id) => legTitle(legs.find((l) => l.id === id)!)).join("; ")}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {combined && (
              <div className="space-y-1">
                <a href={combined} target="_blank" rel="noopener noreferrer" onClick={() => log("one link")}>
                  <Button className="w-full h-12">
                    <ExternalLink size={16} /> Add all {legs.length} legs on {book.name}
                  </Button>
                </a>
                <p className="text-[11px] text-muted text-center">
                  Multi-leg link format is unverified. If it doesn&apos;t fill the slip, use the list below.
                </p>
              </div>
            )}
            <ul className="space-y-2">
              {legs.map((leg) => {
                const q = rec.quotes.find((x) => x.legId === leg.id)!;
                return (
                  <li key={leg.id} className="flex items-center gap-3">
                    <button
                      onClick={() => setChecked((c) => ({ ...c, [leg.id]: !c[leg.id] }))}
                      className={cx(
                        "size-6 rounded-md border grid place-items-center shrink-0",
                        checked[leg.id] ? "bg-accent border-accent text-black" : "border-border",
                      )}
                      aria-label="Mark added"
                    >
                      {checked[leg.id] && <Check size={14} />}
                    </button>
                    <span className={cx("flex-1 text-sm min-w-0", checked[leg.id] && "text-muted line-through")}>
                      {legTitle(leg, q.price)}{" "}
                      <span className="text-muted tabular">{q.price ? formatAmerican(q.price.odds) : ""}</span>
                    </span>
                    <a
                      href={q.price?.deeplink ?? BOOK_HOME[rec.book]}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => log("checklist")}
                      className="text-xs text-accent flex items-center gap-1 shrink-0"
                    >
                      {q.price?.deeplink ? "Add" : "Open"} <ExternalLink size={12} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={!rec.qualified}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
                log("copied");
              } catch {
                // clipboard blocked
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy slip"}
          </Button>
          <Button
            variant="secondary"
            disabled={!rec.qualified}
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title: room.name, text });
                  log("shared");
                } catch {
                  // share sheet dismissed
                }
              } else {
                await navigator.clipboard.writeText(text).catch(() => {});
                log("copied");
              }
            }}
          >
            <Share2 size={16} /> Share
          </Button>
        </div>
      </Card>
    </section>
  );
}
