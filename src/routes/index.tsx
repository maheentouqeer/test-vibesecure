import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { CountdownTimer } from "@/components/CountdownTimer";
import { HighestBid } from "@/components/HighestBid";
import { BidForm } from "@/components/BidForm";
import { InlineAuth } from "@/components/InlineAuth";
import { ProfileForm } from "@/components/ProfileForm";
import { WinnerBanner } from "@/components/WinnerBanner";
import { TrustBadges } from "@/components/TrustBadges";
import { NonBidderPopup } from "@/components/NonBidderPopup";
import { useAuctionSettings, useBids, getAuctionStatus, type PublicBid } from "@/hooks/useAuction";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatUSD, timeAgo } from "@/lib/format";
import { Sparkles, LogOut } from "lucide-react";

function YourBids({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<PublicBid[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("public_bids")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (active) setRows((data as PublicBid[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("your_bids_" + profileId)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [profileId]);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Your bids</p>
      <ul className="divide-y divide-border/60">
        {rows.map((b) => (
          <li key={b.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="font-mono font-semibold">{formatUSD(Number(b.amount))}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(b.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAAS AUCTION — Bid to own a fully built AI SaaS app" },
      {
        name: "description",
        content:
          "Place your bid to own a complete, production-ready AI SaaS app. One bid. 48 hours. Winner takes everything.",
      },
      { property: "og:title", content: "SAAS AUCTION — Own a fully built AI SaaS" },
      { property: "og:description", content: "One bid. 48 hours. Winner takes everything." },
    ],
  }),
  component: () => (
    <Layout>
      <Index />
    </Layout>
  ),
});

function Index() {
  const { settings } = useAuctionSettings();
  const { bids, topBid, reload } = useBids();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, reload: reloadProfile } = useProfile(user);
  

  const status = getAuctionStatus(settings);
  const startingBid = settings?.starting_bid ?? 2000;
  const minBid = topBid ? Number(topBid.amount) : startingBid;
  const appName = settings?.app_name ?? "Habito";
  const perks = settings?.perks ?? [];

  const winnerAnnounced = !!settings?.winner_announced;
  const winner = winnerAnnounced ? topBid : null;
  const isCurrentUserWinner =
    !!winner && !!profile && winner.display_name === profile.display_name;

  // Registered user (signed in + profile created) with no bids yet
  const hasBid = !!profile && bids.some((b) => b.display_name === profile.display_name);
  const showNonBidderPopup = !!profile && !hasBid && status === "live";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16 space-y-12">
      {/* Hero */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
          🔥 <span className="text-gradient">SAAS AUCTION</span>
        </h1>
        <p className="text-lg sm:text-xl font-semibold text-foreground/90">
          Bid to own <span className="text-primary">Habito</span> — a fully built AI SaaS app
        </p>
        <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
          One bid. One winner. The clock is running.
        </p>
        {settings?.hero_image_url && (
          <img
            src={settings.hero_image_url}
            alt={`${appName} preview`}
            className="mx-auto rounded-2xl border border-border max-h-80 w-auto object-cover shadow-elevated"
          />
        )}
        <CountdownTimer settings={settings} />
        <TrustBadges />
      </section>

      {/* How it works */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { n: 1, t: "Create your account", d: "Sign up and create your bidder profile in 30 seconds." },
          { n: 2, t: "Place your bid", d: "Enter any amount above the current highest bid to take the lead." },
          { n: 3, t: "Win and take ownership", d: "Highest bidder when the timer ends wins everything. If the winner doesn't respond within 24 hours, the 2nd highest bid wins. If they don't respond, the 3rd highest bid wins." },
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-border bg-card/50 p-5 space-y-2">
            <div className="text-3xl font-bold text-primary">{s.n}</div>
            <p className="font-medium">{s.t}</p>
            <p className="text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </section>

      {/* Winner banner (only when announced) */}
      {winner && <WinnerBanner winner={winner} isCurrentUserWinner={isCurrentUserWinner} />}

      {/* Highest bid + bidding flow */}
      <section className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 sm:p-10 shadow-elevated space-y-8">
        <HighestBid topBid={topBid} startingBid={startingBid} />
        <p className="text-center text-xs text-muted-foreground">
          {bids.length} bid{bids.length === 1 ? "" : "s"} placed
        </p>
        <p className="text-center text-xs text-warning">
          ⚠️ If the winner doesn't respond within 24 hours, the next highest bidder becomes the winner.
        </p>

        {status === "pending" && (
          <p className="text-center text-warning text-sm border-t border-border pt-6">
            Bidding hasn't opened yet. Come back when the timer hits zero.
          </p>
        )}

        {status === "ended" && !winnerAnnounced && (
          <p className="text-center text-destructive text-sm border-t border-border pt-6">
            Auction has ended — winner will be announced soon. If the winner doesn't respond within 24 hours, the 2nd highest bidder will be contacted.
          </p>
        )}

        {status === "live" && !winnerAnnounced && (
          <div className="border-t border-border pt-8">
            {authLoading || profileLoading ? (
              <p className="text-center text-muted-foreground text-sm">Loading…</p>
            ) : !user ? (
              <InlineAuth />
            ) : !profile ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">One more step — create your profile</h2>
                  <p className="text-xs text-muted-foreground">
                    Signed in as <span className="font-mono">{user.email}</span>
                  </p>
                </div>
                <ProfileForm user={user} onCreated={reloadProfile} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Bidding as{" "}
                    <span className="font-semibold text-foreground">{profile.display_name}</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => supabase.auth.signOut()}
                    className="text-xs h-7"
                  >
                    <LogOut className="h-3 w-3 mr-1" /> Sign out
                  </Button>
                </div>
                <BidForm minBid={minBid} onPlaced={reload} />
                <YourBids profileId={profile.id} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* What you get */}
      {perks.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">
            What You Get When You Win
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {perks.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <div className="rounded-lg bg-primary/15 p-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      
      <NonBidderPopup show={showNonBidderPopup} />
    </div>
  );
}
