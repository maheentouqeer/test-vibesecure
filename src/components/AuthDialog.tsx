import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getRedirectOrigin, validatePasswordStrength } from "@/lib/site";

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
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
        email,
        password,
        options: { emailRedirectTo: `${getRedirectOrigin()}/` },
      });
      if (error) toast.error(error.message);
      else if (data.session) {
        toast.success("Account created — you're signed in");
        onOpenChange(false);
      } else {
        setVerifyEmail(email);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else {
        toast.success("Welcome back!");
        onOpenChange(false);
      }
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setVerifyEmail(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{verifyEmail ? "Check your email" : mode === "sign-up" ? "Create your account" : "Sign in"}</DialogTitle>
          <DialogDescription>
            {verifyEmail
              ? "Verify your email to activate your account."
              : mode === "sign-up"
              ? "Sign up to create your bidder profile and place bids."
              : "Sign in to your bidder account."}
          </DialogDescription>
        </DialogHeader>
        {verifyEmail ? (
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
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" name="password" type="password" minLength={8} required />
              {mode === "sign-up" && (
                <p className="text-[11px] text-muted-foreground">
                  Min 8 chars, 1 uppercase, 1 number.
                </p>
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
      </DialogContent>
    </Dialog>
  );
}
