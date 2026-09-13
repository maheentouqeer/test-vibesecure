import { Link, Outlet } from "@tanstack/react-router";
import { Flame, LogIn, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/" as const, label: "Bid" },
  { to: "/details" as const, label: "App Details" },
  { to: "/leaderboard" as const, label: "Leaderboard" },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="text-xl">🔥</span>
            <span className="text-gradient text-lg sm:text-xl">SAAS AUCTION</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                activeProps={{ className: "bg-primary/15 text-primary" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-secondary/60"
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                activeProps={{ className: "bg-primary/15 text-primary" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-secondary/60 flex items-center gap-1"
              >
                <Shield className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
            {user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center gap-1"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            ) : (
              <Link
                to="/login"
                activeProps={{ className: "bg-primary/15 text-primary" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-secondary/60 flex items-center gap-1"
              >
                <LogIn className="h-3.5 w-3.5" /> Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children ?? <Outlet />}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-center gap-2">
          <Flame className="h-3.5 w-3.5 text-primary" />
          SAAS AUCTION · One bid. 48 hours. Winner takes everything.
        </div>
      </footer>
    </div>
  );
}
