-- Role helper (SECURITY DEFINER avoids recursive RLS lookups on users)
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- Archive / unarchive (admin only)
CREATE OR REPLACE FUNCTION public.archive_guest(p_guest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.guests SET is_active = false, archived_at = now() WHERE id = p_guest_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unarchive_guest(p_guest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.guests SET is_active = true, archived_at = NULL WHERE id = p_guest_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.rooms SET is_active = false, archived_at = now() WHERE id = p_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unarchive_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.rooms SET is_active = true, archived_at = NULL WHERE id = p_room_id;
END;
$$;

-- Set room status (admin + receptionist, any authenticated app user)
CREATE OR REPLACE FUNCTION public.set_room_status(p_room_id uuid, p_status text, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS NULL THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.rooms
  SET status = p_status,
      notes = COALESCE(p_notes, notes)
  WHERE id = p_room_id;
END;
$$;

-- Update guest "recent": admin always, receptionist only within 24h of creation
-- NOTE: the 24h window is an assumption (the original rule lived only in the
-- deleted Supabase project and could not be recovered) - adjust if the real
-- rule was different.
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
    IF v_created_at IS NULL OR v_created_at < now() - interval '24 hours' THEN
      RAISE EXCEPTION 'edit window expired';
    END IF;
  END IF;

  UPDATE public.guests
  SET name = p_name, phone = p_phone, email = p_email
  WHERE id = p_guest_id;
END;
$$;

-- Reports (initial version - superseded by 20260623140200, kept for history)
CREATE OR REPLACE FUNCTION public.report_kpis(p_start date, p_end date)
RETURNS TABLE(
  total_reservas_activas integer,
  total_canceladas integer,
  total_no_show integer,
  ingresos_estimados numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status IN ('booked','checked_in','checked_out'))::int AS total_reservas_activas,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int AS total_canceladas,
    COUNT(*) FILTER (WHERE status = 'no_show')::int AS total_no_show,
    COALESCE(SUM(final_price) FILTER (WHERE status IN ('booked','checked_in','checked_out')), 0) AS ingresos_estimados
  FROM public.reservations
  WHERE check_in_date >= p_start AND check_in_date <= p_end;
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

CREATE OR REPLACE FUNCTION public.report_occupancy_daily(p_start date, p_end date)
RETURNS TABLE(day date, occupied_rooms integer, total_rooms integer, occupancy_pct numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH days AS (
    SELECT generate_series(p_start, p_end, interval '1 day')::date AS day
  ),
  total AS (
    SELECT COUNT(*)::int AS total_rooms FROM public.rooms WHERE is_active = true
  )
  SELECT
    d.day,
    COUNT(DISTINCT r.room_id)::int AS occupied_rooms,
    t.total_rooms,
    CASE WHEN t.total_rooms = 0 THEN 0
         ELSE ROUND(COUNT(DISTINCT r.room_id)::numeric / t.total_rooms * 100, 2)
    END AS occupancy_pct
  FROM days d
  CROSS JOIN total t
  LEFT JOIN public.reservations r
    ON r.check_in_date <= d.day AND r.check_out_date > d.day
    AND r.status NOT IN ('cancelled','no_show')
  GROUP BY d.day, t.total_rooms
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.report_revenue_daily(p_start date, p_end date)
RETURNS TABLE(day date, revenue numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    d::date AS day,
    COALESCE(SUM(r.final_price) FILTER (WHERE r.status IN ('booked','checked_in','checked_out')), 0) AS revenue
  FROM generate_series(p_start, p_end, interval '1 day') AS d
  LEFT JOIN public.reservations r ON r.check_in_date = d::date
  GROUP BY d
  ORDER BY d;
$$;

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT
  USING (auth_user_id = auth.uid());
CREATE POLICY users_insert_own ON public.users FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY guests_select_authenticated ON public.guests FOR SELECT
  USING (public.current_app_role() IS NOT NULL);
CREATE POLICY guests_insert_authenticated ON public.guests FOR INSERT
  WITH CHECK (public.current_app_role() IS NOT NULL);
CREATE POLICY guests_update_admin ON public.guests FOR UPDATE
  USING (public.current_app_role() = 'admin');

CREATE POLICY rooms_select_authenticated ON public.rooms FOR SELECT
  USING (public.current_app_role() IS NOT NULL);
CREATE POLICY rooms_insert_admin ON public.rooms FOR INSERT
  WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY rooms_update_admin ON public.rooms FOR UPDATE
  USING (public.current_app_role() = 'admin');

CREATE POLICY room_rates_select_authenticated ON public.room_rates FOR SELECT
  USING (public.current_app_role() IS NOT NULL);
CREATE POLICY room_rates_insert_admin ON public.room_rates FOR INSERT
  WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY room_rates_update_admin ON public.room_rates FOR UPDATE
  USING (public.current_app_role() = 'admin');

CREATE POLICY reservations_select_authenticated ON public.reservations FOR SELECT
  USING (public.current_app_role() IS NOT NULL);
CREATE POLICY reservations_insert_authenticated ON public.reservations FOR INSERT
  WITH CHECK (public.current_app_role() IS NOT NULL);
CREATE POLICY reservations_update_authenticated ON public.reservations FOR UPDATE
  USING (public.current_app_role() IS NOT NULL);

-- Grants
GRANT SELECT, INSERT ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.guests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.room_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reservations TO authenticated;

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
