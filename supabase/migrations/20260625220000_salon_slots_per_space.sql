-- Slots por espacio: cada slot pertenece a un espacio y lleva su propio precio.
-- Elimina la tabla salon_space_rates y los slots globales. El precio que antes
-- vivía en salon_space_rates pasa a salon_slots.price_per_day (que ya existía
-- pero estaba muerto).

-- 1. Cada slot pertenece a un espacio.
ALTER TABLE public.salon_slots
  ADD COLUMN space_id uuid REFERENCES public.salon_spaces(id) ON DELETE CASCADE;

-- 2. Por cada tarifa (espacio × slot global) crear un slot por-espacio con su precio,
--    conservando el mapeo para repuntar reservas.
CREATE TEMP TABLE slot_map AS
SELECT
  r.space_id,
  r.slot_id            AS old_slot_id,
  gen_random_uuid()    AS new_slot_id,
  s.name, s.start_time, s.end_time,
  r.price_per_day
FROM public.salon_space_rates r
JOIN public.salon_slots s ON s.id = r.slot_id;

INSERT INTO public.salon_slots (id, name, start_time, end_time, price_per_day, space_id, is_active)
SELECT new_slot_id, name, start_time, end_time, price_per_day, space_id, true
FROM slot_map;

UPDATE public.salon_reservations res
SET slot_id = m.new_slot_id
FROM slot_map m
WHERE res.space_id = m.space_id
  AND res.slot_id  = m.old_slot_id;

-- 3. Defensivo: reservas cuyo (espacio, slot) no tenía tarifa siguen apuntando a un
--    slot global. Clonarlo a un slot por-espacio (precio 0) y repuntar.
CREATE TEMP TABLE orphan_map AS
SELECT DISTINCT
  res.space_id,
  res.slot_id          AS old_slot_id,
  gen_random_uuid()    AS new_slot_id,
  s.name, s.start_time, s.end_time,
  COALESCE(s.price_per_day, 0) AS price_per_day
FROM public.salon_reservations res
JOIN public.salon_slots s ON s.id = res.slot_id
WHERE s.space_id IS NULL;

INSERT INTO public.salon_slots (id, name, start_time, end_time, price_per_day, space_id, is_active)
SELECT new_slot_id, name, start_time, end_time, price_per_day, space_id, true
FROM orphan_map;

UPDATE public.salon_reservations res
SET slot_id = m.new_slot_id
FROM orphan_map m
WHERE res.space_id = m.space_id
  AND res.slot_id  = m.old_slot_id;

-- 4. Quitar la tabla de tarifas (libera el FK hacia los slots globales).
DROP TABLE public.salon_space_rates;

-- 5. Borrar los slots globales remanentes (ya nada los referencia).
DELETE FROM public.salon_slots WHERE space_id IS NULL;

-- 6. A partir de ahora todo slot pertenece a un espacio.
ALTER TABLE public.salon_slots ALTER COLUMN space_id SET NOT NULL;
