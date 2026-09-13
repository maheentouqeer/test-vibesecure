import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useBids } from "@/hooks/useAuction";
import { formatUSD, timeAgo } from "@/lib/format";
import { flagForCountryName } from "@/lib/countries";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Live Bid Leaderboard — SAAS AUCTION" },
      { name: "description", content: "Real-time leaderboard of all bids placed in the SAAS AUCTION." },
      { property: "og:title", content: "Live Bid Leaderboard — SAAS AUCTION" },
      { property: "og:description", content: "All bids are public. Email addresses stay private." },
    ],
  }),
  component: () => (
    <Layout>
      <Leaderboard />
    </Layout>
  ),
});

const rankBg = ["bg-gold/10 border-gold/30", "bg-silver/10 border-silver/30", "bg-bronze/10 border-bronze/30"];

function Leaderboard() {
  const { bids, loading } = useBids();
  const winner = bids.find((b) => b.is_winner) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Live Bid <span className="text-gradient">Leaderboard</span>
        </h1>
        <p className="text-muted-foreground">All bids are public. Email addresses stay private.</p>
      </header>

      {winner && (
        <div className="rounded-2xl border-2 border-gold/50 bg-gradient-to-r from-gold/15 via-gold/10 to-gold/15 p-6 text-center space-y-2 shadow-elevated">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-6 w-6 text-gold" />
            <span className="text-xs uppercase tracking-widest font-bold text-gold">Winner Announced</span>
            <Crown className="h-6 w-6 text-gold" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold">
            {winner.display_name}{" "}
            <span className="align-middle">{flagForCountryName(winner.country)}</span>{" "}
            <span className="text-muted-foreground text-base font-medium">{winner.country}</span>
          </p>
          <p className="font-mono text-xl font-bold">{formatUSD(Number(winner.amount))}</p>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-center text-muted-foreground">Loading…</p>}
        {!loading && bids.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No bids yet. Be the first to bid!</p>
        )}
        {bids.map((b, i) => {
          const highlight = b.is_winner
            ? "border-gold/50 bg-gold/10"
            : i < 3
            ? rankBg[i]
            : "border-border bg-card/50";
          return (
            <div
              key={b.id}
              className={`animate-slide-in-top flex items-center gap-3 sm:gap-4 rounded-xl border ${highlight} px-3 sm:px-5 py-3 sm:py-4`}
            >
              <div className="w-10 sm:w-12 text-center">
                {b.is_winner || i === 0 ? (
                  <Crown className="h-6 w-6 text-gold mx-auto" />
                ) : (
                  <span className="font-mono font-bold text-muted-foreground">#{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-2 flex-wrap">
                  <span>{b.display_name}</span>
                  <span className="align-middle">{flagForCountryName(b.country)}</span>
                  <span className="text-muted-foreground font-normal text-sm">{b.country}</span>
                  {b.is_winner && (
                    <span className="rounded-full bg-gold/20 text-gold px-2 py-0.5 text-[10px] font-bold tracking-wider">
                      WINNER
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(b.created_at)}</p>
              </div>
              <div className="font-mono font-bold text-base sm:text-xl tabular-nums">
                {formatUSD(Number(b.amount))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
