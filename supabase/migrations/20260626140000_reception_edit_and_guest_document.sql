-- Fix: update_guest_recent no actualizaba document; alinear ventana a 15 min.
-- Nuevo: update_company_recent para que recepcion edite empresas (ventana 15 min).

DROP FUNCTION IF EXISTS public.update_guest_recent(uuid, text, text, text, uuid);
CREATE OR REPLACE FUNCTION public.update_guest_recent(
  p_guest_id uuid, p_name text, p_phone text, p_email text,
  p_document text DEFAULT NULL, p_company_id uuid DEFAULT NULL
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
  SET name = p_name, phone = p_phone, email = p_email,
      document = p_document, company_id = p_company_id
  WHERE id = p_guest_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_guest_recent(uuid, text, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_company_recent(
  p_company_id uuid, p_name text, p_rtn text,
  p_phone text DEFAULT NULL, p_email text DEFAULT NULL, p_address text DEFAULT NULL
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
    SELECT created_at INTO v_created_at FROM public.companies WHERE id = p_company_id;
    IF v_created_at IS NULL OR v_created_at < now() - interval '15 minutes' THEN
      RAISE EXCEPTION 'edit window expired';
    END IF;
  END IF;

  UPDATE public.companies
  SET name = p_name, rtn = p_rtn, phone = p_phone, email = p_email, address = p_address
  WHERE id = p_company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_company_recent(uuid, text, text, text, text, text) TO authenticated;
