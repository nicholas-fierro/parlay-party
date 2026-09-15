"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Plus, RotateCcw, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OddsSourceBadge } from "@/components/OddsSourceBadge";
import { Avatar, Button, Card, ConfirmDialog, Pill, timeAgo } from "@/components/ui";
import { USER_BY_ID } from "@/lib/fixtures/users";
import { useSlate } from "@/lib/slate";
import { actions, useNow } from "@/lib/store";
import type { RoomStatus } from "@/lib/types";

const STATUS: Record<RoomStatus, { label: string; tone: "accent" | "warn" | "muted" }> = {
  open: { label: "Open", tone: "accent" },
  locked: { label: "Locked", tone: "warn" },
  sent: { label: "Sent", tone: "muted" },
};

export default function HomePage() {
  const router = useRouter();
  const now = useNow();
  const { index } = useSlate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <AppShell>
      {({ db, user }) => {
        const mine = db.rooms.filter((r) => r.memberIds.includes(user.id));
        const others = db.rooms.filter((r) => !r.memberIds.includes(user.id));

        return (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-3">
              <Link href="/rooms/new">
                <Button className="w-full h-12">
                  <Plus size={18} /> Create a room
                </Button>
              </Link>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = actions.joinRoom(user.id, code);
                  if (!res.ok) return setError(res.reason);
                  router.push(`/r/${res.code}`);
                }}
              >
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().slice(0, 6));
                    setError(null);
                  }}
                  placeholder="Room code"
                  className="flex-1 min-w-0 h-11 rounded-xl bg-surface border border-border px-3 uppercase tracking-widest outline-none focus:border-accent"
                />
                <Button variant="secondary" type="submit" disabled={code.length !== 6}>
                  Join
                </Button>
              </form>
              {error && <p className="text-xs text-danger -mt-1">{error}</p>}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-wider text-muted">Your rooms</h2>
              {mine.length === 0 && (
                <Card className="p-4 text-sm text-muted">
                  No rooms yet. Create one, join with a code, or spin up a demo room below.
                </Card>
              )}
              {mine.map((room) => {
                const legs = db.legs.filter((l) => l.roomId === room.id).length;
                return (
                  <Link key={room.id} href={`/r/${room.code}`}>
                    <Card className="p-4 flex items-center gap-3 hover:border-accent/40 transition mb-2">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{room.name}</span>
                          <Pill tone={STATUS[room.status].tone}>{STATUS[room.status].label}</Pill>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex -space-x-1.5">
                            {room.memberIds.map((id) => (
                              <Avatar key={id} user={USER_BY_ID[id]} size={18} />
                            ))}
                          </span>
                          <span>
                            {legs} pick{legs === 1 ? "" : "s"}
                          </span>
                          <span>{timeAgo(room.createdAt, now)}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </Card>
                  </Link>
                );
              })}
            </section>

            {others.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-muted">Demo rooms you&apos;re not in</h2>
                {others.map((room) => (
                  <Card key={room.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{room.name}</div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        <Users size={12} /> {room.memberIds.length}/{room.settings.maxMembers} · code {room.code}
                      </div>
                    </div>
                    <Link href={`/r/${room.code}`} className="text-sm text-accent">
                      View
                    </Link>
                  </Card>
                ))}
              </section>
            )}

            <section className="pt-2 space-y-2">
              <div className="flex justify-center">{index && <OddsSourceBadge index={index} now={now} />}</div>
              <Button
                variant="secondary"
                className="w-full"
                disabled={!index}
                onClick={() => index && router.push(`/r/${actions.createDemoRoom(user.id, index)}`)}
              >
                <Sparkles size={16} /> Create demo room with friends
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw size={14} /> Reset demo data
              </Button>
              <ConfirmDialog
                open={confirmReset}
                title="Reset demo data?"
                message="Deletes every room, pick, and activity entry in this browser, for all tabs."
                confirmLabel="Reset"
                onCancel={() => setConfirmReset(false)}
                onConfirm={() => {
                  actions.resetDemo();
                  setConfirmReset(false);
                }}
              />
            </section>
          </div>
        );
      }}
    </AppShell>
  );
}
