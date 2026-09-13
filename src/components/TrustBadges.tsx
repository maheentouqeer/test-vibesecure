import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppMedia = {
  producthunt_url: string | null;
  acquire_url: string | null;
  indiehackers_url: string | null;
  instagram_url: string | null;
  github_url: string | null;
  demo_url: string | null;
  video_url: string | null;
};

export function TrustBadges() {
  const [media, setMedia] = useState<AppMedia | null>(null);
  useEffect(() => {
    supabase.from("app_media").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setMedia(data as AppMedia);
    });
    const ch = supabase.channel("app_media_badges").on("postgres_changes",
      { event: "*", schema: "public", table: "app_media" },
      () => supabase.from("app_media").select("*").eq("id", 1).maybeSingle().then(({ data }) => data && setMedia(data as AppMedia))
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const badges = [
    { label: "🟠 Product Hunt", url: media?.producthunt_url },
    { label: "🔵 Acquire.com", url: media?.acquire_url },
    { label: "🟣 Indie Hackers", url: media?.indiehackers_url },
    { label: "📸 Instagram", url: media?.instagram_url },
    { label: "💻 GitHub", url: media?.github_url },
    { label: "🎬 Watch Demo", url: media?.video_url || media?.demo_url },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {badges.map((b) =>
        b.url && b.url.trim() ? (
          <a
            key={b.label}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs sm:text-sm font-medium hover:bg-secondary/60 hover:border-primary/40 transition-colors"
          >
            {b.label}
          </a>
        ) : null
      )}
    </div>
  );
}
