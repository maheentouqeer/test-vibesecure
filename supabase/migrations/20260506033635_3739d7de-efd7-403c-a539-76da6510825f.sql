
-- SECURITY FIX 1: profiles RLS strict
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON public.profiles FROM anon;

-- SECURITY FIX 2: views
DROP VIEW IF EXISTS public.public_bids CASCADE;
CREATE VIEW public.public_bids
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, display_name, country, amount, is_winner, created_at, profile_id
FROM public.bids;
GRANT SELECT ON public.public_bids TO anon, authenticated;

DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, display_name, country, created_at
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- SECURITY FIX 3: place_bid hardened + bids insert RLS
CREATE OR REPLACE FUNCTION public.place_bid(_amount numeric)
RETURNS public.public_bids
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.auction_settings;
  current_top numeric;
  prof public.profiles;
  inserted public.bids;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE user_id = auth.uid();
  IF prof.id IS NULL THEN RAISE EXCEPTION 'Profile required before bidding'; END IF;
  IF prof.user_id <> auth.uid() THEN RAISE EXCEPTION 'Profile ownership mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.bids
    WHERE profile_id = prof.id AND created_at > now() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'Please wait before placing another bid';
  END IF;
  SELECT * INTO s FROM public.auction_settings WHERE id = 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Auction not configured'; END IF;
  IF s.is_manually_ended THEN RAISE EXCEPTION 'Auction has ended'; END IF;
  IF now() < s.start_time THEN RAISE EXCEPTION 'Auction has not started yet'; END IF;
  IF now() > s.end_time THEN RAISE EXCEPTION 'Auction has ended'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid bid amount'; END IF;
  SELECT COALESCE(MAX(amount), 0) INTO current_top FROM public.bids;
  IF _amount <= GREATEST(current_top, s.starting_bid - 0.01) THEN
    RAISE EXCEPTION 'Bid must be higher than $%', GREATEST(current_top, s.starting_bid);
  END IF;
  INSERT INTO public.bids (display_name, country, amount, profile_id)
  VALUES (prof.display_name, prof.country, _amount, prof.id)
  RETURNING * INTO inserted;
  RETURN ROW(inserted.id, inserted.display_name, inserted.country, inserted.amount, inserted.is_winner, inserted.created_at, inserted.profile_id)::public.public_bids;
END;
$$;
GRANT EXECUTE ON FUNCTION public.place_bid(numeric) TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert bids" ON public.bids;
DROP POLICY IF EXISTS "Only authenticated users with profiles can insert bids via function" ON public.bids;
CREATE POLICY "Only authenticated users with profiles can insert bids via function"
ON public.bids FOR INSERT TO authenticated
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- SECURITY FIX 4: ensure get_public_auction_settings excludes reserve_price; revoke direct access
CREATE OR REPLACE FUNCTION public.get_public_auction_settings()
RETURNS TABLE (
  id integer, start_time timestamptz, end_time timestamptz, starting_bid numeric,
  app_name text, tagline text, description text, hero_image_url text, demo_video_url text,
  perks jsonb, tech_stack jsonb, features jsonb, includes jsonb,
  is_manually_ended boolean, winner_announced boolean, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, start_time, end_time, starting_bid, app_name, tagline, description,
    hero_image_url, demo_video_url, perks, tech_stack, features, includes,
    is_manually_ended, winner_announced, updated_at
  FROM public.auction_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_auction_settings() TO anon, authenticated;

REVOKE SELECT ON public.auction_settings FROM authenticated, anon;
