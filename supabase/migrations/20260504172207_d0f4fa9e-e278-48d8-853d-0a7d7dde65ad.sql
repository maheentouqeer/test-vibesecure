
DROP FUNCTION IF EXISTS public.place_bid(numeric) CASCADE;
DROP VIEW IF EXISTS public.public_bids CASCADE;

ALTER TABLE public.bids DROP COLUMN IF EXISTS email;

CREATE VIEW public.public_bids
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, display_name, country, amount, is_winner, created_at, profile_id
FROM public.bids;

GRANT SELECT ON public.public_bids TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view non-email bid columns" ON public.bids;
CREATE POLICY "Anyone can view bid rows"
ON public.bids FOR SELECT TO anon, authenticated USING (true);

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

-- auction_settings: restrict SELECT to admins, expose safe cols via SECURITY DEFINER fn
DROP POLICY IF EXISTS "Anyone can view auction settings" ON public.auction_settings;
DROP POLICY IF EXISTS "Admins can view auction settings" ON public.auction_settings;
CREATE POLICY "Admins can view auction settings"
ON public.auction_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

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

-- Remove auction_settings from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.auction_settings;

-- Drop public listing policies on storage.objects
DROP POLICY IF EXISTS "Public can view auction media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view app images" ON storage.objects;
