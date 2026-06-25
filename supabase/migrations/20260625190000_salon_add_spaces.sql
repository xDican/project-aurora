-- Add salon_spaces and salon_space_rates tables.
-- salon_reservations gets space_id.
-- salon_config gets resource inventory counts.
-- Rewrite overlap trigger to check space conflict + shared resource limits.

CREATE TABLE public.salon_spaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Price per space+slot combination (admin configures)
CREATE TABLE public.salon_space_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES public.salon_spaces(id),
  slot_id       uuid NOT NULL REFERENCES public.salon_slots(id),
  price_per_day numeric NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_space_rates_unique UNIQUE (space_id, slot_id)
);

-- Link reservations to a specific space
ALTER TABLE public.salon_reservations
  ADD COLUMN space_id uuid REFERENCES public.salon_spaces(id);

-- Resource inventory: how many units of each shared resource the property has
ALTER TABLE public.salon_config
  ADD COLUMN projector_count integer NOT NULL DEFAULT 1,
  ADD COLUMN screen_count    integer NOT NULL DEFAULT 1,
  ADD COLUMN audio_count     integer NOT NULL DEFAULT 1;

-- Rewrite overlap trigger to handle two types of conflict:
-- 1. Space conflict: same space, overlapping dates AND overlapping slot times
-- 2. Resource conflict: shared equipment booked beyond available inventory
CREATE OR REPLACE FUNCTION public.salon_check_slot_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_slot         record;
  v_space_count  integer;
  v_res_count    integer;
  v_inventory    integer;
BEGIN
  SELECT start_time, end_time INTO v_slot
  FROM public.salon_slots WHERE id = NEW.slot_id;

  -- 1. Space conflict: same space, overlapping date range, overlapping time slot
  IF NEW.space_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_space_count
    FROM public.salon_reservations sr
    JOIN public.salon_slots ss ON ss.id = sr.slot_id
    WHERE sr.id IS DISTINCT FROM NEW.id
      AND sr.space_id = NEW.space_id
      AND sr.status <> 'cancelled'
      AND sr.start_date <= NEW.end_date
      AND sr.end_date   >= NEW.start_date
      AND v_slot.start_time < ss.end_time
      AND v_slot.end_time   > ss.start_time;

    IF v_space_count > 0 THEN
      RAISE EXCEPTION 'SALON_OVERLAP';
    END IF;
  END IF;

  -- 2. Resource conflicts (shared across all spaces)

  -- Projector
  IF NEW.includes_projector THEN
    SELECT COALESCE(projector_count, 1) INTO v_inventory
    FROM public.salon_config LIMIT 1;
    v_inventory := COALESCE(v_inventory, 1);

    SELECT COUNT(*) INTO v_res_count
    FROM public.salon_reservations sr
    JOIN public.salon_slots ss ON ss.id = sr.slot_id
    WHERE sr.id IS DISTINCT FROM NEW.id
      AND sr.includes_projector = true
      AND sr.status <> 'cancelled'
      AND sr.start_date <= NEW.end_date
      AND sr.end_date   >= NEW.start_date
      AND v_slot.start_time < ss.end_time
      AND v_slot.end_time   > ss.start_time;

    IF v_res_count >= v_inventory THEN
      RAISE EXCEPTION 'PROJECTOR_UNAVAILABLE';
    END IF;
  END IF;

  -- Screen
  IF NEW.includes_screen THEN
    SELECT COALESCE(screen_count, 1) INTO v_inventory
    FROM public.salon_config LIMIT 1;
    v_inventory := COALESCE(v_inventory, 1);

    SELECT COUNT(*) INTO v_res_count
    FROM public.salon_reservations sr
    JOIN public.salon_slots ss ON ss.id = sr.slot_id
    WHERE sr.id IS DISTINCT FROM NEW.id
      AND sr.includes_screen = true
      AND sr.status <> 'cancelled'
      AND sr.start_date <= NEW.end_date
      AND sr.end_date   >= NEW.start_date
      AND v_slot.start_time < ss.end_time
      AND v_slot.end_time   > ss.start_time;

    IF v_res_count >= v_inventory THEN
      RAISE EXCEPTION 'SCREEN_UNAVAILABLE';
    END IF;
  END IF;

  -- Audio (any non-none package counts against the shared audio system)
  IF NEW.audio_package <> 'none' THEN
    SELECT COALESCE(audio_count, 1) INTO v_inventory
    FROM public.salon_config LIMIT 1;
    v_inventory := COALESCE(v_inventory, 1);

    SELECT COUNT(*) INTO v_res_count
    FROM public.salon_reservations sr
    JOIN public.salon_slots ss ON ss.id = sr.slot_id
    WHERE sr.id IS DISTINCT FROM NEW.id
      AND sr.audio_package <> 'none'
      AND sr.status <> 'cancelled'
      AND sr.start_date <= NEW.end_date
      AND sr.end_date   >= NEW.start_date
      AND v_slot.start_time < ss.end_time
      AND v_slot.end_time   > ss.start_time;

    IF v_res_count >= v_inventory THEN
      RAISE EXCEPTION 'AUDIO_UNAVAILABLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- RLS
ALTER TABLE public.salon_spaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_space_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY salon_spaces_select       ON public.salon_spaces FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_spaces_insert_admin ON public.salon_spaces FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_spaces_update_admin ON public.salon_spaces FOR UPDATE USING (public.current_app_role() = 'admin');

CREATE POLICY salon_space_rates_select       ON public.salon_space_rates FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_space_rates_insert_admin ON public.salon_space_rates FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_space_rates_update_admin ON public.salon_space_rates FOR UPDATE USING (public.current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE ON public.salon_spaces      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.salon_space_rates TO authenticated;
