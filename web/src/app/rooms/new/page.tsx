"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, Minus, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OddsSourceBadge } from "@/components/OddsSourceBadge";
import { BookChip, Button, Card, cx, kickoffLabel } from "@/components/ui";
import { BOOKS, STATS, STAT_KEYS } from "@/lib/books";
import { hasStarted, MAX_PARLAY_LEGS, sizeWarning } from "@/lib/rules";
import { useSlate } from "@/lib/slate";
import { actions, useNow } from "@/lib/store";
import type { StatKey } from "@/lib/types";

export default function NewRoomPage() {
  const router = useRouter();
  const now = useNow();
  const { index, error } = useSlate();
  const [name, setName] = useState("");
  const [picks, setPicks] = useState(2);
  const [members, setMembers] = useState(4);
  const [allProps, setAllProps] = useState(true);
  const [props, setProps] = useState<StatKey[]>([]);
  const [gameIds, setGameIds] = useState<string[] | null>(null);

  return (
    <AppShell back={{ href: "/", label: "Rooms" }}>
      {({ user }) => {
        if (!index) {
          return <p className="text-sm text-muted text-center py-10">{error ?? "Loading games…"}</p>;
        }
        const games = index.slate.games;
        const upcoming = games.filter((g) => !hasStarted(g, now));
        const selectedGames = (gameIds ?? upcoming.map((g) => g.id)).filter((id) => upcoming.some((g) => g.id === id));
        const warn = sizeWarning({ picksPerPerson: picks, maxMembers: members });
        const invalid = selectedGames.length === 0 || (!allProps && props.length === 0);

        return (
          <form
            className="space-y-5 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (invalid) return;
              const code = actions.createRoom(
                user.id,
                name,
                {
                  picksPerPerson: picks,
                  maxMembers: members,
                  propTypes: allProps ? "ALL" : props,
                  gameIds: selectedGames,
                },
                index,
              );
              router.replace(`/r/${code}`);
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">New room</h1>
                <OddsSourceBadge index={index} now={now} />
              </div>
              <p className="text-sm text-muted flex items-center gap-1.5 mt-1">
                <Lock size={13} /> Settings can&apos;t change after you create the room.
              </p>
            </div>

            <label className="block text-sm space-y-1.5">
              <span className="text-muted">Room name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sunday Slate"
                maxLength={40}
                className="w-full h-11 rounded-xl bg-surface border border-border px-3 outline-none focus:border-accent"
              />
            </label>

            <Card className="p-4 space-y-4">
              <Stepper label="Picks per person" value={picks} min={1} max={4} onChange={setPicks} />
              <Stepper label="Max members" value={members} min={2} max={8} onChange={setMembers} />

              <div
                className={cx(
                  "rounded-xl border p-3 text-sm flex gap-2.5",
                  warn.fitsAll ? "border-accent/30 bg-accent/5" : "border-warn/30 bg-warn/5",
                )}
              >
                {warn.fitsAll ? (
                  <CheckCircle2 size={18} className="text-accent shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5">
                  <div className="tabular">
                    {members} × {picks} = <b>{warn.size}-leg</b> parlay max
                  </div>
                  {warn.accepting.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap text-muted">
                      {warn.fitsAll ? "Fits every book" : "Only fits:"}
                      {!warn.fitsAll &&
                        warn.accepting.map((b) => (
                          <span key={b} className="inline-flex items-center gap-1">
                            <BookChip book={b} /> <span className="text-xs">{BOOKS[b].maxLegs} max</span>
                          </span>
                        ))}
                    </div>
                  ) : (
                    <div className="text-warn">
                      No book takes more than {MAX_PARLAY_LEGS} legs. You can still create it; oversized slips can&apos;t
                      be sent whole.
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted">Prop types</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allProps}
                    onChange={(e) => setAllProps(e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  All
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {STAT_KEYS.map((key) => {
                  const on = allProps || props.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      disabled={allProps}
                      onClick={() => setProps((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))}
                      className={cx(
                        "h-8 px-3 rounded-full border text-xs font-medium transition",
                        on ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted",
                        allProps && "opacity-60",
                      )}
                    >
                      {STATS[key].label}
                    </button>
                  );
                })}
              </div>
              {!allProps && props.length === 0 && <p className="text-xs text-danger">Pick at least one prop type</p>}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted">Games</h2>
                <button
                  type="button"
                  className="text-xs text-accent"
                  onClick={() =>
                    setGameIds(selectedGames.length === upcoming.length ? [] : upcoming.map((g) => g.id))
                  }
                >
                  {selectedGames.length === upcoming.length ? "Clear" : "Select all"}
                </button>
              </div>
              <Card className="divide-y divide-border">
                {games.length === 0 && <p className="px-4 py-6 text-sm text-muted text-center">No upcoming games.</p>}
                {games.map((g) => {
                  const started = hasStarted(g, now);
                  const on = selectedGames.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className={cx("flex items-center gap-3 px-4 py-3", started ? "opacity-50" : "cursor-pointer")}
                    >
                      <input
                        type="checkbox"
                        disabled={started}
                        checked={on && !started}
                        onChange={() =>
                          setGameIds(on ? selectedGames.filter((id) => id !== g.id) : [...selectedGames, g.id])
                        }
                        className="size-4 accent-[var(--accent)]"
                      />
                      <span className="flex-1 text-sm">
                        {g.away.name} <span className="text-muted">@</span> {g.home.name}
                      </span>
                      <span className={cx("text-xs", started ? "text-danger" : "text-muted")}>
                        {started ? "Started" : kickoffLabel(g.startsAt, now)}
                      </span>
                    </label>
                  );
                })}
              </Card>
              {selectedGames.length === 0 && <p className="text-xs text-danger">Pick at least one game</p>}
            </section>

            <Button type="submit" className="w-full h-12" disabled={invalid}>
              Create room
            </Button>
          </form>
        );
      }}
    </AppShell>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="size-9 rounded-lg border border-border grid place-items-center disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span className="w-5 text-center font-semibold tabular">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="size-9 rounded-lg border border-border grid place-items-center disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
