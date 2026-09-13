-- Drop old place_bid signatures first (they depend on public_bids view)
DROP FUNCTION IF EXISTS public.place_bid(text, text, text, numeric);
DROP FUNCTION IF EXISTS public.place_bid(numeric);

-- Profiles table for bidders (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL UNIQUE,
  country text NOT NULL,
  phone text,
  agreed_to_pay boolean NOT NULL DEFAULT false,
  agreed_to_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public view exposing only safe profile columns
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, user_id, display_name, country, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Link bids to profile_id
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Update public_bids view to include profile_id
DROP VIEW IF EXISTS public.public_bids;
CREATE VIEW public.public_bids
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, display_name, country, amount, is_winner, created_at, profile_id
FROM public.bids;

GRANT SELECT ON public.public_bids TO anon, authenticated;

-- Auction settings: add new columns
ALTER TABLE public.auction_settings ADD COLUMN IF NOT EXISTS is_manually_ended boolean NOT NULL DEFAULT false;
ALTER TABLE public.auction_settings ADD COLUMN IF NOT EXISTS winner_announced boolean NOT NULL DEFAULT false;
ALTER TABLE public.auction_settings ADD COLUMN IF NOT EXISTS winner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- App media table
CREATE TABLE IF NOT EXISTS public.app_media (
  id int PRIMARY KEY DEFAULT 1,
  video_url text,
  demo_url text,
  description text,
  image_urls text[] DEFAULT ARRAY[]::text[],
  producthunt_url text,
  acquire_url text,
  indiehackers_url text,
  github_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_media_singleton CHECK (id = 1)
);

INSERT INTO public.app_media (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app media"
  ON public.app_media FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can update app media"
  ON public.app_media FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert app media"
  ON public.app_media FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate place_bid (auth + profile required)
CREATE FUNCTION public.place_bid(_amount numeric)
RETURNS public.public_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.auction_settings;
  current_top numeric;
  prof public.profiles;
  inserted public.bids;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE user_id = auth.uid();
  IF prof.id IS NULL THEN
    RAISE EXCEPTION 'Profile required before bidding';
  END IF;

  SELECT * INTO s FROM public.auction_settings WHERE id = 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Auction not configured'; END IF;
  IF s.is_manually_ended THEN RAISE EXCEPTION 'Auction has ended'; END IF;
  IF now() < s.start_time THEN RAISE EXCEPTION 'Auction has not started yet'; END IF;
  IF now() > s.end_time THEN RAISE EXCEPTION 'Auction has ended'; END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid bid amount';
  END IF;

  SELECT COALESCE(MAX(amount), 0) INTO current_top FROM public.bids;
  IF _amount <= GREATEST(current_top, s.starting_bid - 0.01) THEN
    RAISE EXCEPTION 'Bid must be higher than $%', GREATEST(current_top, s.starting_bid);
  END IF;

  INSERT INTO public.bids (display_name, email, country, amount, profile_id)
  VALUES (prof.display_name, prof.email, prof.country, _amount, prof.id)
  RETURNING * INTO inserted;

  RETURN ROW(inserted.id, inserted.display_name, inserted.country, inserted.amount, inserted.is_winner, inserted.created_at, inserted.profile_id)::public.public_bids;
END;
$$;

REVOKE ALL ON FUNCTION public.place_bid(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(numeric) TO authenticated;

-- Storage bucket for app screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-images', 'app-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view app images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-images');

CREATE POLICY "Admins can upload app images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-images' AND public.has_role(auth.uid(), 'admin'));