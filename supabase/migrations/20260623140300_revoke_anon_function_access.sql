-- Supabase grants EXECUTE to the `anon` role automatically (via default
-- privileges) when a function is created in the public schema, separate from
-- the PUBLIC pseudo-role. Revoking from PUBLIC alone left anon still able to
-- call every RPC, including the admin-only report functions and the
-- archive/status RPCs, without authenticating. Revoke explicitly from anon.
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_guest(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unarchive_guest(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unarchive_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_room_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_guest_recent(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_kpis(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_reservations(date, date, text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_occupancy_daily(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_revenue_daily(date, date) FROM anon;

-- Same default-grant behavior applies to tables: lock down direct anon access
-- as defense in depth alongside RLS.
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.guests FROM anon;
REVOKE ALL ON public.rooms FROM anon;
REVOKE ALL ON public.room_rates FROM anon;
REVOKE ALL ON public.reservations FROM anon;
