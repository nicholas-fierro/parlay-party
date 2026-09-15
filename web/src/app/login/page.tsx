"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, PartyPopper } from "lucide-react";
import { Disclaimer } from "@/components/AppShell";
import { Avatar, Button, Card } from "@/components/ui";
import { USERS } from "@/lib/fixtures/users";
import { signIn } from "@/lib/store";

type Step = "choose" | "google" | "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function finish(userId: string) {
    signIn(userId);
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && next !== "/login" ? next : "/");
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
      <main className="flex-1 px-4 pt-16 pb-6 space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto size-14 rounded-2xl bg-accent/10 grid place-items-center">
            <PartyPopper className="text-accent" size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Parlay Party</h1>
          <p className="text-sm text-muted">Build NFL prop parlays with your group.</p>
        </div>

        <Card className="p-5 space-y-3">
          {step === "choose" && (
            <>
              <Button className="w-full bg-white text-black hover:brightness-95" onClick={() => setStep("google")}>
                <GoogleMark /> Continue with Google
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setStep("email")}>
                <Mail size={16} /> Email me a code
              </Button>
            </>
          )}

          {step === "google" && (
            <>
              <p className="text-xs text-muted">Mock Google account chooser</p>
              <ul className="divide-y divide-border">
                {USERS.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => finish(u.id)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-2 rounded-lg px-2"
                    >
                      <Avatar user={u} size={32} />
                      <span>
                        <span className="block text-sm font-medium">{u.name}</span>
                        <span className="block text-xs text-muted">{u.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" className="w-full" onClick={() => setStep("choose")}>
                Back
              </Button>
            </>
          )}

          {step === "email" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const match = USERS.find((u) => u.email === email.trim().toLowerCase());
                if (!match) return setError(`Try one of: ${USERS.map((u) => u.email).join(", ")}`);
                setError(null);
                setStep("code");
              }}
            >
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nick@example.com"
                  className="mt-1 w-full h-11 rounded-xl bg-surface-2 border border-border px-3 outline-none focus:border-accent"
                />
              </label>
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button className="w-full" type="submit">
                Send code
              </Button>
              <Button variant="ghost" type="button" className="w-full" onClick={() => setStep("choose")}>
                Back
              </Button>
            </form>
          )}

          {step === "code" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const match = USERS.find((u) => u.email === email.trim().toLowerCase());
                if (!/^\d{6}$/.test(code) || !match) return setError("Enter the 6-digit code (any 6 digits in mock)");
                finish(match.id);
              }}
            >
              <p className="text-sm text-muted">
                Code sent to <span className="text-foreground">{email}</span>
              </p>
              <input
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full h-12 rounded-xl bg-surface-2 border border-border px-3 text-center text-xl tracking-[0.5em] tabular outline-none focus:border-accent"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button className="w-full" type="submit">
                Verify
              </Button>
            </form>
          )}
        </Card>

        <p className="text-xs text-center text-muted">
          Tip: open a second tab or private window and sign in as someone else to test live updates.
        </p>
      </main>
      <Disclaimer />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
