ALTER TABLE public.app_media ADD COLUMN IF NOT EXISTS instagram_url text;

REVOKE ALL ON public.bids FROM anon, authenticated;
GRANT SELECT (id, display_name, country, amount, is_winner, created_at, profile_id)
  ON public.bids TO anon, authenticated;
GRANT ALL ON public.bids TO service_role;

DROP FUNCTION IF EXISTS public.place_bid(numeric) CASCADE;
DROP VIEW IF EXISTS public.public_bids CASCADE;

CREATE VIEW public.public_bids
WITH (security_invoker = true, security_barrier = true)
AS
  SELECT id, display_name, country, amount, is_winner, created_at, profile_id
  FROM public.bids;
GRANT SELECT ON public.public_bids TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_bid(_amount numeric)
 RETURNS public.public_bids
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

DROP POLICY IF EXISTS "Anyone can insert roles" ON public.user_roles;