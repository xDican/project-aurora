-- Empresas (clientes corporativos): entidad + linkage a huesped + snapshot en reservas

-- 1. Tabla companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rtn text NOT NULL,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_rtn_digits CHECK (rtn ~ '^[0-9]{14}$')
);

-- RTN unico solo entre empresas activas (archivar libera el RTN para recrear/reactivar)
CREATE UNIQUE INDEX companies_rtn_active_unique ON public.companies (rtn) WHERE is_active;

-- 2. Linkage a huesped y a reservas (snapshot)
ALTER TABLE public.guests ADD COLUMN company_id uuid REFERENCES public.companies(id);
CREATE INDEX guests_company_id_idx ON public.guests (company_id);

ALTER TABLE public.reservations ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.salon_reservations ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- 3. Trigger de snapshot: congela la empresa del huesped al crear la reserva
CREATE OR REPLACE FUNCTION public.set_reservation_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.guests WHERE id = NEW.guest_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservations_set_company
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_reservation_company();

CREATE TRIGGER trg_salon_reservations_set_company
  BEFORE INSERT ON public.salon_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_reservation_company();

-- 4. Archivar / desarchivar (admin only) - espejo de archive_guest
CREATE OR REPLACE FUNCTION public.archive_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.companies SET is_active = false, archived_at = now() WHERE id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unarchive_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.companies SET is_active = true, archived_at = NULL WHERE id = p_company_id;
END;
$$;

-- 5. Extender update_guest_recent con p_company_id (asignar empresa al editar)
DROP FUNCTION IF EXISTS public.update_guest_recent(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.update_guest_recent(
  p_guest_id uuid, p_name text, p_phone text, p_email text, p_company_id uuid DEFAULT NULL
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
  SET name = p_name, phone = p_phone, email = p_email, company_id = p_company_id
  WHERE id = p_guest_id;
END;
$$;

-- 6. RLS + grants para companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select_authenticated ON public.companies FOR SELECT
  USING (public.current_app_role() IS NOT NULL);
CREATE POLICY companies_insert_authenticated ON public.companies FOR INSERT
  WITH CHECK (public.current_app_role() IS NOT NULL);
CREATE POLICY companies_update_admin ON public.companies FOR UPDATE
  USING (public.current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_guest_recent(uuid, text, text, text, uuid) TO authenticated;
