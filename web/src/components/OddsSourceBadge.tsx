"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { loadSlate, type SlateIndex } from "@/lib/slate";
import { cx, timeAgo } from "./ui";

/** Shows where odds come from, their age, and monthly SGO usage. Tap to refresh (server cache still applies). */
export function OddsSourceBadge({ index, now }: { index: SlateIndex; now: number }) {
  const [busy, setBusy] = useState(false);
  const { slate } = index;
  const live = slate.source === "sgo";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await loadSlate();
          setBusy(false);
        }}
        className={cx(
          "flex items-center gap-1.5 text-[11px] rounded-full border px-2 h-6",
          live ? "border-accent/30 text-accent" : "border-warn/30 text-warn",
        )}
        title={slate.usage ? `${slate.usage.used}/${slate.usage.limit} SGO objects this month` : undefined}
      >
        <span className={cx("size-1.5 rounded-full", live ? "bg-accent" : "bg-warn")} />
        {live ? "Live odds" : "Mock odds"} · {timeAgo(slate.fetchedAt, now)}
        <RefreshCw size={10} className={cx(busy && "animate-spin")} />
      </button>
      {slate.warning && <span className="text-[10px] text-warn max-w-56 text-right">{slate.warning}</span>}
    </div>
  );
}
