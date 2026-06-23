-- Enums
CREATE TYPE public.room_occupancy AS ENUM ('sencilla', 'doble', 'triple');
CREATE TYPE public.user_role AS ENUM ('admin', 'receptionist');

-- Users (app-level profile linked to Supabase auth)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'receptionist',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Guests
CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rooms
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'standard',
  base_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Room rates (price per occupancy type for a room)
CREATE TABLE public.room_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  occupancy public.room_occupancy NOT NULL,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_rates_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);

-- Reservations
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  room_rate_id uuid,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  status text NOT NULL DEFAULT 'booked',
  base_price numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  final_price numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_guest_fk FOREIGN KEY (guest_id) REFERENCES public.guests(id),
  CONSTRAINT reservations_room_fk FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT reservations_room_rate_id_fkey FOREIGN KEY (room_rate_id) REFERENCES public.room_rates(id),
  CONSTRAINT reservations_dates_check CHECK (check_out_date > check_in_date)
);

CREATE INDEX reservations_room_id_idx ON public.reservations(room_id);
CREATE INDEX reservations_guest_id_idx ON public.reservations(guest_id);
CREATE INDEX reservations_check_in_idx ON public.reservations(check_in_date);
