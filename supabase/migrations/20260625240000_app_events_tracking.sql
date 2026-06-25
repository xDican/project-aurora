-- Tracking básico de uso: registra qué página visita cada usuario autenticado.
-- Append-only. Inserción solo vía función SECURITY DEFINER (user_id/role derivados
-- del servidor, no del cliente). Lectura solo admin.

CREATE TABLE public.app_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       public.user_role NOT NULL,
  path       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_events_created_at_idx ON public.app_events (created_at);
CREATE INDEX app_events_path_idx       ON public.app_events (path);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Sin policy de INSERT: las inserciones pasan por log_app_event (SECURITY DEFINER).
CREATE POLICY app_events_select_admin ON public.app_events
  FOR SELECT USING (public.current_app_role() = 'admin');

CREATE OR REPLACE FUNCTION public.log_app_event(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role    public.user_role;
BEGIN
  SELECT id, role INTO v_user_id, v_role
  FROM public.users
  WHERE auth_user_id = auth.uid();

  -- Sin fila en public.users (sesión no válida): no registrar.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.app_events (user_id, role, path)
  VALUES (v_user_id, v_role, p_path);
END;
$$;

REVOKE ALL ON FUNCTION public.log_app_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_app_event(text) TO authenticated;
