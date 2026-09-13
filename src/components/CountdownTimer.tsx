import { useEffect, useState } from "react";
import { type AuctionSettings, getAuctionStatus } from "@/hooks/useAuction";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function breakdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function Block({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl border border-border bg-card/80 px-3 py-2 sm:px-5 sm:py-4 shadow-elevated min-w-[64px] sm:min-w-[88px]">
        <div className={`font-mono text-3xl sm:text-5xl font-bold tabular-nums tracking-tight ${urgent ? "text-warning" : "text-foreground"}`}>
          {pad(value)}
        </div>
      </div>
      <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function CountdownTimer({ settings }: { settings: AuctionSettings | null }) {
  const now = useNow();
  const status = getAuctionStatus(settings, now);

  if (!settings) {
    return (
      <div className="text-center text-muted-foreground">Loading auction…</div>
    );
  }

  const target =
    status === "pending" ? new Date(settings.start_time).getTime() : new Date(settings.end_time).getTime();
  const remainingMs = target - now;
  const { days, hours, minutes, seconds } = breakdown(remainingMs);
  const urgent = status === "live" && remainingMs > 0 && remainingMs < 3 * 60 * 60 * 1000;

  const tone =
    status === "pending"
      ? "text-warning"
      : status === "live"
        ? "text-success"
        : "text-destructive";

  const label =
    status === "pending"
      ? "Bidding opens in"
      : status === "live"
        ? "LIVE — Bidding closes in"
        : "Auction Closed";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`flex items-center gap-2 text-sm sm:text-base font-semibold ${tone}`}>
        {status === "live" && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-live-dot" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
        )}
        <span className="uppercase tracking-widest">{label}</span>
      </div>

      {status !== "ended" ? (
        <div className="flex items-end gap-2 sm:gap-3">
          <Block value={days} label="Days" urgent={urgent} />
          <Block value={hours} label="Hours" urgent={urgent} />
          <Block value={minutes} label="Minutes" urgent={urgent} />
          <Block value={seconds} label="Seconds" urgent={urgent} />
        </div>
      ) : (
        <p className="max-w-md text-center text-muted-foreground">
          The auction has ended. The winner will be contacted via email.
        </p>
      )}
    </div>
  );
}
