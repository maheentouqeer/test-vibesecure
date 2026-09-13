import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Perk = { title: string; desc: string };
export type StackItem = { k: string; v: string };
export type Feature = { t: string; d: string };

export type AuctionSettings = {
  id: number;
  start_time: string;
  end_time: string;
  starting_bid: number;
  app_name: string;
  tagline: string;
  description: string;
  hero_image_url: string | null;
  demo_video_url: string | null;
  perks: Perk[];
  tech_stack: StackItem[];
  features: Feature[];
  includes: string[];
  is_manually_ended: boolean;
  winner_announced: boolean;
};

export type PublicBid = {
  id: string;
  display_name: string;
  country: string;
  amount: number;
  is_winner: boolean;
  created_at: string;
};

export function useAuctionSettings() {
  const [settings, setSettings] = useState<AuctionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_public_auction_settings");
      const row = Array.isArray(data) ? data[0] : null;
      if (active) {
        setSettings((row as unknown as AuctionSettings) ?? null);
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { settings, loading };
}

export function useBids() {
  const [bids, setBids] = useState<PublicBid[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("public_bids")
      .select("*")
      .order("amount", { ascending: false })
      .limit(500);
    setBids((data as PublicBid[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Subscribe to a broadcast-only channel — no PII flows through.
    // We trigger reloads when auction_settings changes (e.g. starting_bid),
    // and additionally poll the public_bids view via a lightweight broadcast
    // channel that anyone can listen to but contains no data.
    const channel = supabase
      .channel("public-bid-feed")
      .on("broadcast", { event: "bid_update" }, () => load())
      .subscribe();

    // Fallback gentle refresh every 5s while open — keeps UI live even if
    // the broadcast event isn't sent (e.g. direct DB inserts via admin).
    const interval = setInterval(load, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load]);

  return { bids, loading, topBid: bids[0] ?? null, reload: load };
}

export type AuctionStatus = "pending" | "live" | "ended";

export function getAuctionStatus(s: AuctionSettings | null, now = Date.now()): AuctionStatus {
  if (!s) return "pending";
  if (s.is_manually_ended) return "ended";
  const start = new Date(s.start_time).getTime();
  const end = new Date(s.end_time).getTime();
  if (now < start) return "pending";
  if (now > end) return "ended";
  return "live";
}
