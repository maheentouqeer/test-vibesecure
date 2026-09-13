import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.object({
  recipientEmails: z.array(z.string().email().max(255)).min(1).max(500),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(20000),
  fromName: z.string().min(1).max(80).optional(),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const Route = createFileRoute("/api/admin/send-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Verify caller is admin via their JWT
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const token = authHeader.slice("Bearer ".length);

        const supabaseUrl = process.env.SUPABASE_URL!;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const userClient = createClient<Database>(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        // Check admin role
        const adminClient = createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: roleRow } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) {
          return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        // 2. Validate body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const { recipientEmails, subject, message, fromName } = parsed.data;

        const lovableKey = process.env.LOVABLE_API_KEY;
        const resendKey = process.env.RESEND_API_KEY;
        if (!lovableKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        if (!resendKey) {
          return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // 3. Build HTML
        const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0f0c1f;color:#fff;padding:24px">
          <div style="max-width:560px;margin:0 auto;background:#1a1530;border-radius:16px;padding:32px;border:1px solid #2a2444">
            <h1 style="color:#a855f7;margin:0 0 16px;font-size:22px">SAAS AUCTION</h1>
            <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;color:#e5e5e5">${escapeHtml(message)}</div>
            <hr style="border:none;border-top:1px solid #2a2444;margin:32px 0 16px"/>
            <p style="font-size:11px;color:#888;margin:0">You received this because you placed a bid in our auction.</p>
          </div></body></html>`;

        const from = fromName ? `${fromName} <onboarding@resend.dev>` : "SAAS AUCTION <onboarding@resend.dev>";

        // 4. Send one-by-one (Resend batch API requires identical payloads; per-recipient is safest)
        const results: { email: string; ok: boolean; error?: string }[] = [];
        for (const to of recipientEmails) {
          try {
            const r = await fetch(`${GATEWAY_URL}/emails`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": resendKey,
              },
              body: JSON.stringify({ from, to: [to], subject, html }),
            });
            if (!r.ok) {
              const txt = await r.text();
              results.push({ email: to, ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` });
            } else {
              results.push({ email: to, ok: true });
            }
          } catch (e) {
            results.push({ email: to, ok: false, error: e instanceof Error ? e.message : "Unknown error" });
          }
        }

        const sent = results.filter((r) => r.ok).length;
        return new Response(JSON.stringify({ sent, total: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
