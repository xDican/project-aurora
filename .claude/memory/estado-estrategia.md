# Estado Estrategia — Aurora

## Dashboard (2026-06-23, QA aprobado)
- Clientes pagantes: 0
- Pilotos activos: 1 (Hotel Pinares, hermana del founder)
- Pipeline fuera del piloto: 0
- Infra: Supabase `aurora-v2` (us-east-1). Base de datos reseteada a cero al final de esta
  sesión (solo quedan las 2 cuentas de usuario) para arrancar el próximo ciclo de QA limpio.
- Producto: las 7 pantallas (Hoy, Disponibilidad, Reservas, Mapa, Habitaciones, Huéspedes,
  Reportes) están rediseñadas visualmente (paleta/tipografía/iconos nuevos vía mockups de
  Stitch) y funcionalmente más completas que al inicio de la sesión.

## Decisiones y trabajo de esta sesión
- **Reconstrucción completa de BD** tras la pérdida del proyecto original (>90 días pausado).
  Esquema, 11 funciones, RLS reconstruidos desde `types.ts` + uso real del frontend.
- **Feature nueva:** editar reserva existente (habitación/fechas/ocupación) sin cancelar y
  recrear — pedido directo de Eliza, antes ensuciaba el reporte de cancelaciones.
- **Cambio de flujo de reservar:** ahora es fecha → ocupación → habitación (antes era al
  revés). Pedido explícito del founder, aplica a los 2 puntos de entrada (Disponibilidad y
  Reservas) porque comparten el mismo formulario.
- **Rediseño visual completo** de las 7 pantallas vía mockups generados con Google Stitch,
  preservando toda la lógica real y descartando explícitamente datos inventados por los
  mockups que no existen en el modelo real (números de referencia, capacidad de personas,
  paginación falsa, deltas de KPI inventados).
- Bugs reales encontrados y corregidos vía uso real (no QA sintético): RLS bloqueaba
  check-in/check-out/limpiar-habitación para recepcionista; corrimiento de un día en fechas
  de Reportes por parseo sin timezone; etiqueta de tamaño en Disponibilidad desincronizada
  del filtro realmente buscado.

## Riesgos activos
1. **Validación de mercado sigue en cero.** Ningún trabajo de esta sesión fue de producto,
   no de mercado — sigue siendo el riesgo #1, sin cambios.
2. **Aislamiento multi-tenant no resuelto** — solo importa si aparece un 2do cliente real.

## Próximos pasos
- **QA manual de las 7 fases: aprobado por el founder (2026-06-23).** El producto pasó su
  propia revisión; ya no es el bloqueante.
- **Esperando ahora:** feedback de Eliza usando Aurora para operar el hotel de verdad. Esto
  es la señal real pendiente — todavía no llegó. No confundir "QA aprobado por el founder"
  con "validado por el piloto"; son cosas distintas y solo la segunda mueve el riesgo de
  mercado.
- Sigue pendiente, sin fecha: que Eliza opere sin supervisión directa por ~2 semanas como
  primera señal de uso real no asistido.
- Sigue pendiente, sin fecha: identificar informalmente un segundo alojamiento con el mismo
  problema de papel/Excel, como segundo data point fuera del círculo familiar.
