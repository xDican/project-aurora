-- QA pass found two gaps between what the frontend expects and what got
-- rebuilt in 20260623140100:
--
-- 1. Guests.tsx enforces a 15-minute edit window for receptionists
--    (EDIT_WINDOW_MS = 15 * 60 * 1000), but update_guest_recent() used a
--    guessed 24-hour window. Correct it to match the real frontend constant.
--
-- 2. useReservations.ts catches a Postgres error named
--    "reservations_no_overlap_per_room" to show a "room already booked"
--    message, but that constraint was never recreated - the same room could
--    be double-booked for overlapping dates. Add it back as a GiST exclusion
--    constraint. Cancelled/no-show reservations don't block (they free up
--    the room); booked/checked_in/checked_out do.

CREATE OR REPLACE FUNCTION public.update_guest_recent(
  p_guest_id uuid, p_name text, p_phone text, p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.user_role;
  v_created_at timestamptz;
BEGIN
  v_role := public.current_app_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_role <> 'admin' THEN
    SELECT created_at INTO v_created_at FROM public.guests WHERE id = p_guest_id;
    IF v_created_at IS NULL OR v_created_at < now() - interval '15 minutes' THEN
      RAISE EXCEPTION 'edit window expired';
    END IF;
  END IF;

  UPDATE public.guests
  SET name = p_name, phone = p_phone, email = p_email
  WHERE id = p_guest_id;
END;
$$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap_per_room
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));
