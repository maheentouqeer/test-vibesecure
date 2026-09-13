import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getRedirectOrigin, validatePasswordStrength } from "@/lib/site";

export function InlineAuth() {
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

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
        email, password,
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

  if (verifyEmail) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-3">
          <div className="text-4xl">📬</div>
          <h3 className="font-semibold text-lg">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-mono font-semibold">{verifyEmail}</span>.
            Click it to verify your account, then come back here to sign in.
          </p>
          <button
            onClick={() => { setVerifyEmail(null); setMode("sign-in"); }}
            className="text-xs text-primary hover:underline"
          >
            Already verified? Sign in →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">
          {mode === "sign-up" ? "Create your account to bid" : "Sign in to place your bid"}
        </h2>
        <p className="text-xs text-muted-foreground">
          Takes 30 seconds. Email verification required.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-card/60 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="inline-email">Email</Label>
          <Input id="inline-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inline-password">Password</Label>
          <Input id="inline-password" name="password" type="password" minLength={8} required
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"} />
          {mode === "sign-up" && (
            <p className="text-[11px] text-muted-foreground">Min 8 chars, 1 uppercase, 1 number.</p>
          )}
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow h-11">
          {loading ? "…" : mode === "sign-up" ? "Create account & bid" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
