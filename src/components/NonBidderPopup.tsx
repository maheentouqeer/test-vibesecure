import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "habito_nonbid_popup_dismissed_at";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export function NonBidderPopup({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last > EIGHT_HOURS) {
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }
  }, [show]);

  function dismiss() {
    setVisible(false);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  if (!visible) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border border-primary/40 bg-card/95 backdrop-blur p-4 shadow-elevated animate-slide-in-top">
      <button onClick={dismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold pr-5">⏰ You're registered but haven't bid yet!</p>
      <p className="mt-1 text-xs text-muted-foreground">The clock is running — place your bid before someone else wins.</p>
      <Link to="/" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
        Place a bid →
      </Link>
    </div>
  );
}
