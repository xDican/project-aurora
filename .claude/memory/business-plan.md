# Business Plan — Aurora

## Qué es
Aurora es un PMS (sistema de gestión de propiedades/reservas) tipo SaaS para alojamientos
(hostels/hoteles pequeños). Módulos actuales: Reservas, Disponibilidad, Rooms, Guests, Hoy, Mapa, Reportes.
Construido en Vite + React + shadcn + Supabase, vía Lovable.

## Modelo de negocio
SaaS — se vende por suscripción a dueños de alojamientos. No es herramienta interna.

## Meta principal actual
Lanzar y validar: conseguir una versión usable en producción con feedback real de uso,
no todavía crecimiento de clientes/MRR.

## Equipo
Solo founder. Sin colaboradores. Tiempo y cash son restricciones igual de ajustadas.

## Estado del piloto
- 1 usuario piloto real: la hermana del founder, que recién recibió la administración de un
  hotel de habitaciones. Antes se manejaban reservas en papel; intentaron Excel y el personal
  no estaba capacitado para usarlo. Ella está modernizando priorizando atención al cliente y
  captación de leads (redes sociales, clientes anteriores).
- El piloto pidió cambios concretos hace un tiempo; se priorizó otra cosa y el piloto quedó
  en pausa. Ahora se está retomando.
- Pipeline de prospectos fuera de este piloto: cero. Este es el único punto de validación
  externa que existe hoy.
- **Importante:** este piloto es familiar (la hermana). Valida ajuste operativo/uso real,
  pero NO valida disposición de mercado a pagar — no asumir que generaliza a clientes
  desconocidos hasta probarlo con alguien fuera del círculo de confianza.

## ICP hipotético (basado en el único dato real que tenemos)
Hoteles/hostales pequeños e independientes, gestión no profesionalizada, en transición desde
papel o Excel fallido, con personal de bajo perfil técnico. Lo que compite no es "features de
IA" sino fricción de adopción: si el staff no lo puede usar sin capacitación, no sirve. Esto es
un segmento distinto al de competidores con IA / herramientas sofisticadas — no competir ahí
todavía.

## Notas
- Historial de commits sugiere que casi todo el desarrollo pasa por Lovable (commits "Changes"
  genéricos) con algunos cambios manuales puntuales (ej. "Calcular precio total reserva",
  "Restringió acceso a reportes").
