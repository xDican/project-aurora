-- Salon module: slots, menus, config, reservations + overlap trigger + RLS

-- Configurable time slots (admin manages)
CREATE TABLE public.salon_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  price_per_day numeric NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_slots_valid_time CHECK (end_time > start_time)
);

-- Menu packages with configurable name and price (admin manages)
CREATE TABLE public.salon_menus (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  price_per_person numeric NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Add-on prices (single logical row, admin configures)
CREATE TABLE public.salon_config (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projector_price         numeric NOT NULL DEFAULT 0,
  screen_price            numeric NOT NULL DEFAULT 0,
  audio_basic_price       numeric NOT NULL DEFAULT 0,
  audio_complete_price    numeric NOT NULL DEFAULT 0,
  coffee_price_per_person numeric NOT NULL DEFAULT 0,
  coffee_min_attendees    integer NOT NULL DEFAULT 30,
  cookies_price           numeric NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Salon reservations
CREATE TABLE public.salon_reservations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id           uuid NOT NULL,
  slot_id            uuid NOT NULL,
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  status             text NOT NULL DEFAULT 'booked',
  attendees          integer,
  includes_projector boolean NOT NULL DEFAULT false,
  includes_screen    boolean NOT NULL DEFAULT false,
  audio_package      text NOT NULL DEFAULT 'none',
  menu_id            uuid,
  coffee_station     boolean NOT NULL DEFAULT false,
  coffee_cookies     boolean NOT NULL DEFAULT false,
  base_price         numeric NOT NULL DEFAULT 0,
  addons_price       numeric NOT NULL DEFAULT 0,
  discount           numeric NOT NULL DEFAULT 0,
  final_price        numeric NOT NULL DEFAULT 0,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_reservations_guest_fk        FOREIGN KEY (guest_id) REFERENCES public.guests(id),
  CONSTRAINT salon_reservations_slot_fk         FOREIGN KEY (slot_id) REFERENCES public.salon_slots(id),
  CONSTRAINT salon_reservations_menu_fk         FOREIGN KEY (menu_id) REFERENCES public.salon_menus(id),
  CONSTRAINT salon_reservations_dates_check     CHECK (end_date >= start_date),
  CONSTRAINT salon_reservations_status_check    CHECK (status IN ('booked', 'done', 'cancelled')),
  CONSTRAINT salon_reservations_audio_check     CHECK (audio_package IN ('none', 'basic', 'complete')),
  CONSTRAINT salon_reservations_discount_check  CHECK (discount >= 0 AND discount <= 100),
  CONSTRAINT salon_reservations_attendees_check CHECK (attendees IS NULL OR attendees > 0)
);

-- Overlap check via trigger (can't use GiST EXCLUDE because conflict depends on
-- the time ranges of both slots, which requires a JOIN to salon_slots)
CREATE OR REPLACE FUNCTION public.salon_check_slot_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_new_slot  record;
  v_conflicts integer;
BEGIN
  SELECT start_time, end_time INTO v_new_slot
  FROM public.salon_slots WHERE id = NEW.slot_id;

  SELECT COUNT(*) INTO v_conflicts
  FROM public.salon_reservations sr
  JOIN public.salon_slots ss ON ss.id = sr.slot_id
  WHERE sr.id IS DISTINCT FROM NEW.id
    AND sr.status <> 'cancelled'
    AND sr.start_date <= NEW.end_date
    AND sr.end_date   >= NEW.start_date
    AND v_new_slot.start_time < ss.end_time
    AND v_new_slot.end_time   > ss.start_time;

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'SALON_OVERLAP';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER salon_reservations_check_overlap
  BEFORE INSERT OR UPDATE ON public.salon_reservations
  FOR EACH ROW EXECUTE FUNCTION public.salon_check_slot_overlap();

-- Discount is admin-only: protected via SECURITY DEFINER function,
-- same pattern as archive_guest — column-level RLS isn't available in Supabase
CREATE OR REPLACE FUNCTION public.apply_salon_discount(
  p_reservation_id uuid,
  p_discount       numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_discount < 0 OR p_discount > 100 THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT';
  END IF;
  UPDATE public.salon_reservations
  SET discount    = p_discount,
      final_price = ROUND((base_price + addons_price) * (1 - p_discount / 100.0), 2)
  WHERE id = p_reservation_id AND status = 'booked';
END;
$$;

-- RLS
ALTER TABLE public.salon_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_menus        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY salon_slots_select       ON public.salon_slots FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_slots_insert_admin ON public.salon_slots FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_slots_update_admin ON public.salon_slots FOR UPDATE USING (public.current_app_role() = 'admin');

CREATE POLICY salon_menus_select       ON public.salon_menus FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_menus_insert_admin ON public.salon_menus FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_menus_update_admin ON public.salon_menus FOR UPDATE USING (public.current_app_role() = 'admin');

CREATE POLICY salon_config_select       ON public.salon_config FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_config_insert_admin ON public.salon_config FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_config_update_admin ON public.salon_config FOR UPDATE USING (public.current_app_role() = 'admin');

CREATE POLICY salon_reservations_select ON public.salon_reservations FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_reservations_insert ON public.salon_reservations FOR INSERT WITH CHECK (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_reservations_update ON public.salon_reservations FOR UPDATE USING (public.current_app_role() IS NOT NULL);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.salon_slots        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.salon_menus        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.salon_config       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.salon_reservations TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_salon_discount(uuid, numeric) TO authenticated;
