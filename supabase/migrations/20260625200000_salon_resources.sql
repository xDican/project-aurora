-- Replace hardcoded resource columns with a configurable salon_resources table.
-- Each resource type (projector, screen, audio system, chairs, etc.) is now a row
-- managed by the admin from the UI — no code changes needed to add new resource types.

-- New tables
CREATE TABLE public.salon_resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  price       numeric NOT NULL DEFAULT 0,
  quantity    integer NOT NULL DEFAULT 1,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_resources_quantity_check CHECK (quantity >= 1)
);

CREATE TABLE public.salon_reservation_resources (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id     uuid NOT NULL REFERENCES public.salon_reservations(id) ON DELETE CASCADE,
  resource_id        uuid NOT NULL REFERENCES public.salon_resources(id),
  quantity_requested integer NOT NULL DEFAULT 1,
  CONSTRAINT salon_reservation_resources_unique UNIQUE (reservation_id, resource_id),
  CONSTRAINT salon_reservation_resources_qty_check CHECK (quantity_requested >= 1)
);

-- Remove hardcoded resource columns from salon_reservations
ALTER TABLE public.salon_reservations
  DROP COLUMN IF EXISTS includes_projector,
  DROP COLUMN IF EXISTS includes_screen,
  DROP COLUMN IF EXISTS audio_package;

-- Remove hardcoded resource columns from salon_config (keep catering fields)
ALTER TABLE public.salon_config
  DROP COLUMN IF EXISTS projector_price,
  DROP COLUMN IF EXISTS screen_price,
  DROP COLUMN IF EXISTS audio_basic_price,
  DROP COLUMN IF EXISTS audio_complete_price,
  DROP COLUMN IF EXISTS projector_count,
  DROP COLUMN IF EXISTS screen_count,
  DROP COLUMN IF EXISTS audio_count;

-- Simplify space overlap trigger: resource conflicts are now handled by a
-- separate trigger on salon_reservation_resources
CREATE OR REPLACE FUNCTION public.salon_check_slot_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_slot        record;
  v_space_count integer;
BEGIN
  SELECT start_time, end_time INTO v_slot
  FROM public.salon_slots WHERE id = NEW.slot_id;

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

  RETURN NEW;
END;
$$;

-- Generic resource availability trigger on the junction table
CREATE OR REPLACE FUNCTION public.salon_check_resource_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_slot        record;
  v_res_qty     integer;
  v_booked_qty  integer;
  v_res_start   date;
  v_res_end     date;
BEGIN
  -- Time range of the reservation that owns this resource request
  SELECT sr.start_date, sr.end_date, ss.start_time, ss.end_time
  INTO v_res_start, v_res_end, v_slot.start_time, v_slot.end_time
  FROM public.salon_reservations sr
  JOIN public.salon_slots ss ON ss.id = sr.slot_id
  WHERE sr.id = NEW.reservation_id;

  -- Total units of this resource available
  SELECT quantity INTO v_res_qty
  FROM public.salon_resources WHERE id = NEW.resource_id;

  -- Units already committed in overlapping active reservations
  SELECT COALESCE(SUM(srr.quantity_requested), 0) INTO v_booked_qty
  FROM public.salon_reservation_resources srr
  JOIN public.salon_reservations sr  ON sr.id  = srr.reservation_id
  JOIN public.salon_slots         ss ON ss.id = sr.slot_id
  WHERE srr.resource_id = NEW.resource_id
    AND srr.id IS DISTINCT FROM NEW.id
    AND sr.status <> 'cancelled'
    AND sr.start_date <= v_res_end
    AND sr.end_date   >= v_res_start
    AND v_slot.start_time < ss.end_time
    AND v_slot.end_time   > ss.start_time;

  IF v_booked_qty + NEW.quantity_requested > v_res_qty THEN
    -- Include resource id so the client can display the resource name
    RAISE EXCEPTION 'RESOURCE_UNAVAILABLE:%', NEW.resource_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER salon_reservation_resources_check_availability
  BEFORE INSERT OR UPDATE ON public.salon_reservation_resources
  FOR EACH ROW EXECUTE FUNCTION public.salon_check_resource_availability();

-- RLS
ALTER TABLE public.salon_resources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_reservation_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY salon_resources_select       ON public.salon_resources FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_resources_insert_admin ON public.salon_resources FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY salon_resources_update_admin ON public.salon_resources FOR UPDATE USING (public.current_app_role() = 'admin');

CREATE POLICY salon_res_resources_select ON public.salon_reservation_resources FOR SELECT USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_res_resources_insert ON public.salon_reservation_resources FOR INSERT WITH CHECK (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_res_resources_update ON public.salon_reservation_resources FOR UPDATE USING (public.current_app_role() IS NOT NULL);
CREATE POLICY salon_res_resources_delete ON public.salon_reservation_resources FOR DELETE USING (public.current_app_role() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON public.salon_resources             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_reservation_resources TO authenticated;
