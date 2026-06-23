-- The initial report_* functions had no server-side role check - only the
-- React route (/reportes) restricted access to admin. Since these are exposed
-- as public RPC endpoints, anyone with the published anon key could call them
-- directly and read revenue/reservation data without logging in. Add the
-- missing admin check inside each function to match the intended access level.

CREATE OR REPLACE FUNCTION public.report_kpis(p_start date, p_end date)
RETURNS TABLE(
  total_reservas_activas integer,
  total_canceladas integer,
  total_no_show integer,
  ingresos_estimados numeric
)
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
    COUNT(*) FILTER (WHERE status IN ('booked','checked_in','checked_out'))::int,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int,
    COUNT(*) FILTER (WHERE status = 'no_show')::int,
    COALESCE(SUM(final_price) FILTER (WHERE status IN ('booked','checked_in','checked_out')), 0)
  FROM public.reservations
  WHERE check_in_date >= p_start AND check_in_date <= p_end;
END;
$$;

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
    r.id,
    rm.number,
    g.name,
    r.check_in_date,
    r.check_out_date,
    r.status,
    r.final_price,
    rr.occupancy::text
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
END;
$$;

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
  ORDER BY d.day;
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
  ORDER BY d;
END;
$$;

-- Defense in depth: Postgres grants EXECUTE to PUBLIC by default on function
-- creation. Revoke that and keep EXECUTE scoped to authenticated only
-- (current_app_role() handles the actual admin/receptionist split inside
-- each function).
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.archive_guest(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unarchive_guest(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.archive_room(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unarchive_room(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_room_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_guest_recent(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_kpis(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_reservations(date, date, text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_occupancy_daily(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_revenue_daily(date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_guest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_guest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_guest_recent(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_kpis(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_reservations(date, date, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_occupancy_daily(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_revenue_daily(date, date) TO authenticated;
