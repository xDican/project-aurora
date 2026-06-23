-- User requested reports be sorted with the most recent date first (most
-- recent at top, older below). report_reservations already does this
-- (ORDER BY check_in_date DESC); occupancy and revenue were ascending.
CREATE OR REPLACE FUNCTION public.report_occupancy_daily(p_start date, p_end date)
RETURNS TABLE(day date, occupied_rooms integer, total_rooms integer, occupancy_pct numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start, p_end, interval '1 day')::date AS day
  ),
  total AS (
    SELECT COUNT(*)::int AS total_rooms FROM public.rooms WHERE is_active = true
  )
  SELECT
    d.day,
    COUNT(DISTINCT r.room_id)::int,
    t.total_rooms,
    CASE WHEN t.total_rooms = 0 THEN 0
         ELSE ROUND(COUNT(DISTINCT r.room_id)::numeric / t.total_rooms * 100, 2)
    END
  FROM days d
  CROSS JOIN total t
  LEFT JOIN public.reservations r
    ON r.check_in_date <= d.day AND r.check_out_date > d.day
    AND r.status NOT IN ('cancelled','no_show')
  GROUP BY d.day, t.total_rooms
  ORDER BY d.day DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_revenue_daily(p_start date, p_end date)
RETURNS TABLE(day date, revenue numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT
    d::date,
    COALESCE(SUM(r.final_price) FILTER (WHERE r.status IN ('booked','checked_in','checked_out')), 0)
  FROM generate_series(p_start, p_end, interval '1 day') AS d
  LEFT JOIN public.reservations r ON r.check_in_date = d::date
  GROUP BY d
  ORDER BY d DESC;
END;
$$;
