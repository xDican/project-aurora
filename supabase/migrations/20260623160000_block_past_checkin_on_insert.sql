-- QA found: nothing prevents creating a reservation with check_in_date in the
-- past. A plain CHECK constraint would also fire on UPDATE, breaking
-- checkout/cancel/no-show transitions on any reservation whose stay already
-- started (those flows only ever update `status`, never the dates, but a
-- table CHECK re-validates the whole row on every UPDATE regardless). Use an
-- INSERT-only trigger instead.
CREATE OR REPLACE FUNCTION public.reject_past_checkin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.check_in_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'PAST_CHECKIN: check_in_date cannot be in the past';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_reject_past_checkin
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_past_checkin();
