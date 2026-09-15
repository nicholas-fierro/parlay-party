"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Crown, Lock, LockOpen, Plus, Send, Trash2 } from "lucide-react";
import { AddPickSheet } from "@/components/AddPickSheet";
import { AppShell } from "@/components/AppShell";
import { LegCard } from "@/components/LegCard";
import { OddsSourceBadge } from "@/components/OddsSourceBadge";
import { Avatar, Button, Card, ConfirmDialog, cx, Pill, timeAgo } from "@/components/ui";
import { BOOK_IDS, BOOKS, STATS } from "@/lib/books";
import { USER_BY_ID } from "@/lib/fixtures/users";
import { canEditLeg, isLegStarted, lockBlocker, sizeWarning } from "@/lib/rules";
import { buildIndex, loadSlate, useSlate, type SlateIndex } from "@/lib/slate";
import { actions, isOnline, useNow, usePresence, type DB } from "@/lib/store";
import type { Leg, Room, User } from "@/lib/types";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <AppShell back={{ href: "/", label: "Rooms" }}>
      {({ db, user }) => <RoomView db={db} user={user} code={code.toUpperCase()} />}
    </AppShell>
  );
}

function RoomView({ db, user, code }: { db: DB; user: User; code: string }) {
  const router = useRouter();
  const now = useNow();
  const { index } = useSlate();
  const room = db.rooms.find((r) => r.code === code);
  usePresence(user.id, room?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!room) {
    return (
      <Card className="p-6 text-center space-y-3">
        <p className="font-semibold">Room {code} not found</p>
        <p className="text-sm text-muted">It may have been deleted by the host.</p>
        <Link href="/" className="text-accent text-sm">
          Back to rooms
        </Link>
      </Card>
    );
  }

  const legs = db.legs.filter((l) => l.roomId === room.id).sort((a, b) => a.createdAt - b.createdAt);
  const isHost = room.hostId === user.id;
  const isMember = room.memberIds.includes(user.id);
  const myCount = legs.filter((l) => l.ownerId === user.id).length;
  const picksLeft = room.settings.picksPerPerson - myCount;
  const blocker = lockBlocker(room, legs, now);
  const activity = db.activity.filter((a) => a.roomId === room.id).sort((a, b) => b.at - a.at);
  const warn = sizeWarning(room.settings);

  async function copyInvite() {
    const url = `${window.location.origin}/r/${room!.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice(url);
    }
  }

  async function lock() {
    setLocking(true);
    const fresh = await loadSlate(true);
    setLocking(false);
    if (!fresh) return setNotice("Couldn't refresh odds; try again");
    actions.lock(user.id, room!.id, buildIndex(fresh));
  }

  return (
    <div className="space-y-5 pb-24">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{room.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              <StatusPill room={room} />
              <span>
                {room.settings.picksPerPerson} pick{room.settings.picksPerPerson > 1 ? "s" : ""} each
              </span>
              <span>·</span>
              <span>
                {room.memberIds.length}/{room.settings.maxMembers} members
              </span>
            </div>
          </div>
          <button
            onClick={copyInvite}
            className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-surface text-sm tracking-widest font-mono"
          >
            {room.code}
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} className="text-muted" />}
          </button>
        </div>

        <Card className="p-3 flex items-center gap-3 overflow-x-auto">
          {room.memberIds.map((id) => {
            const member = USER_BY_ID[id];
            const count = legs.filter((l) => l.ownerId === id).length;
            const online = id === user.id || isOnline(db, id, room.id, now);
            return (
              <div key={id} className="flex flex-col items-center gap-1 min-w-12">
                <div className="relative">
                  <Avatar user={member} size={34} online={online} />
                  {id === room.hostId && (
                    <Crown size={12} className="absolute -top-1.5 -left-1 text-warn fill-warn" aria-label="Host" />
                  )}
                </div>
                <span className="text-[11px]">{id === user.id ? "You" : member.name}</span>
                <span
                  className={cx(
                    "text-[10px] tabular",
                    count >= room.settings.picksPerPerson ? "text-accent" : "text-muted",
                  )}
                >
                  {count}/{room.settings.picksPerPerson}
                </span>
              </div>
            );
          })}
          {Array.from({ length: room.settings.maxMembers - room.memberIds.length }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 min-w-12 opacity-40">
              <span className="size-[34px] rounded-full border border-dashed border-muted" />
              <span className="text-[11px] text-muted">Open</span>
            </div>
          ))}
        </Card>

        {!warn.fitsAll && (
          <p className="text-xs text-warn">
            Up to {warn.size} legs.{" "}
            {warn.accepting.length
              ? `Only ${warn.accepting.map((b) => BOOKS[b].name).join(", ")} can take a full slip.`
              : "No book can take a full slip."}
          </p>
        )}

        {!isMember && (
          <Card className="p-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">You&apos;re viewing this room.</span>
            <Button
              onClick={() => {
                const res = actions.joinRoom(user.id, room.code);
                if (!res.ok) setNotice(res.reason);
              }}
              disabled={room.status !== "open" || room.memberIds.length >= room.settings.maxMembers}
            >
              {room.memberIds.length >= room.settings.maxMembers ? "Room full" : "Join room"}
            </Button>
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-wider text-muted">
            Slip · {legs.length} leg{legs.length === 1 ? "" : "s"}
          </h2>
          {room.snapshot ? (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Lock size={11} /> odds locked {timeAgo(room.snapshot.lockedAt, now)}
            </span>
          ) : (
            index && <OddsSourceBadge index={index} now={now} />
          )}
        </div>

        {legs.length === 0 && <Card className="p-6 text-center text-sm text-muted">No picks yet. Be the first.</Card>}
        {legs.map((leg) => (
          <LegCard
            key={leg.id}
            leg={leg}
            game={room.games.find((g) => g.id === leg.gameId)}
            prices={pricesFor(room, leg, index)}
            fair={room.snapshot ? room.snapshot.fair[leg.id] : (index?.marketById[leg.marketId]?.fair[leg.side] ?? null)}
            started={room.status === "open" && isLegStarted(room, leg, now)}
            canRemove={canEditLeg(room, leg, user.id)}
            onRemove={() => actions.removeLeg(user.id, leg.id)}
          />
        ))}

        {room.settings.propTypes !== "ALL" && (
          <p className="text-xs text-muted pt-1">
            Allowed props: {room.settings.propTypes.map((k) => STATS[k].short).join(", ")}
          </p>
        )}
      </section>

      {notice && (
        <p className="text-sm text-warn text-center" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted">Activity</h2>
        <Card className="divide-y divide-border">
          {activity.slice(0, 20).map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
              <Avatar user={USER_BY_ID[a.actorId]} size={20} />
              <span className="flex-1 min-w-0">
                <b className="font-medium">{a.actorId === user.id ? "You" : USER_BY_ID[a.actorId].name}</b>{" "}
                <span className="text-muted">{a.text}</span>
              </span>
              <span className="text-[11px] text-muted shrink-0">{timeAgo(a.at, now)}</span>
            </div>
          ))}
        </Card>
      </section>

      {isHost && (
        <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} /> Delete room
        </Button>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto px-4 py-3 space-y-1.5">
          {room.status === "open" ? (
            <>
              <div className="flex gap-2">
                {isMember && (
                  <Button className="flex-1" disabled={picksLeft <= 0 || !index} onClick={() => setSheetOpen(true)}>
                    <Plus size={18} />
                    {picksLeft > 0 ? `Add pick (${picksLeft} left)` : "All picks in"}
                  </Button>
                )}
                {isHost && (
                  <Button
                    variant="secondary"
                    className={cx(!isMember && "flex-1")}
                    disabled={!!blocker || locking}
                    onClick={lock}
                  >
                    <Lock size={16} /> {locking ? "Locking…" : "Lock"}
                  </Button>
                )}
              </div>
              {isHost && blocker && <p className="text-[11px] text-muted text-center">{blocker}</p>}
              {!isHost && (
                <p className="text-[11px] text-muted text-center">Waiting for {USER_BY_ID[room.hostId].name} to lock</p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <Link href={`/r/${room.code}/send`} className="flex-1">
                <Button className="w-full">
                  <Send size={16} /> Best book & send
                </Button>
              </Link>
              {isHost && (
                <Button variant="secondary" onClick={() => actions.unlock(user.id, room.id)}>
                  <LockOpen size={16} /> Unlock
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this room?"
        message="It's removed for everyone, including all picks and activity. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          router.replace("/");
          actions.deleteRoom(user.id, room.id);
        }}
      />

      {isMember && room.status === "open" && index && (
        <AddPickSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          index={index}
          room={room}
          legs={legs}
          userId={user.id}
          now={now}
        />
      )}
    </div>
  );
}

function pricesFor(room: Room, leg: Leg, index: SlateIndex | null) {
  if (room.snapshot) return room.snapshot.prices[leg.id] ?? {};
  const market = index?.marketById[leg.marketId];
  return Object.fromEntries(BOOK_IDS.map((b) => [b, market?.byBook[b]?.[leg.side] ?? null]));
}

function StatusPill({ room }: { room: Room }) {
  if (room.status === "open") return <Pill tone="accent">Open</Pill>;
  if (room.status === "locked") return <Pill tone="warn">Locked</Pill>;
  return <Pill>Sent</Pill>;
}
