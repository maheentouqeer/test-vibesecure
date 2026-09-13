import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/end-auction")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Missing auth");
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
          .from("user_roles").select("role")
          .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
        if (!roleRow) return jsonError(403, "Forbidden — admin only");

        const { error } = await admin
          .from("auction_settings")
          .update({ is_manually_ended: true })
          .eq("id", 1);
        if (error) return jsonError(500, error.message);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
