"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { BOOKS } from "@/lib/books";
import type { BookId, User } from "@/lib/types";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-black hover:brightness-110 disabled:bg-surface-2 disabled:text-muted",
  secondary: "bg-surface-2 text-foreground border border-border hover:bg-border/60 disabled:text-muted",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 text-sm font-semibold transition disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-border bg-surface", className)}>{children}</div>;
}

export function Avatar({ user, size = 28, online }: { user: User; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" title={user.name}>
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-black"
        style={{ width: size, height: size, background: user.color, fontSize: size * 0.42 }}
      >
        {user.name[0]}
      </span>
      {online !== undefined && (
        <span
          className={cx(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface",
            online ? "bg-accent" : "bg-muted/50",
          )}
        />
      )}
    </span>
  );
}

export function BookChip({ book, className }: { book: BookId; className?: string }) {
  const b = BOOKS[book];
  return (
    <span
      className={cx("inline-flex items-center justify-center rounded-md px-1.5 text-[10px] font-bold h-5", className)}
      style={{ background: `${b.color}26`, color: b.color }}
    >
      {b.short}
    </span>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "accent" | "warn" | "danger"; children: ReactNode }) {
  const tones = {
    muted: "bg-surface-2 text-muted border-border",
    accent: "bg-accent/10 text-accent border-accent/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    danger: "bg-danger/10 text-danger border-danger/30",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 h-6 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md h-[85dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border bg-surface flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** In-app replacement for window.confirm, which some embedded browsers and PWAs silently block. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" role="alertdialog" aria-modal>
      <button aria-label="Cancel" className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-surface p-5 space-y-4">
        <div className="space-y-1.5">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function kickoffLabel(at: number, now: number): string {
  if (at <= now) return "Live";
  const mins = Math.round((at - now) / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const d = new Date(at);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}
