import { formatUSD } from "@/lib/format";
import type { PublicBid } from "@/hooks/useAuction";

export function WinnerBanner({ winner, isCurrentUserWinner }: { winner: PublicBid | null; isCurrentUserWinner: boolean }) {
  if (!winner) return null;
  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/15 via-gold/10 to-gold/15 p-6 sm:p-8 text-center space-y-3 shadow-elevated">
      <p className="text-3xl sm:text-4xl font-extrabold text-gold">
        🏆 Congratulations {winner.display_name}!
      </p>
      <p className="text-lg text-foreground/90">
        You won with a bid of <span className="font-mono font-bold">{formatUSD(Number(winner.amount))}</span>
      </p>
      <p className="text-sm text-muted-foreground max-w-xl mx-auto">
        We will contact you at your registered email within 24 hours with payment and handover details.
      </p>
      {!isCurrentUserWinner && (
        <p className="mt-4 text-sm text-foreground/80 border-t border-gold/20 pt-4">
          Better luck next time — but your 20% discount on the ebook is on its way to your registered email.
          <br />
          Use code <span className="font-mono font-bold">HABITO20</span> at checkout. Valid for 48 hours.
        </p>
      )}
    </div>
  );
}
