-- Café por estación: una estación permanente cubre hasta N personas y cuesta un
-- precio plano. Reemplaza el cálculo por-persona (coffee_price_per_person), que
-- disparaba el precio del catering. Para >capacidad: ceil(asistentes/capacidad)
-- estaciones. El mínimo de asistentes ya no aplica (1 estación cubre desde 1).

ALTER TABLE public.salon_config
  ADD COLUMN coffee_station_price    numeric NOT NULL DEFAULT 2500 CHECK (coffee_station_price >= 0),
  ADD COLUMN coffee_station_capacity integer NOT NULL DEFAULT 30   CHECK (coffee_station_capacity > 0);

ALTER TABLE public.salon_config
  DROP COLUMN coffee_price_per_person,
  DROP COLUMN coffee_min_attendees;
