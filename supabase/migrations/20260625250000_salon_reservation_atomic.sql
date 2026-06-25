-- Creación/edición atómica de reservas de salón.
-- Antes el cliente insertaba reserva y recursos en pasos separados sin transacción.
-- Si un recurso fallaba (RESOURCE_UNAVAILABLE), el rollback por DELETE quedaba
-- bloqueado por RLS (no hay policy DELETE en salon_reservations) y la reserva
-- quedaba huérfana. Estas funciones lo hacen en una sola transacción: los triggers
-- siguen disparando y, ante cualquier error, todo se revierte.

CREATE OR REPLACE FUNCTION public.create_salon_reservation(
  p_guest_id       uuid,
  p_space_id       uuid,
  p_slot_id        uuid,
  p_start_date     date,
  p_end_date       date,
  p_attendees      integer,
  p_menu_id        uuid,
  p_coffee_station boolean,
  p_coffee_cookies boolean,
  p_base_price     numeric,
  p_addons_price   numeric,
  p_final_price    numeric,
  p_notes          text,
  p_resources      jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF current_app_role() IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  INSERT INTO salon_reservations (
    guest_id, space_id, slot_id, start_date, end_date, attendees,
    menu_id, coffee_station, coffee_cookies, base_price, addons_price, final_price, notes
  ) VALUES (
    p_guest_id, p_space_id, p_slot_id, p_start_date, p_end_date, p_attendees,
    p_menu_id, p_coffee_station, p_coffee_cookies, p_base_price, p_addons_price, p_final_price, p_notes
  )
  RETURNING id INTO v_id;

  INSERT INTO salon_reservation_resources (reservation_id, resource_id, quantity_requested)
  SELECT v_id, (elem->>'resourceId')::uuid, (elem->>'quantityRequested')::integer
  FROM jsonb_array_elements(p_resources) AS elem;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_salon_reservation(
  p_id             uuid,
  p_guest_id       uuid,
  p_space_id       uuid,
  p_slot_id        uuid,
  p_start_date     date,
  p_end_date       date,
  p_attendees      integer,
  p_menu_id        uuid,
  p_coffee_station boolean,
  p_coffee_cookies boolean,
  p_base_price     numeric,
  p_addons_price   numeric,
  p_final_price    numeric,
  p_notes          text,
  p_resources      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF current_app_role() IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT status INTO v_status FROM salon_reservations WHERE id = p_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_status <> 'booked' THEN
    RAISE EXCEPTION 'NOT_EDITABLE';
  END IF;

  UPDATE salon_reservations SET
    guest_id       = p_guest_id,
    space_id       = p_space_id,
    slot_id        = p_slot_id,
    start_date     = p_start_date,
    end_date       = p_end_date,
    attendees      = p_attendees,
    menu_id        = p_menu_id,
    coffee_station = p_coffee_station,
    coffee_cookies = p_coffee_cookies,
    base_price     = p_base_price,
    addons_price   = p_addons_price,
    final_price    = p_final_price,
    notes          = p_notes
  WHERE id = p_id;

  DELETE FROM salon_reservation_resources WHERE reservation_id = p_id;

  INSERT INTO salon_reservation_resources (reservation_id, resource_id, quantity_requested)
  SELECT p_id, (elem->>'resourceId')::uuid, (elem->>'quantityRequested')::integer
  FROM jsonb_array_elements(p_resources) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.create_salon_reservation(uuid, uuid, uuid, date, date, integer, uuid, boolean, boolean, numeric, numeric, numeric, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_salon_reservation(uuid, uuid, uuid, uuid, date, date, integer, uuid, boolean, boolean, numeric, numeric, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_salon_reservation(uuid, uuid, uuid, date, date, integer, uuid, boolean, boolean, numeric, numeric, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_salon_reservation(uuid, uuid, uuid, uuid, date, date, integer, uuid, boolean, boolean, numeric, numeric, numeric, text, jsonb) TO authenticated;
