import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.object({ bidId: z.string().uuid() });

export const Route = createFileRoute("/api/admin/mark-winner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonError(401, "Missing auth");
        }
        const token = authHeader.slice("Bearer ".length);

        const supabaseUrl = process.env.SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

        const userClient = createClient<Database>(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData.user) return jsonError(401, "Invalid session");

        const admin = createClient<Database>(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) return jsonError(403, "Forbidden — admin only");

        let body: unknown;
        try { body = await request.json(); } catch { return jsonError(400, "Invalid JSON"); }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) return jsonError(400, "Invalid bidId");
        const { bidId } = parsed.data;

        // Lookup the winning bid
        const { data: bid, error: bidErr } = await admin
          .from("bids")
          .select("id, profile_id")
          .eq("id", bidId)
          .maybeSingle();
        if (bidErr || !bid) return jsonError(404, "Bid not found");

        // Reset all other winners, then set this one
        const { error: e1 } = await admin.from("bids").update({ is_winner: false }).neq("id", bidId);
        if (e1) return jsonError(500, e1.message);
        const { error: e2 } = await admin.from("bids").update({ is_winner: true }).eq("id", bidId);
        if (e2) return jsonError(500, e2.message);

        // Update auction settings
        const { error: e3 } = await admin
          .from("auction_settings")
          .update({ winner_announced: true, winner_profile_id: bid.profile_id })
          .eq("id", 1);
        if (e3) return jsonError(500, e3.message);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
