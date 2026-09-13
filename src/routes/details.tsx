import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuctionSettings } from "@/hooks/useAuction";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

function Screenshots() {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("app_media").select("image_urls").eq("id", 1).maybeSingle().then(({ data }) => {
      const arr = (data?.image_urls as string[] | null) ?? [];
      setUrls(arr.filter(Boolean));
    });
  }, []);
  if (urls.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-2xl sm:text-3xl font-bold">Screenshots</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {urls.map((u, i) => (
          <img key={i} src={u} alt={`Screenshot ${i + 1}`} className="rounded-xl border border-border max-h-64 w-auto object-cover shrink-0" />
        ))}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/details")({
  head: () => ({
    meta: [
      { title: "App Details — SAAS AUCTION" },
      { name: "description", content: "Full breakdown of the AI SaaS app being auctioned: tech stack, features, and what's included in the sale." },
      { property: "og:title", content: "App Details — SAAS AUCTION" },
      { property: "og:description", content: "Tech stack, features, and what's included in the sale." },
    ],
  }),
  component: () => (
    <Layout>
      <Details />
    </Layout>
  ),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Details() {
  const { settings, loading } = useAuctionSettings();

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  }
  if (!settings) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">No auction configured.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16 space-y-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-primary">The Asset</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">{settings.app_name}</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">{settings.tagline}</p>
        <p className="text-base text-foreground/80 max-w-3xl whitespace-pre-line">{settings.description}</p>
      </header>

      {settings.hero_image_url && (
        <img src={settings.hero_image_url} alt={settings.app_name} className="w-full rounded-2xl border border-border" />
      )}

      <Screenshots />

      {settings.tech_stack?.length > 0 && (
        <Section title="Tech Stack">
          <div className="flex flex-wrap gap-2">
            {settings.tech_stack.map((s, i) => (
              <div key={i} className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs sm:text-sm">
                <span className="text-primary font-semibold">{s.k}:</span>{" "}
                <span className="text-foreground/90">{s.v}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {settings.features?.length > 0 && (
        <Section title="Key Features">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.features.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/60 p-5 space-y-2">
                <p className="font-semibold">{f.t}</p>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {settings.includes?.length > 0 && (
        <Section title="What's Included in the Sale">
          <ul className="space-y-2">
            {settings.includes.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 text-foreground/90">
                <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Demo">
        {settings.demo_video_url ? (
          settings.demo_video_url.includes("youtube.com") || settings.demo_video_url.includes("youtu.be") ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-border">
              <iframe
                src={settings.demo_video_url.replace("watch?v=", "embed/")}
                title="Demo"
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          ) : (
            <video src={settings.demo_video_url} controls className="w-full rounded-xl border border-border" />
          )
        ) : (
          <div className="aspect-video w-full rounded-xl border border-border bg-card/60 flex items-center justify-center text-muted-foreground">
            Demo video — coming soon
          </div>
        )}
      </Section>
    </div>
  );
}
