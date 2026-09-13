import { useEffect, useRef } from "react";
import { type PublicBid } from "@/hooks/useAuction";
import { formatUSD } from "@/lib/format";
import { flagForCountryName } from "@/lib/countries";

export function HighestBid({ topBid, startingBid }: { topBid: PublicBid | null; startingBid: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (topBid && topBid.id !== lastIdRef.current && lastIdRef.current !== null) {
      ref.current?.classList.remove("animate-pulse-bid");
      // force reflow
      void ref.current?.offsetWidth;
      ref.current?.classList.add("animate-pulse-bid");
    }
    lastIdRef.current = topBid?.id ?? null;
  }, [topBid?.id]);

  const amount = topBid ? Number(topBid.amount) : startingBid;
  const flag = topBid ? flagForCountryName(topBid.country) : "";

  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {topBid ? "Current highest bid" : "Starting bid"}
      </p>
      <div
        ref={ref}
        className="mt-2 font-mono text-5xl sm:text-7xl font-extrabold text-gradient tabular-nums"
      >
        {formatUSD(amount)}
      </div>
      {topBid ? (
        <p className="mt-3 text-sm sm:text-base text-foreground/80">
          by <span className="font-semibold">{topBid.display_name}</span>{" "}
          <span className="text-lg align-middle">{flag}</span>{" "}
          <span className="text-muted-foreground">{topBid.country}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Be the first to bid</p>
      )}
    </div>
  );
}
