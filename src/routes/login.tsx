import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getRedirectOrigin, validatePasswordStrength } from "@/lib/site";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SAAS AUCTION" },
      { name: "description", content: "Sign in or create your bidder account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <Layout>
      <LoginPage />
    </Layout>
  ),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (user && isAdmin) navigate({ to: "/admin" });
  }, [user, isAdmin, navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");

    if (mode === "sign-up") {
      const pwErr = validatePasswordStrength(password);
      if (pwErr) { toast.error(pwErr); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${getRedirectOrigin()}/` },
      });
      if (error) toast.error(error.message);
      else if (data.session) toast.success("Account created — you're signed in");
      else setVerifyEmail(email);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else toast.success("Welcome back!");
    }
    setLoading(false);
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold">You're signed in</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        <div className="flex justify-center gap-2">
          {isAdmin && (
            <Button asChild className="bg-gradient-primary">
              <Link to="/admin">Go to Admin</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/">Go to Bid</Link>
          </Button>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">{mode === "sign-up" ? "Create your account" : "Sign in"}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "sign-up"
            ? "Sign up with your email and password."
            : "Use your email and password to sign in."}
        </p>
      </div>

      {verifyEmail ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-3">
          <div className="text-4xl">📬</div>
          <h3 className="font-semibold text-lg">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-mono font-semibold">{verifyEmail}</span>.
            Click it to verify your account, then come back here to sign in.
          </p>
          <button
            type="button"
            onClick={() => { setVerifyEmail(null); setMode("sign-in"); }}
            className="text-xs text-primary hover:underline"
          >
            Already verified? Sign in →
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-card/60 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"} />
            {mode === "sign-up" && (
              <p className="text-[11px] text-muted-foreground">Min 8 chars, 1 uppercase, 1 number.</p>
            )}
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary">
            {loading ? "…" : mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </form>
      )}
    </div>
  );
}
