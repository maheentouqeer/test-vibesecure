import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@supabase/supabase-js";

const schema = z.object({
  display_name: z.string().trim().min(1, "Required").max(80),
  country: z.string().min(1, "Pick a country").max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  agreed_to_pay: z.literal(true, { errorMap: () => ({ message: "Required to submit" }) }),
  agreed_to_public: z.literal(true, { errorMap: () => ({ message: "Required to submit" }) }),
});

const TOASTS = [
  "You're in! The clock is ticking — place your bid before someone else takes the lead!",
  "Profile created! One bid could change your journey as a SaaS owner.",
  "Almost there! Secure your spot on the leaderboard before time runs out.",
  "Let's go! Every bid counts — don't wait until the last minute.",
];

export function ProfileForm({ user, onCreated }: { user: User; onCreated: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = {
      display_name: fd.get("display_name"),
      country: fd.get("country"),
      phone: fd.get("phone") ?? "",
      agreed_to_pay: fd.get("agreed_to_pay") === "on",
      agreed_to_public: fd.get("agreed_to_public") === "on",
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from("profiles").insert({
      user_id: user.id,
      email: (user.email ?? "").toLowerCase(),
      display_name: parsed.data.display_name,
      country: parsed.data.country,
      phone: parsed.data.phone || null,
      agreed_to_pay: true,
      agreed_to_public: true,
    }).select("*").single();
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "Could not create profile");
      return;
    }

    // Trigger welcome email (best-effort, non-blocking on UI)
    fetch("/api/welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: data.id }),
    }).catch(() => {});

    toast.success(TOASTS[Math.floor(Math.random() * TOASTS.length)]);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Display name <span className="text-muted-foreground">(public)</span></Label>
          <Input id="display_name" name="display_name" placeholder="What others will see" />
          {errors.display_name && <p className="text-xs text-destructive">{errors.display_name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <select
            id="country" name="country" defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled>Select country</option>
            {COUNTRIES.map((c) => (<option key={c.code} value={c.name}>{c.flag} {c.name}</option>))}
          </select>
          {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="phone">WhatsApp / Phone <span className="text-muted-foreground">(optional, private)</span></Label>
          <Input id="phone" name="phone" placeholder="+1 555 0100" />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox name="agreed_to_pay" className="mt-0.5" />
        <span>I understand that winning this auction means I commit to completing payment within 48 hours of being contacted.</span>
      </label>
      {errors.agreed_to_pay && <p className="text-xs text-destructive">{errors.agreed_to_pay}</p>}

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox name="agreed_to_public" className="mt-0.5" />
        <span>I agree that my display name, country, and bid amount will be visible publicly on the leaderboard.</span>
      </label>
      {errors.agreed_to_public && <p className="text-xs text-destructive">{errors.agreed_to_public}</p>}

      <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary shadow-glow text-base h-11">
        {submitting ? "Creating…" : "Create My Profile 🚀"}
      </Button>
    </form>
  );
}
