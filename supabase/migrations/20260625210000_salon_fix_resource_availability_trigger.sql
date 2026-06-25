-- Fix salon_check_resource_availability: it selected into fields of an unassigned
-- record variable (v_slot.start_time / v_slot.end_time), which raises
-- "record v_slot is not assigned yet" (SQLSTATE 55000) on every resource insert.
-- Replace the record with scalar time variables. The bug was latent because the
-- resource-booking UI didn't exist until now.
CREATE OR REPLACE FUNCTION public.salon_check_resource_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_slot_start  time;
  v_slot_end    time;
  v_res_qty     integer;
  v_booked_qty  integer;
  v_res_start   date;
  v_res_end     date;
BEGIN
  -- Time range of the reservation that owns this resource request
  SELECT sr.start_date, sr.end_date, ss.start_time, ss.end_time
  INTO v_res_start, v_res_end, v_slot_start, v_slot_end
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
    AND v_slot_start < ss.end_time
    AND v_slot_end   > ss.start_time;

  IF v_booked_qty + NEW.quantity_requested > v_res_qty THEN
    RAISE EXCEPTION 'RESOURCE_UNAVAILABLE:%', NEW.resource_id;
  END IF;

  RETURN NEW;
END;
$$;
