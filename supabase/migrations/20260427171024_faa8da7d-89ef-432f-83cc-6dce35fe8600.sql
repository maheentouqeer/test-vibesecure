
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auction settings
CREATE TABLE public.auction_settings (
  id int PRIMARY KEY CHECK (id = 1),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  starting_bid numeric NOT NULL DEFAULT 2000,
  reserve_price numeric NOT NULL DEFAULT 4000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_settings ENABLE ROW LEVEL SECURITY;

-- Public can read everything except reserve_price (handled via view)
CREATE POLICY "Anyone can view auction settings" ON public.auction_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update auction settings" ON public.auction_settings
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert auction settings" ON public.auction_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.auction_settings (id, start_time, end_time, starting_bid, reserve_price)
VALUES (1, now() + interval '24 hours', now() + interval '72 hours', 2000, 4000);

-- Bids
CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  country text NOT NULL CHECK (char_length(country) BETWEEN 1 AND 80),
  amount numeric NOT NULL CHECK (amount > 0),
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Admins can view full bid records (including email)
CREATE POLICY "Admins can view all bids" ON public.bids
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bids" ON public.bids
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public-safe view that hides email
CREATE VIEW public.public_bids
WITH (security_invoker = true)
AS
SELECT id, display_name, country, amount, is_winner, created_at
FROM public.bids;

GRANT SELECT ON public.public_bids TO anon, authenticated;

-- Validating insert function (anyone can call) — enforces window + amount > current top
CREATE OR REPLACE FUNCTION public.place_bid(
  _display_name text,
  _email text,
  _country text,
  _amount numeric
) RETURNS public.public_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.auction_settings;
  current_top numeric;
  inserted public.bids;
BEGIN
  SELECT * INTO s FROM public.auction_settings WHERE id = 1;
  IF s IS NULL THEN
    RAISE EXCEPTION 'Auction not configured';
  END IF;
  IF now() < s.start_time THEN
    RAISE EXCEPTION 'Auction has not started yet';
  END IF;
  IF now() > s.end_time THEN
    RAISE EXCEPTION 'Auction has ended';
  END IF;

  -- Validate inputs
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
$$;

GRANT EXECUTE ON FUNCTION public.place_bid(text, text, text, numeric) TO anon, authenticated;

-- Realtime
ALTER TABLE public.bids REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_settings;

-- Auto-create user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
