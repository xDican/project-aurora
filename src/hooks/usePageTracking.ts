import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra la página visitada en cada cambio de ruta (fire-and-forget).
 * La función `log_app_event` deriva el usuario del servidor y no registra nada
 * si no hay sesión válida, así que es seguro llamarla siempre. Cualquier error
 * se ignora: el tracking nunca debe afectar la navegación.
 */
export function usePageTracking() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void supabase.rpc("log_app_event", { p_path: pathname }).then(({ error }) => {
      if (error) console.debug("page tracking failed", error.message);
    });
  }, [pathname]);
}
