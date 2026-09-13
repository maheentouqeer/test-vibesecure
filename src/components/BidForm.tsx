import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  amount: z.coerce.number().positive("Amount required"),
});

export function BidForm({ minBid, onPlaced }: { minBid: number; onPlaced?: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ amount: fd.get("amount") });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid amount");
      return;
    }
    if (parsed.data.amount <= minBid) {
      setError(`Minimum bid is ${formatUSD(minBid + 1)}. The current leader is at ${formatUSD(minBid)}.`);
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("place_bid", { _amount: parsed.data.amount });
    setSubmitting(false);

    if (rpcError) {
      toast.error(rpcError.message ?? "Could not place bid");
      return;
    }

    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ["#a855f7", "#7c3aed", "#fbbf24", "#10b981"] });
    toast.success(`Your bid of ${formatUSD(parsed.data.amount)} is live! 🚀`);
    (e.target as HTMLFormElement).reset();
    onPlaced?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="amount">Your bid in USD</Label>
        <Input
          id="amount" name="amount" type="number"
          min={Math.ceil(minBid + 1)} step="1"
          placeholder={`Minimum: $${Math.ceil(minBid + 1).toLocaleString()}`}
          className="h-12 text-lg font-mono"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary shadow-glow text-base h-11">
        {submitting ? "Placing…" : "Place Bid 🚀"}
      </Button>
    </form>
  );
}
