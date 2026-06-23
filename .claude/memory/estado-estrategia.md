# Estado Estrategia — Aurora

## Dashboard (2026-06-23, fin de sesión)
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
- **Recomendación dada al founder:** que Eliza opere el hotel con Aurora de forma real
  (no datos de prueba) sin supervisión directa por ~2 semanas — primera señal de uso real,
  no familiar/asistido. Sin fecha de inicio confirmada todavía.
- Empezar a identificar (aunque sea informalmente) un segundo alojamiento con el mismo
  problema de papel/Excel, para tener un segundo data point fuera del círculo familiar.
- QA manual pendiente: el founder tiene una guía actualizada de 7 fases para correr después
  de recrear habitaciones/tarifas de prueba (la base quedó vacía a propósito).
