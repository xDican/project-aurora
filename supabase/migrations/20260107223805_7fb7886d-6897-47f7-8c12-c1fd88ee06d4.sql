CREATE OR REPLACE FUNCTION public.report_reservations(
  p_start date,
  p_end date,
  p_status text DEFAULT NULL,
  p_room_id uuid DEFAULT NULL,
  p_guest_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  room_number text,
  guest_name text,
  check_in_date date,
  check_out_date date,
  status text,
  final_price numeric,
  occupancy text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    rm.number as room_number,
    g.name as guest_name,
    r.check_in_date,
    r.check_out_date,
    r.status,
    r.final_price,
    rr.occupancy::text as occupancy
  FROM public.reservations r
  JOIN public.rooms rm ON rm.id = r.room_id
  JOIN public.guests g ON g.id = r.guest_id
  LEFT JOIN public.room_rates rr ON rr.id = r.room_rate_id
  WHERE r.check_in_date >= p_start
    AND r.check_in_date <= p_end
    AND (p_status IS NULL OR r.status = p_status)
    AND (p_room_id IS NULL OR r.room_id = p_room_id)
    AND (p_guest_id IS NULL OR r.guest_id = p_guest_id)
  ORDER BY r.check_in_date DESC;
$$;