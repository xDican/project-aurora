# Aurora PMS — Guía de arquitectura para Claude

## ¿Qué es este proyecto?

SaaS de gestión hotelera (PMS) para pequeños alojamientos en Honduras. Stack: **React 18 + TypeScript + Vite + Supabase + Tailwind CSS**. UI en español, valores de BD en inglés. Un solo repo, un solo branch (`main`), despliegue automático vía Lovable.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| UI | React 18, TypeScript, Vite |
| Componentes base | shadcn/ui (Radix UI) — no editar los archivos en `src/components/ui/` |
| Estilos | Tailwind CSS con design tokens propios (ver sección de tokens) |
| Base de datos / Auth | Supabase (Postgres 17, Auth, RLS) |
| Cliente Supabase | `src/integrations/supabase/client.ts` (singleton) |
| Tipos de BD | `src/integrations/supabase/types.ts` (auto-generado, no editar a mano) |
| Routing | React Router v6 |
| Fechas | date-fns v3 |
| Gráficos | recharts |
| Toasts | sonner |
| React Query | Instalado pero **no se usa** en hooks — los hooks usan useState + useEffect propios |

---

## Estructura de directorios

```
src/
├── App.tsx                       # Raíz: providers + Routes
├── contexts/AuthContext.tsx      # Estado de sesión, currentUser, role
├── components/
│   ├── Layout.tsx                # Sidebar + TopBar + canvas principal
│   ├── ProtectedRoute.tsx        # Guard de auth + roles
│   ├── guests/GuestForm.tsx
│   ├── reservations/
│   │   ├── ReservationForm.tsx   # Formulario compartido crear/editar reserva
│   │   ├── GuestCombobox.tsx
│   │   ├── CreateGuestModal.tsx
│   │   └── InlineGuestForm.tsx
│   ├── rooms/
│   │   ├── RoomForm.tsx
│   │   ├── RoomCard.tsx
│   │   └── RoomDetailModal.tsx
│   └── ui/                       # shadcn/ui — NO EDITAR
├── hooks/
│   ├── useReservations.ts        # CRUD + estado de reservas
│   ├── useRooms.ts
│   ├── useRoomRates.ts
│   ├── useGuests.ts
│   ├── useRoomMap.ts
│   ├── useReports.ts
│   ├── useTodayArrivals.ts
│   └── useDepartures.ts
├── integrations/supabase/
│   ├── client.ts                 # createClient singleton
│   └── types.ts                  # Tipos auto-generados (supabase gen types)
├── lib/
│   ├── i18n/es.ts                # TODAS las cadenas en español
│   ├── currency.ts               # formatCurrency(amount) → "L 1,234.00"
│   └── utils.ts                  # cn() de clsx + tailwind-merge
└── pages/
    ├── Hoy.tsx                   # Llegadas/salidas del día, check-in/out
    ├── Disponibilidad.tsx        # Disponibilidad por rango de fechas
    ├── Reservas.tsx              # CRUD completo de reservas
    ├── Mapa.tsx                  # Mapa visual de habitaciones
    ├── Rooms.tsx                 # Gestión de habitaciones (admin)
    ├── Guests.tsx                # Gestión de huéspedes
    ├── Reportes.tsx              # KPIs + gráficos (admin)
    ├── Login.tsx
    └── DebugDbTest.tsx           # Página de testing — ocultar en prod
```

---

## Patrones establecidos

### 1. i18n
Toda cadena visible al usuario va en `src/lib/i18n/es.ts`. Los valores de BD (status, tipos) se mantienen en inglés. Al agregar una feature nueva, extender el objeto `es` con una nueva sección antes de tocar JSX.

### 2. Data fetching
Hooks custom con `useState` + `useCallback` + `useEffect`. Patrón estándar:
```ts
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | undefined>();

const refresh = useCallback(async () => { ... }, []);
useEffect(() => { refresh(); }, [refresh]);
```
React Query está instalado pero no se usa — no introducirlo sin decisión explícita.

### 3. Autenticación y roles
- `AuthContext` mantiene `session` (Supabase Auth) + `currentUser` (fila en `public.users`) + `role`.
- Al login, `fetchOrCreateUser` busca o crea la fila en `public.users` ligada al `auth.uid()`.
- `ProtectedRoute` con `allowedRoles={["admin"]}` protege rutas de admin.
- El nav en `Layout.tsx` filtra items por rol automáticamente.
- **IMPORTANTE:** si un usuario se crea solo en `auth.users` sin fila en `public.users`, no tendrá rol y RLS bloqueará todo. Siempre crear ambas filas.

### 4. RLS y seguridad en BD
- Todas las tablas tienen RLS activado.
- La función `current_app_role()` (SECURITY DEFINER) resuelve el rol del usuario autenticado sin loop recursivo.
- Las mutaciones privilegiadas (archivar, cambiar estado) pasan por funciones SECURITY DEFINER, no por UPDATE directo.
- Receptionist puede: SELECT todo, INSERT reservas/huéspedes, UPDATE reservas. Admin puede todo lo anterior + INSERT/UPDATE rooms, room_rates, archivar.

