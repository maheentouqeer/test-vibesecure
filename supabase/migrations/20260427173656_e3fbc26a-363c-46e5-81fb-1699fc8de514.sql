
-- 1. Auction content fields
ALTER TABLE public.auction_settings
  ADD COLUMN IF NOT EXISTS app_name text NOT NULL DEFAULT 'Habito',
  ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Own a fully built AI SaaS app. One bid. 48 hours. Winner takes everything.',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT 'An AI-powered habit and goal tracking SaaS with gamification, weekly AI coaching, and full subscription monetization.',
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS demo_video_url text,
  ADD COLUMN IF NOT EXISTS perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tech_stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS includes jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.auction_settings
SET
  perks = CASE WHEN perks = '[]'::jsonb THEN '[
    {"title":"Full source code","desc":"React + Python Flask + Neon PostgreSQL"},
    {"title":"Admin dashboard","desc":"CRM and mass email tool"},
    {"title":"AI coaching engine","desc":"Grok + Gemini integration"},
    {"title":"Whop payment integration","desc":"Webhook handling included"},
    {"title":"Badge gamification engine","desc":"Streaks, completions, milestones"},
    {"title":"Complete documentation","desc":"Full setup guide"},
    {"title":"FREE ebook ($35 value)","desc":"How I Built a SaaS App Using Claude & AI Tools"},
    {"title":"1-hour handover call","desc":"Direct with the seller"}
  ]'::jsonb ELSE perks END,
  tech_stack = CASE WHEN tech_stack = '[]'::jsonb THEN '[
    {"k":"Frontend","v":"React 18 + Vite + TailwindCSS"},
    {"k":"Backend","v":"Python Flask API"},
    {"k":"Database","v":"Neon PostgreSQL"},
    {"k":"Auth","v":"JWT + bcrypt"},
    {"k":"Payments","v":"Whop"},
    {"k":"AI","v":"Grok + Gemini"},
    {"k":"Email","v":"Resend"},
    {"k":"Deployment","v":"Vercel + Railway"}
  ]'::jsonb ELSE tech_stack END,
  features = CASE WHEN features = '[]'::jsonb THEN '[
    {"t":"AI Coaching Engine","d":"Quantified weekly insights"},
    {"t":"Gamification Badges","d":"Streaks and completions"},
    {"t":"Habit + Goal Tracking","d":"Frequency and deadlines"},
    {"t":"Admin Dashboard","d":"CRM, analytics, mass email"},
    {"t":"Subscription Paywall","d":"Whop webhook integration"},
    {"t":"Daily Motivation","d":"Personalized morning messages"}
  ]'::jsonb ELSE features END,
  includes = CASE WHEN includes = '[]'::jsonb THEN '[
    "Full source code (frontend + backend)",
    "Database schema and seed data",
    "All API keys setup guide",
    "Admin dashboard access",
    "Complete technical documentation",
    "30-minute seller handover call",
    "FREE ebook guide valued at $35"
  ]'::jsonb ELSE includes END
WHERE id = 1;

-- 2. Drop dependent function + view, then recreate both
DROP FUNCTION IF EXISTS public.place_bid(text, text, text, numeric) CASCADE;
DROP VIEW IF EXISTS public.public_bids CASCADE;

CREATE VIEW public.public_bids
WITH (security_invoker = true, security_barrier = true)
AS
SELECT id, display_name, country, amount, is_winner, created_at
FROM public.bids;

GRANT SELECT ON public.public_bids TO anon, authenticated;

-- Recreate place_bid: returns the public_bids view row shape (no email)
CREATE OR REPLACE FUNCTION public.place_bid(
  _display_name text,
  _email text,
  _country text,
  _amount numeric
)
RETURNS public.public_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  s public.auction_settings;
  current_top numeric;
  inserted public.bids;
BEGIN
  SELECT * INTO s FROM public.auction_settings WHERE id = 1;
  IF s IS NULL THEN RAISE EXCEPTION 'Auction not configured'; END IF;
  IF now() < s.start_time THEN RAISE EXCEPTION 'Auction has not started yet'; END IF;
  IF now() > s.end_time THEN RAISE EXCEPTION 'Auction has ended'; END IF;

  IF _display_name IS NULL OR char_length(trim(_display_name)) = 0 OR char_length(_display_name) > 80 THEN
    RAISE EXCEPTION 'Invalid display name';
  END IF;
  IF _email IS NULL OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(_email) > 255 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;
  IF _country IS NULL OR char_length(trim(_country)) = 0 OR char_length(_country) > 80 THEN
    RAISE EXCEPTION 'Invalid country';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid bid amount';
  END IF;

  SELECT COALESCE(MAX(amount), 0) INTO current_top FROM public.bids;
  IF _amount <= GREATEST(current_top, s.starting_bid - 0.01) THEN
    RAISE EXCEPTION 'Bid must be higher than $%', GREATEST(current_top, s.starting_bid);
  END IF;

  INSERT INTO public.bids (display_name, email, country, amount)
  VALUES (trim(_display_name), lower(trim(_email)), trim(_country), _amount)
  RETURNING * INTO inserted;

  RETURN ROW(inserted.id, inserted.display_name, inserted.country, inserted.amount, inserted.is_winner, inserted.created_at)::public.public_bids;
END;
$fn$;

-- 3. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.place_bid(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(text, text, text, numeric) TO anon, authenticated;

-- 4. Tighten bids table column-level grants — exclude email from anon/authenticated
REVOKE SELECT ON public.bids FROM anon, authenticated;
GRANT SELECT (id, display_name, country, amount, is_winner, created_at)
  ON public.bids TO anon, authenticated;
GRANT SELECT ON public.bids TO service_role;

-- Public can SELECT non-email columns (RLS layer)
DROP POLICY IF EXISTS "Public can view non-email bid columns" ON public.bids;
CREATE POLICY "Public can view non-email bid columns"
ON public.bids FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Stop broadcasting raw bids (which contains email) via realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bids'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.bids';
  END IF;
END $$;

-- 6. Prevent privilege escalation on user_roles
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles AS RESTRICTIVE FOR INSERT
TO authenticated, anon
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
ON public.user_roles AS RESTRICTIVE FOR UPDATE
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
ON public.user_roles AS RESTRICTIVE FOR DELETE
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 7. Storage bucket for admin media
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction-media', 'auction-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view auction media" ON storage.objects;
CREATE POLICY "Public can view auction media"
ON storage.objects FOR SELECT
USING (bucket_id = 'auction-media');

DROP POLICY IF EXISTS "Admins can upload auction media" ON storage.objects;
CREATE POLICY "Admins can upload auction media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'auction-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update auction media" ON storage.objects;
CREATE POLICY "Admins can update auction media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'auction-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete auction media" ON storage.objects;
CREATE POLICY "Admins can delete auction media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'auction-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 8. Grant the requesting user admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'maheentouqeer76@gmail.com'
ON CONFLICT DO NOTHING;
