"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, PartyPopper } from "lucide-react";
import { USER_BY_ID } from "@/lib/fixtures/users";
import { actions, signOut, useCurrentUserId, useDB, type DB } from "@/lib/store";
import type { User } from "@/lib/types";
import { Avatar, Button, Card } from "./ui";

interface ShellProps {
  children: (ctx: { db: DB; user: User }) => ReactNode;
  back?: { href: string; label: string };
}

/** Auth gate + age attestation + header/footer chrome for signed-in pages. */
export function AppShell({ children, back }: ShellProps) {
  const router = useRouter();
  const db = useDB();
  const userId = useCurrentUserId();
  const user = userId ? USER_BY_ID[userId] : undefined;

  useEffect(() => {
    if (userId === null || (userId && !user)) {
      const next = typeof window !== "undefined" ? window.location.pathname : "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [userId, user, router]);

  if (!db || !user) {
    return <div className="flex-1 grid place-items-center text-muted text-sm">Loading…</div>;
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 h-14 bg-background/85 backdrop-blur border-b border-border">
        {back ? (
          <Link href={back.href} className="text-sm text-muted hover:text-foreground">
            ← {back.label}
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <PartyPopper size={20} className="text-accent" />
            Parlay Party
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Avatar user={user} size={28} />
          <span className="text-sm">{user.name}</span>
          <button
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
            className="p-1.5 text-muted hover:text-foreground"
            aria-label="Sign out"
            title="Switch user"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {db.attested[user.id] ? children({ db, user }) : <Attestation user={user} />}
      </main>

      <Disclaimer />
    </div>
  );
}

function Attestation({ user }: { user: User }) {
  const [checked, setChecked] = useState(false);
  return (
    <Card className="p-5 mt-6 space-y-4">
      <h1 className="text-lg font-semibold">One quick thing, {user.name}</h1>
      <p className="text-sm text-muted">
        Parlay Party helps you build parlays with friends. It never takes, holds, or moves money, and it doesn&apos;t
        place bets for you.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--accent)]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I&apos;m 21 or older, of legal age to bet in my state, and understand this app places no wagers.
      </label>
      <Button className="w-full" disabled={!checked} onClick={() => actions.attest(user.id)}>
        Continue
      </Button>
    </Card>
  );
}

export function Disclaimer() {
  return (
    <footer className="px-4 py-6 text-[11px] leading-relaxed text-muted/80 text-center border-t border-border">
      Not affiliated with FanDuel, DraftKings, BetMGM, Caesars, or ESPN BET. 21+. Check your local laws. Gambling
      problem? Call 1-800-GAMBLER.
    </footer>
  );
}
