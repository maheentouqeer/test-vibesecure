import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false as const, status: 401, error: "Missing auth" };
  const token = authHeader.slice("Bearer ".length);
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return { ok: false as const, status: 401, error: "Invalid session" };
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: roleRow } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return { ok: false as const, status: 403, error: "Forbidden — admin only" };
  return { ok: true as const, admin };
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/reset-auction")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyAdmin(request);
        if (!auth.ok) return jsonError(auth.status, auth.error);
        const { admin } = auth;

        const { error: e1 } = await admin.from("bids").delete().not("id", "is", null);
        if (e1) return jsonError(500, e1.message);
        const { error: e2 } = await admin
          .from("auction_settings")
          .update({ winner_announced: false, winner_profile_id: null, is_manually_ended: false })
          .eq("id", 1);
        if (e2) return jsonError(500, e2.message);

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
