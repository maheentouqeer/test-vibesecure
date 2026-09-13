import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuctionSettings, useBids, getAuctionStatus, type AuctionSettings, type Perk, type StackItem, type Feature } from "@/hooks/useAuction";
import { formatUSD, timeAgo } from "@/lib/format";
import { flagForCountryName } from "@/lib/countries";
import { ArrowUpDown, Crown, Download, LogOut, Plus, Trash2, Upload, Send, Image as ImageIcon, Video } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — SAAS AUCTION" },
      { name: "description", content: "Auction administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <Layout>
      <Admin />
    </Layout>
  ),
});

type FullBid = {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  country: string;
  amount: number;
  is_winner: boolean;
  created_at: string;
  profile_id: string | null;
};

type RegisteredUser = {
  id: string;
  display_name: string;
  email: string;
  country: string;
  phone: string | null;
  created_at: string;
  has_bid: boolean;
};

function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (authLoading) return <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  if (!session) return <AuthForm />;
  if (isAdmin === null) return <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">Checking access…</div>;
  if (!isAdmin) return <NotAdmin email={session.user.email ?? ""} />;
  return <AdminDashboard />;
}

function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (mode === "sign-up") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: "https://dacadb19-d671-4c79-b248-0e2e0ea9215d.lovable.app/admin" },
      });
      if (error) toast.error(error.message);
      else toast.success("Account created. You may need to confirm your email.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 space-y-5 shadow-elevated">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Admin access</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage SAAS AUCTION.</p>
        </header>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={6} required /></div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary">
            {loading ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="text-xs text-muted-foreground hover:text-foreground">
          {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function NotAdmin({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-mono">{email}</span> — no admin role.
      </p>
      <Button variant="outline" onClick={() => supabase.auth.signOut()}>
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
    </div>
  );
}

function AdminDashboard() {
  const { settings } = useAuctionSettings();
  const { topBid } = useBids();
  const [fullBids, setFullBids] = useState<FullBid[]>([]);
  const [sortDesc, setSortDesc] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "media" | "bids" | "users" | "email">("overview");
  const [users, setUsers] = useState<RegisteredUser[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from("bids")
      .select("id, display_name, country, amount, is_winner, created_at, profile_id, profiles:profile_id(email, phone)")
      .order("amount", { ascending: false });
    if (error) toast.error(error.message);
    else setFullBids(((data ?? []) as unknown as Array<Omit<FullBid, "email" | "phone"> & { profiles: { email: string; phone: string | null } | null }>).map((b) => ({
      ...b, email: b.profiles?.email ?? "", phone: b.profiles?.phone ?? null,
    })));
  }

  async function loadUsers() {
    const [{ data: profs }, { data: bidRows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email, country, phone, created_at").order("created_at", { ascending: false }),
      supabase.from("bids").select("profile_id"),
    ]);
    const bidderIds = new Set((bidRows ?? []).map((b) => b.profile_id).filter(Boolean));
    setUsers(((profs ?? []) as RegisteredUser[]).map((p) => ({ ...p, has_bid: bidderIds.has(p.id) })));
  }

  useEffect(() => {
    load();
    loadUsers();
    const ch = supabase
      .channel("admin_bids_7f3k9m2p")
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => { load(); loadUsers(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const sorted = useMemo(
    () => [...fullBids].sort((a, b) => (sortDesc ? b.amount - a.amount : a.amount - b.amount)),
    [fullBids, sortDesc]
  );
  const status = getAuctionStatus(settings);
  const remaining = settings ? Math.max(0, new Date(settings.end_time).getTime() - Date.now()) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">SAAS AUCTION — Admin</h1>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          ["overview", "Overview"],
          ["content", "App Content"],
          ["media", "Media"],
          ["bids", `Bids (${fullBids.length})`],
          ["users", `Users (${users.length})`],
          ["email", "Email Bidders"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total bids" value={fullBids.length.toString()} />
            <Stat label="Highest bid" value={topBid ? formatUSD(Number(topBid.amount)) : "—"} />
            <Stat label="Top bidder" value={topBid?.display_name ?? "—"} />
            <Stat label={`Status: ${status}`} value={settings ? `${Math.floor(remaining / 3600000)}h left` : "—"} />
          </div>
          <AuctionManagement
            status={status}
            bidsCount={fullBids.length}
            usersCount={users.length}
            winnerAnnounced={!!settings?.winner_announced}
            onChanged={() => { load(); loadUsers(); }}
          />
          {settings && <AuctionTimingForm settings={settings} onSaved={() => { load(); loadUsers(); }} />}
          {sorted[0] && <WinnerCard winner={sorted[0]} onMarked={load} />}
          <TopBidders bids={sorted} status={status} onMarked={load} />
        </div>
      )}

      {tab === "content" && settings && <ContentEditor settings={settings} />}
      {tab === "media" && <MediaManager />}
      {tab === "bids" && <BidsTable sorted={sorted} sortDesc={sortDesc} setSortDesc={setSortDesc} />}
      {tab === "users" && <RegisteredUsersTable users={users} />}
      {tab === "email" && <BulkEmail bids={sorted} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      <p className="mt-1 text-xl font-bold truncate">{value}</p>
    </div>
  );
}

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function callAdminAction(path: string): Promise<{ ok: boolean; data: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error("Not signed in"); return { ok: false, data: null }; }
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    });
    const data = await r.json();
    if (!r.ok) {
      toast.error((data as { error?: string }).error ?? `Failed (HTTP ${r.status})`);
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Network error");
    return { ok: false, data: null };
  }
}

function AuctionManagement({
  status, bidsCount, usersCount, winnerAnnounced, onChanged,
}: { status: string; bidsCount: number; usersCount: number; winnerAnnounced: boolean; onChanged: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  async function doReset() {
    setConfirmReset(false);
    const r = await callAdminAction("/api/admin/reset-auction");
    if (r.ok) { toast.success("Auction reset — all bids cleared"); onChanged(); }
  }
  async function doEnd() {
    setConfirmEnd(false);
    const r = await callAdminAction("/api/admin/end-auction");
    if (r.ok) { toast.success("Auction ended"); onChanged(); }
  }

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <h2 className="text-lg font-semibold">Auction Management</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground uppercase">Status</p>
          <p className="font-bold capitalize">{status}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground uppercase">Bids</p>
          <p className="font-bold">{bidsCount}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground uppercase">Users</p>
          <p className="font-bold">{usersCount}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground uppercase">Winner</p>
          <p className="font-bold">{winnerAnnounced ? "Announced" : "—"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => setConfirmReset(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Reset Auction Data
        </Button>
        <Button variant="outline" onClick={() => setConfirmEnd(true)}>
          End Auction Now
        </Button>
      </div>

      {confirmReset && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 space-y-3">
          <p className="text-sm">
            This will permanently delete ALL bids and reset the winner. Registered user profiles will be kept.
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={doReset}>Yes, reset everything</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {confirmEnd && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 space-y-3">
          <p className="text-sm">End the auction immediately? Bidders will no longer be able to place bids.</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-gradient-primary" onClick={doEnd}>Yes, end now</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmEnd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function AuctionTimingForm({ settings, onSaved }: { settings: AuctionSettings; onSaved?: () => void }) {
  const [clearBids, setClearBids] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const start_time = new Date(String(fd.get("start_time"))).toISOString();
    const end_time = new Date(String(fd.get("end_time"))).toISOString();
    const starting_bid = Number(fd.get("starting_bid"));
    const { error } = await supabase
      .from("auction_settings")
      .update({ start_time, end_time, starting_bid, is_manually_ended: false, winner_announced: false })
      .eq("id", 1);
    if (error) { toast.error(error.message); return; }
    if (clearBids) {
      const r = await callAdminAction("/api/admin/reset-auction");
      if (!r.ok) return;
      toast.success("Timing saved & previous bids cleared");
    } else {
      toast.success("Auction timing saved");
    }
    onSaved?.();
  }
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6">
      <h2 className="text-lg font-semibold mb-4">Start New Auction / Timing</h2>
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="start_time">Start time</Label>
          <Input id="start_time" name="start_time" type="datetime-local" defaultValue={toLocalInput(settings.start_time)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_time">End time</Label>
          <Input id="end_time" name="end_time" type="datetime-local" defaultValue={toLocalInput(settings.end_time)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="starting_bid">Starting bid (USD)</Label>
          <Input id="starting_bid" name="starting_bid" type="number" min={0} step="1" defaultValue={settings.starting_bid} required />
        </div>
        <div className="sm:col-span-3 flex items-center gap-2">
          <Checkbox id="clear-bids" checked={clearBids} onCheckedChange={(v) => setClearBids(!!v)} />
          <Label htmlFor="clear-bids" className="text-sm font-normal cursor-pointer">
            Also clear all previous bid data when starting new auction
          </Label>
        </div>
        <div className="sm:col-span-3"><Button type="submit" className="bg-gradient-primary">Save timing</Button></div>
      </form>
    </section>
  );
}

async function callMarkWinner(bidId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error("Not signed in"); return false; }
  try {
    const r = await fetch("/api/admin/mark-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ bidId }),
    });
    const data = await r.json();
    if (!r.ok) { toast.error(data.error ?? `Failed (HTTP ${r.status})`); return false; }
    toast.success("Winner marked & announced");
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Network error");
    return false;
  }
}

function WinnerCard({ winner, onMarked }: { winner: FullBid; onMarked: () => void }) {
  async function mark() {
    const ok = await callMarkWinner(winner.id);
    if (ok) onMarked();
  }
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Crown className="h-5 w-5 text-gold" /> Current Top Bidder
      </h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{winner.display_name}</span></div>
        <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{winner.email}</span></div>
        <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{winner.phone ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Bid:</span> <span className="font-bold">{formatUSD(Number(winner.amount))}</span></div>
        {winner.is_winner && <span className="rounded-full bg-success/20 text-success px-2 py-0.5 text-xs">Marked as winner</span>}
      </div>
      <Button onClick={mark} className="bg-gradient-primary">Mark as Winner</Button>
    </section>
  );
}

function TopBidders({ bids, status, onMarked }: { bids: FullBid[]; status: string; onMarked: () => void }) {
  const top3 = bids.slice(0, 3);
  if (top3.length === 0) return null;
  const ended = status === "ended";
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Top 3 Bidders</h2>
        <p className="text-xs text-muted-foreground max-w-md">
          When auction ends, top bidder is auto-selected. If no response in 24h, manually mark 2nd bidder as winner here.
        </p>
      </div>
      <div className="space-y-2">
        {top3.map((b, i) => {
          const isAuto = ended && i === 0 && !bids.some((x) => x.is_winner);
          return (
            <div
              key={b.id}
              className={`flex items-center gap-3 flex-wrap rounded-xl border px-4 py-3 ${
                b.is_winner ? "border-gold/50 bg-gold/10" : isAuto ? "border-primary/40 bg-primary/10" : "border-border bg-card/40"
              }`}
            >
              <div className="w-8 text-center font-mono font-bold text-muted-foreground">#{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold flex items-center gap-2 flex-wrap">
                  {b.display_name}
                  {b.is_winner && <span className="rounded-full bg-gold/20 text-gold px-2 py-0.5 text-[10px] font-bold tracking-wider">WINNER</span>}
                  {isAuto && <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold tracking-wider">AUTO-SELECTED (PENDING)</span>}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{b.email} {b.phone ? `· ${b.phone}` : ""}</p>
              </div>
              <div className="font-mono font-bold">{formatUSD(Number(b.amount))}</div>
              <Button
                size="sm"
                variant={b.is_winner ? "outline" : "default"}
                className={b.is_winner ? "" : "bg-gradient-primary"}
                onClick={async () => { const ok = await callMarkWinner(b.id); if (ok) onMarked(); }}
              >
                {b.is_winner ? "Marked" : "Mark as Winner"}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RegisteredUsersTable({ users }: { users: RegisteredUser[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">Registered Users ({users.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Country</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Registered</th>
              <th className="py-2 pr-4">Bid?</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{u.display_name}</td>
                <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                <td className="py-2 pr-4">{flagForCountryName(u.country)} {u.country}</td>
                <td className="py-2 pr-4 font-mono text-xs">{u.phone ?? "—"}</td>
                <td className="py-2 pr-4 text-muted-foreground">{timeAgo(u.created_at)}</td>
                <td className="py-2 pr-4">
                  {u.has_bid ? (
                    <span className="rounded-full bg-success/20 text-success px-2 py-0.5 text-xs">Yes</span>
                  ) : (
                    <span className="rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-xs">No</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No users yet</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function ContentEditor({ settings }: { settings: AuctionSettings }) {
  const [appName, setAppName] = useState(settings.app_name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [description, setDescription] = useState(settings.description);
  const [heroUrl, setHeroUrl] = useState(settings.hero_image_url ?? "");
  const [demoUrl, setDemoUrl] = useState(settings.demo_video_url ?? "");
  const [perks, setPerks] = useState<Perk[]>(settings.perks ?? []);
  const [stack, setStack] = useState<StackItem[]>(settings.tech_stack ?? []);
  const [features, setFeatures] = useState<Feature[]>(settings.features ?? []);
  const [includes, setIncludes] = useState<string[]>(settings.includes ?? []);
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    const { error } = await supabase
      .from("auction_settings")
      .update({
        app_name: appName,
        tagline,
        description,
        hero_image_url: heroUrl || null,
        demo_video_url: demoUrl || null,
        perks: perks as never,
        tech_stack: stack as never,
        features: features as never,
        includes: includes as never,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Content saved");
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <h2 className="text-lg font-semibold">App Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>App name</Label><Input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={80} /></div>
          <div className="space-y-1.5"><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
        </div>
      </div>

      <MediaSection label="Hero image" value={heroUrl} setValue={setHeroUrl} accept="image/*" kind="image" />
      <MediaSection label="Demo video" value={demoUrl} setValue={setDemoUrl} accept="video/*" kind="video" allowExternalUrl />

      <ListEditor<Perk>
        title="What You Get When You Win"
        items={perks}
        setItems={setPerks}
        empty={{ title: "", desc: "" }}
        renderRow={(item, update) => (
          <>
            <Input placeholder="Title" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
            <Input placeholder="Description" value={item.desc} onChange={(e) => update({ ...item, desc: e.target.value })} />
          </>
        )}
      />

      <ListEditor<StackItem>
        title="Tech Stack"
        items={stack}
        setItems={setStack}
        empty={{ k: "", v: "" }}
        renderRow={(item, update) => (
          <>
            <Input placeholder="Category (e.g. Frontend)" value={item.k} onChange={(e) => update({ ...item, k: e.target.value })} />
            <Input placeholder="Value (e.g. React)" value={item.v} onChange={(e) => update({ ...item, v: e.target.value })} />
          </>
        )}
      />

      <ListEditor<Feature>
        title="Features"
        items={features}
        setItems={setFeatures}
        empty={{ t: "", d: "" }}
        renderRow={(item, update) => (
          <>
            <Input placeholder="Title" value={item.t} onChange={(e) => update({ ...item, t: e.target.value })} />
            <Input placeholder="Description" value={item.d} onChange={(e) => update({ ...item, d: e.target.value })} />
          </>
        )}
      />

      <ListEditor<string>
        title="What's Included in the Sale"
        items={includes}
        setItems={setIncludes}
        empty=""
        renderRow={(item, update) => (
          <Input placeholder="Bullet point" value={item} onChange={(e) => update(e.target.value)} className="sm:col-span-2" />
        )}
      />

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={saveAll} disabled={saving} size="lg" className="bg-gradient-primary shadow-glow">
          {saving ? "Saving…" : "Save all content"}
        </Button>
      </div>
    </section>
  );
}

// ACTION REQUIRED: In Supabase Dashboard → Storage → auction-media → Edit
// and Storage → app-images → Edit: disable "Public directory listing".
// Files remain accessible via direct URL but cannot be listed by anyone.
function MediaSection({
  label, value, setValue, accept, kind, allowExternalUrl,
}: { label: string; value: string; setValue: (v: string) => void; accept: string; kind: "image" | "video"; allowExternalUrl?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("auction-media").upload(path, file, { upsert: false });
    if (error) {
      toast.error(error.message);
    } else {
      const { data } = supabase.storage.from("auction-media").getPublicUrl(path);
      setValue(data.publicUrl);
      toast.success(`${label} uploaded`);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        {kind === "image" ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {label}
      </h3>
      <div className="flex flex-wrap gap-2 items-center">
        <input ref={inputRef} type="file" accept={accept} onChange={onFile} className="hidden" id={`file-${label}`} />
        <Button asChild variant="outline" disabled={uploading}>
          <label htmlFor={`file-${label}`} className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading…" : "Upload file"}
          </label>
        </Button>
        {allowExternalUrl && (
          <span className="text-xs text-muted-foreground">or paste a URL (e.g. YouTube):</span>
        )}
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" className="flex-1 min-w-[200px]" />
        {value && <Button variant="ghost" size="sm" onClick={() => setValue("")}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      {value && kind === "image" && <img src={value} alt="" className="max-h-40 rounded-lg border border-border" />}
      {value && kind === "video" && !value.includes("youtube") && !value.includes("youtu.be") && (
        <video src={value} controls className="max-h-40 rounded-lg border border-border" />
      )}
    </div>
  );
}

function ListEditor<T>({
  title, items, setItems, empty, renderRow,
}: { title: string; items: T[]; setItems: (v: T[]) => void; empty: T; renderRow: (item: T, update: (v: T) => void) => React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={() => setItems([...items, empty])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
            {renderRow(item, (v) => {
              const next = [...items];
              next[i] = v;
              setItems(next);
            })}
            <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground py-2">No items yet — click Add to create one.</p>}
      </div>
    </div>
  );
}

function BidsTable({ sorted, sortDesc, setSortDesc }: { sorted: FullBid[]; sortDesc: boolean; setSortDesc: (v: boolean) => void }) {
  function exportCSV() {
    const headers = ["display_name", "email", "country", "amount", "created_at", "is_winner"];
    const rows = sorted.map((b) =>
      headers.map((h) => `"${String((b as unknown as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bids-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold">All Bids (full details)</h2>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Country</th>
              <th className="py-2 pr-4">
                <button onClick={() => setSortDesc(!sortDesc)} className="inline-flex items-center gap-1 hover:text-foreground">
                  Amount <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2 pr-4">When</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{b.display_name}{b.is_winner && <span className="ml-2 text-gold">👑</span>}</td>
                <td className="py-2 pr-4 font-mono text-xs">{b.email}</td>
                <td className="py-2 pr-4 font-mono text-xs">{b.phone ?? "—"}</td>
                <td className="py-2 pr-4">{flagForCountryName(b.country)} {b.country}</td>
                <td className="py-2 pr-4 font-mono font-semibold">{formatUSD(Number(b.amount))}</td>
                <td className="py-2 pr-4 text-muted-foreground">{timeAgo(b.created_at)}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No bids yet</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BulkEmail({ bids }: { bids: FullBid[] }) {
  // dedupe emails (a bidder may have placed multiple bids)
  const uniqueBids = useMemo(() => {
    const seen = new Set<string>();
    return bids.filter((b) => {
      if (seen.has(b.email)) return false;
      seen.add(b.email);
      return true;
    });
  }, [bids]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function toggle(email: string) {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email); else next.add(email);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === uniqueBids.length) setSelected(new Set());
    else setSelected(new Set(uniqueBids.map((b) => b.email)));
  }

  async function send() {
    if (selected.size === 0) { toast.error("Select at least one recipient"); return; }
    if (!subject.trim() || !message.trim()) { toast.error("Subject and message are required"); return; }
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not signed in"); setSending(false); return; }

    try {
      const r = await fetch("/api/admin/send-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipientEmails: Array.from(selected),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? `Failed (HTTP ${r.status})`);
      } else {
        toast.success(`Sent ${data.sent} of ${data.total} emails`);
        if (data.sent < data.total) {
          const failed = data.results.filter((x: { ok: boolean }) => !x.ok);
          console.warn("Failed sends:", failed);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    }
    setSending(false);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Compose Email</h2>
        <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="e.g. Update on the SAAS AUCTION" /></div>
        <div className="space-y-1.5"><Label>Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={20000} placeholder="Write your message…" /></div>
        <p className="text-xs text-muted-foreground">Sent via Resend. Your message will be wrapped in a branded SAAS AUCTION email template.</p>
        <Button onClick={send} disabled={sending || selected.size === 0} className="bg-gradient-primary">
          <Send className="h-4 w-4 mr-2" /> {sending ? "Sending…" : `Send to ${selected.size} bidder${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Select Recipients ({uniqueBids.length} unique bidders)</h2>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {selected.size === uniqueBids.length && uniqueBids.length > 0 ? "Clear all" : "Select all"}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-2 w-8"></th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4 text-right">Top bid</th>
              </tr>
            </thead>
            <tbody>
              {uniqueBids.map((b) => (
                <tr key={b.email} className="border-b border-border/60 hover:bg-secondary/30 cursor-pointer" onClick={() => toggle(b.email)}>
                  <td className="py-2 pr-2"><Checkbox checked={selected.has(b.email)} onCheckedChange={() => toggle(b.email)} /></td>
                  <td className="py-2 pr-4 font-medium">{b.display_name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{b.email}</td>
                  <td className="py-2 pr-4">{flagForCountryName(b.country)} {b.country}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatUSD(Number(b.amount))}</td>
                </tr>
              ))}
              {uniqueBids.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No bidders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type AppMediaRow = {
  id: number;
  image_urls: string[] | null;
  video_url: string | null;
  demo_url: string | null;
  instagram_url: string | null;
  producthunt_url: string | null;
  acquire_url: string | null;
  indiehackers_url: string | null;
  github_url: string | null;
};

function MediaManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [producthunt, setProducthunt] = useState("");
  const [acquire, setAcquire] = useState("");
  const [indiehackers, setIndiehackers] = useState("");
  const [github, setGithub] = useState("");
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("app_media").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      const m = data as AppMediaRow | null;
      if (m) {
        setImages((m.image_urls ?? []).filter(Boolean));
        setVideoUrl(m.video_url ?? "");
        setDemoUrl(m.demo_url ?? "");
        setInstagram(m.instagram_url ?? "");
        setProducthunt(m.producthunt_url ?? "");
        setAcquire(m.acquire_url ?? "");
        setIndiehackers(m.indiehackers_url ?? "");
        setGithub(m.github_url ?? "");
      }
      setLoading(false);
    });
  }, []);

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 8) { toast.error("Maximum 8 images"); return; }
    setUploadingImg(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("app-images").upload(path, file, { upsert: false });
    if (error) toast.error(error.message);
    else {
      const { data } = supabase.storage.from("app-images").getPublicUrl(path);
      setImages((prev) => [...prev, data.publicUrl]);
      toast.success("Image uploaded");
    }
    setUploadingImg(false);
    if (imgInput.current) imgInput.current.value = "";
  }

  async function uploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("auction-media").upload(path, file, { upsert: false });
    if (error) toast.error(error.message);
    else {
      const { data } = supabase.storage.from("auction-media").getPublicUrl(path);
      setVideoUrl(data.publicUrl);
      toast.success("Video uploaded");
    }
    setUploadingVideo(false);
    if (vidInput.current) vidInput.current.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("app_media").upsert({
      id: 1,
      image_urls: images,
      video_url: videoUrl || null,
      demo_url: demoUrl || null,
      instagram_url: instagram || null,
      producthunt_url: producthunt || null,
      acquire_url: acquire || null,
      indiehackers_url: indiehackers || null,
      github_url: github || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Media saved");
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const ytEmbed = isYouTube ? videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/") : "";

  return (
    <section className="space-y-6">
      {/* Screenshots */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ImageIcon className="h-5 w-5" /> App screenshots</h2>
          <span className="text-xs text-muted-foreground">{images.length}/8</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((u) => (
            <div key={u} className="relative group">
              <img src={u} alt="" className="rounded-lg border border-border w-full h-28 object-cover" />
              <button
                type="button"
                onClick={() => removeImage(u)}
                className="absolute top-1 right-1 rounded-full bg-destructive text-destructive-foreground p-1 opacity-90 hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <label htmlFor="img-upload" className="cursor-pointer rounded-lg border border-dashed border-border bg-card/40 hover:bg-secondary/50 h-28 flex flex-col items-center justify-center text-xs text-muted-foreground">
              <Upload className="h-4 w-4 mb-1" />
              {uploadingImg ? "Uploading…" : "Upload image"}
            </label>
          )}
        </div>
        <input ref={imgInput} id="img-upload" type="file" accept="image/*" onChange={uploadImage} className="hidden" />
        {images.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Show URLs</summary>
            <div className="mt-2 space-y-1">
              {images.map((u) => (
                <p key={u} className="font-mono break-all text-muted-foreground">{u}</p>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Demo Video */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Video className="h-5 w-5" /> Demo video</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/… or Loom URL" className="flex-1 min-w-[220px]" />
          <input ref={vidInput} id="vid-upload" type="file" accept="video/*" onChange={uploadVideo} className="hidden" />
          <Button asChild variant="outline" disabled={uploadingVideo}>
            <label htmlFor="vid-upload" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" /> {uploadingVideo ? "Uploading…" : "Upload video"}
            </label>
          </Button>
          {videoUrl && <Button variant="ghost" size="sm" onClick={() => setVideoUrl("")}><Trash2 className="h-4 w-4" /></Button>}
        </div>
        {videoUrl && isYouTube && (
          <div className="aspect-video w-full max-w-xl rounded-lg overflow-hidden border border-border">
            <iframe src={ytEmbed} title="Demo" className="w-full h-full" allowFullScreen />
          </div>
        )}
        {videoUrl && !isYouTube && (
          <video src={videoUrl} controls className="max-h-64 rounded-lg border border-border" />
        )}
      </div>

      {/* Live demo URL */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
        <Label className="text-base font-semibold">Live app URL (shown as demo link badge)</Label>
        <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://yourapp.com" />
      </div>

      {/* Trust Badge Links */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Trust Badge Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Instagram profile URL</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/…" /></div>
          <div className="space-y-1.5"><Label>Product Hunt URL</Label><Input value={producthunt} onChange={(e) => setProducthunt(e.target.value)} placeholder="https://producthunt.com/…" /></div>
          <div className="space-y-1.5"><Label>Acquire.com listing URL</Label><Input value={acquire} onChange={(e) => setAcquire(e.target.value)} placeholder="https://acquire.com/…" /></div>
          <div className="space-y-1.5"><Label>Indie Hackers URL</Label><Input value={indiehackers} onChange={(e) => setIndiehackers(e.target.value)} placeholder="https://indiehackers.com/…" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>GitHub repo URL</Label><Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/…" /></div>
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="bg-gradient-primary shadow-glow">
          {saving ? "Saving…" : "Save media"}
        </Button>
      </div>
    </section>
  );
}