### 5. Navegación / rutas
Rutas registradas en `App.tsx`. El nav en `Layout.tsx` tiene `navItems[]` con `path`, `label`, `icon` (Material Symbols) y `roles?`. Para agregar una página:
1. Crear `src/pages/NuevaPagina.tsx`
2. Agregar a `navItems` en `Layout.tsx`
3. Registrar `<Route>` en `App.tsx`

### 6. Design tokens
Tailwind extendido con tokens propios. Usar siempre los tokens en lugar de valores crudos:
- Espaciado: `container_padding`, `stack_gap_sm/md/lg`, `table_cell_padding_x/y`
- Colores semánticos: `surface-container-lowest/low/high`, `primary`, `primary-container`, `on-primary-container`, `outline-variant`, etc.
- Tipografía: `text-headline-md`, `text-body-md`, `text-body-sm`, `text-label-md`, `text-label-bold`, `text-table-data`
- Layout: `sidebar_width`

---

## Schema de base de datos

```
public.users
  id, auth_user_id (→ auth.users), email, role (admin|receptionist), created_at

public.guests
  id, name, document, phone, email, is_active, archived_at, created_at

public.rooms
  id, number, type, base_price, status, notes, is_active, archived_at, created_at

public.room_rates
  id, room_id (→ rooms), occupancy (sencilla|doble|triple), price, is_active, created_at

public.reservations
  id, room_id, guest_id, room_rate_id, check_in_date, check_out_date,
  status (booked|checked_in|checked_out|cancelled|no_show),
  base_price, discount, final_price, notes, created_at
  CONSTRAINT: no_overlap_per_room (excluye cancelled/no_show)
  TRIGGER: bloquea check_in_date en el pasado en INSERT
```

### Funciones clave
| Función | Quién puede | Qué hace |
|---|---|---|
| `current_app_role()` | authenticated | Retorna rol del usuario actual |
| `archive_guest(uuid)` | admin | Soft-delete de huésped |
| `archive_room(uuid)` | admin | Soft-delete de habitación |
| `set_room_status(uuid, text)` | any role | Cambia estado de habitación |
| `update_guest_recent(uuid, ...)` | admin siempre; receptionist: 24h | Edita huésped con ventana de tiempo |
| `report_kpis`, `report_reservations`, `report_occupancy_daily`, `report_revenue_daily` | authenticated | Reportes |

---

## Convenciones de código

- Sin comentarios salvo cuando el WHY no es obvio.
- Nombres en inglés en código, español en UI.
- Errores de BD se mapean a strings de error semánticos (`"ROOM_OVERLAP"`, `"PAST_CHECKIN"`) en el hook, y a mensajes de `es.ts` en el componente.
- Soft delete siempre: `is_active = false` + `archived_at = now()`. Nunca DELETE físico de usuarios/huéspedes/habitaciones.

---

## Lo que NO está en este repo

- No hay backend propio — toda la lógica de negocio privilegiada vive en funciones Postgres SECURITY DEFINER.
- No hay Edge Functions todavía.
- No hay tests automatizados.
- No hay CI/CD propio — Lovable detecta push a `main` y despliega.

---

## Flujo de desarrollo (seguir este orden para cada feature)

### Fase 0 — Define (texto, sin código, ~10 min)
Responder estas cuatro preguntas antes de abrir cualquier archivo:
1. ¿Qué hace el feature en una oración?
2. ¿Qué roles pueden usarlo? (admin / receptionist / ambos)
3. ¿Qué estados/statuses tiene el dato?
4. ¿Qué edge cases conocemos ya?

Si no se pueden responder las cuatro, no arrancar.

### Fase 1 — Schema y RLS (BD primero)
1. Diseñar tablas y columnas
2. Definir políticas RLS (quién puede SELECT / INSERT / UPDATE)
3. Definir funciones SECURITY DEFINER si hay lógica privilegiada
4. Escribir y aplicar la migración vía Supabase MCP
5. Verificar con query en Supabase que funciona

### Fase 2 — Capa de datos (TypeScript)
1. Regenerar types: `supabase gen types typescript --project-id kyjetjdzciczlqshjbcr > src/integrations/supabase/types.ts`
2. Definir interfaces TypeScript del hook
3. Escribir el hook: `useState` + `refresh` callback + mutaciones async con errores semánticos
4. Probar queries en SQL editor de Supabase antes de conectar a UI

### Fase 3 — UI
1. Pantalla nueva → mockup en Stitch primero, luego portar
2. Form / componente menor → directo en código
3. Conectar al hook real desde el primer commit (nunca datos hardcodeados)
4. Happy path primero, error states después

### Fase 4 — Verificación
1. `npx tsc --noEmit` — debe pasar sin errores
2. Probar flujo completo como **admin**
3. Probar flujo completo como **receptionist**
4. Revisar edge cases de Fase 0
5. Commit + push

**Por qué este orden:** el error más caro en este stack es escribir UI antes de tener el schema. El contrato es BD define la verdad → hook la expone → UI la consume.
