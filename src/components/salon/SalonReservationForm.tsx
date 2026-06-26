import { useState, useMemo, useEffect, useRef } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Loader2, Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { GuestCombobox } from "@/components/reservations/GuestCombobox";
import { CreateGuestModal } from "@/components/reservations/CreateGuestModal";
import type { SalonSlot } from "@/hooks/useSalonSlots";
import type { SalonMenu } from "@/hooks/useSalonMenus";
import type { SalonConfig } from "@/hooks/useSalonConfig";
import type { SalonSpace } from "@/hooks/useSalonSpaces";
import type { SalonResource } from "@/hooks/useSalonResources";
import type { NewSalonReservationInput, SalonReservationListItem } from "@/hooks/useSalonReservations";

const t = es.salonPage;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const PILL_FREE = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-label-md bg-[#dcfce7] text-[#166534]";
const PILL_OCCUPIED = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-label-md bg-[#fef3c7] text-[#92400e]";

interface InitialResource {
  resourceId: string;
  quantityRequested: number;
}

interface InitialValues {
  guestId: string;
  initialGuest?: Guest;
  spaceId: string;
  slotId: string;
  startDate: string;
  endDate: string;
  attendees: number | null;
  resources: InitialResource[];
  menuId: string | null;
  coffeeStation: boolean;
  coffeeCookies: boolean;
  notes: string | null;
}

interface SalonReservationFormProps {
  spaces: SalonSpace[];
  slots: SalonSlot[];
  menus: SalonMenu[];
  resources: SalonResource[];
  reservations: SalonReservationListItem[];
  config: SalonConfig | null;
  onSubmit: (input: NewSalonReservationInput) => Promise<void>;
  onCancel: () => void;
  isAdmin?: boolean;
  editingId?: string;
  initialValues?: InitialValues;
}

export function SalonReservationForm({
  spaces, slots, menus, resources, reservations, config,
  onSubmit, onCancel,
  isAdmin = false, editingId, initialValues,
}: SalonReservationFormProps) {
  const isEditing = Boolean(editingId);

  const [guestId, setGuestId] = useState(initialValues?.guestId ?? "");
  const [guestOverride, setGuestOverride] = useState<Guest | null>(initialValues?.initialGuest ?? null);
  const [spaceId, setSpaceId] = useState(initialValues?.spaceId ?? "");
  const [slotId, setSlotId] = useState(initialValues?.slotId ?? "");
  // Por defecto la reserva nueva arranca con la fecha de hoy (salvo edición/prefill).
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "");
  // "Varios días" abre la fecha fin; apagado, el evento es de un solo día (fin = inicio).
  const [multiDay, setMultiDay] = useState<boolean>(
    () => Boolean(initialValues && initialValues.startDate !== initialValues.endDate),
  );
  const [attendees, setAttendees] = useState<number | null>(initialValues?.attendees ?? null);
  // resourceId -> quantityRequested. Presence of a key means the resource is selected.
  const [resourceQtys, setResourceQtys] = useState<Record<string, number>>(
    () => Object.fromEntries((initialValues?.resources ?? []).map((r) => [r.resourceId, r.quantityRequested])),
  );
  const [menuId, setMenuId] = useState<string | null>(initialValues?.menuId ?? null);
  const [coffeeStation, setCoffeeStation] = useState(initialValues?.coffeeStation ?? false);
  const [coffeeCookies, setCoffeeCookies] = useState(initialValues?.coffeeCookies ?? false);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState<boolean>(() => Boolean(initialValues?.notes?.trim()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateGuestModalOpen, setIsCreateGuestModalOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Fecha fin efectiva: en evento de un día siempre espeja la fecha de inicio.
  const effectiveEnd = multiDay ? endDate : startDate;

  useEffect(() => {
    if (submitError) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  const { guests: searchedGuests, search: guestSearchQuery, setSearch: setGuestSearchQuery, loading: isSearchingGuests, error: guestSearchError } = useGuests();

  const selectedGuest = (guestOverride?.id === guestId ? guestOverride : null) ?? searchedGuests.find((g) => g.id === guestId) ?? null;
  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  const selectedMenu = menus.find((m) => m.id === menuId) ?? null;

  const activeResources = resources.filter((r) => r.is_active);
  const activeSpaces = spaces.filter((s) => s.is_active);
  const spaceSlots = useMemo(
    () => slots.filter((s) => s.is_active && s.space_id === spaceId),
    [slots, spaceId],
  );

  // El precio base lo lleva el propio slot (un slot pertenece a un espacio).
  const pricePerDay = selectedSlot?.price_per_day ?? 0;

  // Disponibilidad por slot para el espacio + rango elegidos. Espeja la regla del
  // trigger: un slot está ocupado si existe una reserva no cancelada (distinta de la
  // que se edita) del mismo espacio+slot con rango de fechas solapado.
  const slotConflicts = useMemo(() => {
    const map: Record<string, SalonReservationListItem> = {};
    if (!spaceId || !startDate || !effectiveEnd || effectiveEnd < startDate) return map;
    for (const slot of spaceSlots) {
      const conflict = reservations.find(
        (r) =>
          r.spaceId === spaceId &&
          r.slotId === slot.id &&
          r.status !== "cancelled" &&
          r.id !== editingId &&
          r.startDate <= effectiveEnd &&
          r.endDate >= startDate,
      );
      if (conflict) map[slot.id] = conflict;
    }
    return map;
  }, [spaceId, startDate, effectiveEnd, spaceSlots, reservations, editingId]);

  const { numDays, basePrice, addonsPrice, totalPrice } = useMemo(() => {
    if (!startDate || !effectiveEnd || effectiveEnd < startDate || !selectedSlot || !spaceId) {
      return { numDays: 0, basePrice: 0, addonsPrice: 0, totalPrice: 0 };
    }
    const days = differenceInDays(parseISO(effectiveEnd), parseISO(startDate)) + 1;
    const base = pricePerDay * days;

    // Equipment: each selected resource priced flat per unit (not per day)
    let equipment = 0;
    for (const [id, qty] of Object.entries(resourceQtys)) {
      const res = resources.find((r) => r.id === id);
      if (res) equipment += res.price * qty;
    }

    // Catering: menú por asistente por día; café por estación (una estación cubre
    // hasta `coffee_station_capacity` personas, precio plano); galletas por asistente.
    let catering = 0;
    if (config) {
      if (selectedMenu && attendees) catering += selectedMenu.price_per_person * attendees * days;
      if (coffeeStation && attendees) {
        const stations = Math.ceil(attendees / config.coffee_station_capacity);
        catering += stations * config.coffee_station_price;
      }
      if (coffeeCookies && coffeeStation && attendees) catering += config.cookies_price * attendees;
    }

    const addons = equipment + catering;
    return { numDays: days, basePrice: base, addonsPrice: addons, totalPrice: base + addons };
  }, [startDate, effectiveEnd, selectedSlot, spaceId, pricePerDay, resourceQtys, resources, selectedMenu, attendees, coffeeStation, coffeeCookies, config]);

  // Limpia el slot cuando la selección actual no pertenece al espacio elegido.
  // Conserva el slot inicial al editar y lo borra solo ante un cambio real de espacio.
  useEffect(() => {
    if (!spaceId || slots.length === 0 || !slotId) return;
    if (!slots.some((s) => s.id === slotId && s.space_id === spaceId)) setSlotId("");
  }, [spaceId, slotId, slots]);

  // Si el slot elegido pasa a estar ocupado (p. ej. al cambiar la fecha), lo deselecciona.
  useEffect(() => {
    if (slotId && slotConflicts[slotId]) setSlotId("");
  }, [slotId, slotConflicts]);

  // El stepper ES la selección: + desde 0 selecciona (qty 1); − en 1 deselecciona.
  const incResource = (res: SalonResource) => {
    setResourceQtys((prev) => {
      const current = prev[res.id];
      if (current === undefined) return { ...prev, [res.id]: 1 };
      return { ...prev, [res.id]: clamp(current + 1, 1, res.quantity) };
    });
  };

  const decResource = (res: SalonResource) => {
    setResourceQtys((prev) => {
      const current = prev[res.id];
      if (current === undefined) return prev;
      if (current <= 1) {
        const next = { ...prev };
        delete next[res.id];
        return next;
      }
      return { ...prev, [res.id]: current - 1 };
    });
  };

  // Edición manual de la cantidad (solo si ya está seleccionado).
  const setResourceQty = (res: SalonResource, value: number) => {
    setResourceQtys((prev) => {
      if (!(res.id in prev)) return prev;
      return { ...prev, [res.id]: clamp(value || 1, 1, res.quantity) };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!guestId) errs.guestId = t.validation.guestRequired;
    if (!spaceId) errs.spaceId = t.validation.spaceRequired;
    if (!slotId) errs.slotId = t.validation.slotRequired;
    if (!startDate) errs.startDate = t.validation.startDateRequired;
    if (multiDay) {
      if (!endDate) errs.endDate = t.validation.endDateRequired;
      if (startDate && endDate && endDate < startDate) errs.endDate = t.validation.dateRangeInvalid;
    }
    if (!isEditing) {
      const today = new Date().toISOString().split("T")[0];
      if (startDate && startDate < today) errs.startDate = t.validation.startDatePast;
    }
    if ((menuId || coffeeStation) && !attendees) errs.attendees = t.validation.attendeesRequired;
    if (coffeeCookies && !coffeeStation) errs.coffeeCookies = t.validation.cookiesRequiresCoffee;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      // Only submit resources still present in the loaded list, so submit and the
      // priced total stay consistent (a resource deactivated after booking drops out of both).
      const resourcesInput = Object.entries(resourceQtys)
        .filter(([resourceId]) => resources.some((r) => r.id === resourceId))
        .map(([resourceId, quantityRequested]) => ({ resourceId, quantityRequested }));
      await onSubmit({ guestId, spaceId, slotId, startDate, endDate: effectiveEnd, attendees, resources: resourcesInput, menuId, coffeeStation, coffeeCookies, basePrice, addonsPrice, finalPrice: totalPrice, notes: notes || null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : es.common.unexpectedError;
      const unavailable = msg.match(/^RESOURCE_UNAVAILABLE:(.+)$/);
      if (unavailable) {
        const res = resources.find((r) => r.id === unavailable[1]);
        setSubmitError(t.errors.resourceUnavailable(res?.name ?? "El recurso"));
      } else {
        const errMap: Record<string, string> = {
          SALON_OVERLAP:   t.errors.salonOverlap,
          INVALID_DATES:   t.errors.invalidDates,
          PAST_START_DATE: t.errors.pastStartDate,
        };
        setSubmitError(errMap[msg] ?? msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div ref={errorRef} />
        {submitError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{submitError}</AlertDescription></Alert>}
        {!config && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{t.noConfigWarning}</AlertDescription></Alert>}

        {/* Cliente + Asistentes */}
        <div className="flex flex-wrap items-stretch gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label>{t.form.guestLabel} *</Label>
            <GuestCombobox guests={searchedGuests} selectedGuestId={guestId} selectedGuest={selectedGuest} onSelect={setGuestId}
              onOpenCreateModal={() => setIsCreateGuestModalOpen(true)} searchQuery={guestSearchQuery} onSearchChange={setGuestSearchQuery}
              isSearching={isSearchingGuests} error={errors.guestId} searchError={guestSearchError} />
          </div>

          <div className="hidden sm:block w-px self-stretch bg-outline-variant" />

          <div className="flex-1 min-w-[160px] space-y-1">
            <Label>{t.form.attendeesLabel}</Label>
            <div className="relative">
              <Input type="number" min={1} value={attendees ?? ""} placeholder="0"
                onChange={(e) => setAttendees(e.target.value ? parseInt(e.target.value) : null)}
                className={errors.attendees ? "border-destructive pr-9" : "pr-9"} />
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-[20px] text-on-surface-variant pointer-events-none">groups</span>
            </div>
            {errors.attendees && <p className="text-sm text-destructive">{errors.attendees}</p>}
          </div>
        </div>

        {/* Espacio + Fecha */}
        <div className="flex flex-wrap items-stretch gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label>{t.form.spaceLabel} *</Label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger className={cn("w-[220px]", errors.spaceId && "border-destructive")}><SelectValue placeholder="Seleccionar espacio" /></SelectTrigger>
              <SelectContent>{activeSpaces.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
            </Select>
            {errors.spaceId && <p className="text-sm text-destructive">{errors.spaceId}</p>}
          </div>

          <div className="hidden sm:block w-px self-stretch bg-outline-variant" />

          <div className="flex-1 min-w-[200px] space-y-1">
            <div className="flex items-center gap-3">
              <Label>{t.form.dateLabel} *</Label>
              <div className="flex items-center gap-2">
                <span className="text-label-md text-on-surface-variant whitespace-nowrap">{t.form.variosDias}</span>
                <Switch checked={multiDay} onCheckedChange={(v) => { setMultiDay(v); if (v && !endDate) setEndDate(startDate); }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} min={isEditing ? undefined : todayStr}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(multiDay ? "w-[150px]" : "w-[200px]", errors.startDate && "border-destructive")} />
              {multiDay && (
                <>
                  <span className="text-on-surface-variant">→</span>
                  <Input type="date" value={endDate} min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={cn("w-[150px]", errors.endDate && "border-destructive")} />
                </>
              )}
            </div>
            {(errors.startDate || errors.endDate) && <p className="text-sm text-destructive">{errors.startDate || errors.endDate}</p>}
          </div>
        </div>

        {/* Horarios disponibles */}
        <section className="space-y-2">
          <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">{t.form.horariosTitle}</h3>
          <div className="flex min-h-[60px] flex-col justify-center">
          {!spaceId ? (
            <p className="text-body-sm text-on-surface-variant">{t.form.pickSpaceForSlots}</p>
          ) : spaceSlots.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">{t.form.noSlotsForSpace}</p>
          ) : !startDate ? (
            <p className="text-body-sm text-on-surface-variant">{t.form.pickDateForSlots}</p>
          ) : (
            <div className="flex flex-row flex-wrap gap-2">
              {spaceSlots.map((slot) => {
                const conflict = slotConflicts[slot.id];
                const timeRange = `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
                if (conflict) {
                  return (
                    <div key={slot.id} className="flex-1 min-w-[160px] flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container opacity-60 cursor-not-allowed">
                      <div className="flex flex-col min-w-0">
                        <span className="text-table-data text-on-surface line-through truncate">{slot.name}</span>
                        <span className="text-label-md text-on-surface-variant truncate">{timeRange} · {conflict.guestName}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-label-bold text-on-surface">{formatCurrency(slot.price_per_day)}</span>
                        <span className={PILL_OCCUPIED}><span className="w-1.5 h-1.5 rounded-full bg-[#92400e]" />{t.board.occupied}</span>
                      </div>
                    </div>
                  );
                }
                const selected = slotId === slot.id;
                return (
                  <label key={slot.id} className={`flex-1 min-w-[160px] flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-container-lowest cursor-pointer transition-colors ${selected ? "border-2 border-primary" : "border border-outline-variant hover:bg-surface-container-low"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="radio" name="slot" checked={selected} onChange={() => setSlotId(slot.id)} className="h-4 w-4 shrink-0 text-primary focus:ring-primary" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-table-data text-on-surface truncate">{slot.name}</span>
                        <span className="text-label-md text-on-surface-variant">{timeRange}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-label-bold text-on-surface">{formatCurrency(slot.price_per_day)}</span>
                      <span className={PILL_FREE}><span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />{t.board.free}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          </div>
          {errors.slotId && <p className="text-sm text-destructive">{errors.slotId}</p>}
        </section>

        {/* Catering */}
        <section className="space-y-2">
          <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">{t.form.cateringTitle}</h3>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
              {/* Tipo de menú */}
              <div className="flex flex-1 items-center gap-3">
                <Label className="whitespace-nowrap">{t.form.menuTypeLabel}</Label>
                <Select value={menuId ?? "none"} onValueChange={(v) => setMenuId(v === "none" ? null : v)}>
                  <SelectTrigger className="w-[240px] [&>span]:flex-1 [&>span]:text-left"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.form.noMenu}</SelectItem>
                    {menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} — {formatCurrency(m.price_per_person)}/pax</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Divisor centrado entre ambas categorías */}
              <div className="hidden sm:block w-px self-stretch bg-outline-variant" />

              {/* N° de estaciones (en el hueco) + café + galletas, todo en una sola línea */}
              <div className="flex flex-1 items-center justify-between gap-4">
                {coffeeStation && attendees && config ? (
                  <span className="flex flex-col items-center rounded-pill bg-secondary-container/30 px-2.5 py-1 text-label-md leading-tight text-on-surface">
                    <span className="whitespace-nowrap">{t.form.coffeeStationsCount(Math.ceil(attendees / config.coffee_station_capacity))}</span>
                    <span className="whitespace-nowrap font-medium">{formatCurrency(Math.ceil(attendees / config.coffee_station_capacity) * config.coffee_station_price)}</span>
                  </span>
                ) : (
                  <span aria-hidden />
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-body-md text-on-surface whitespace-nowrap">{t.form.coffeeLabel}</span>
                      {config && <span className="text-label-md text-on-surface-variant whitespace-nowrap">{formatCurrency(config.coffee_station_price)} / {config.coffee_station_capacity} pax</span>}
                    </div>
                    <Switch checked={coffeeStation} onCheckedChange={(v) => { setCoffeeStation(v); if (!v) setCoffeeCookies(false); }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-body-md text-on-surface whitespace-nowrap">{t.form.cookiesLabel}</span>
                      {config && <span className="text-label-md text-on-surface-variant whitespace-nowrap">{formatCurrency(config.cookies_price)} / pax</span>}
                    </div>
                    <Switch checked={coffeeCookies} disabled={!coffeeStation} onCheckedChange={(v) => setCoffeeCookies(v)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {errors.coffeeCookies && <p className="text-sm text-destructive">{errors.coffeeCookies}</p>}
        </section>

        {/* Equipamiento */}
        <section className="space-y-2">
          <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">{t.form.equipmentLabel}</h3>
          {activeResources.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">{t.form.noResourcesWarning}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {activeResources.map((res) => {
                const selected = res.id in resourceQtys;
                const qty = selected ? (resourceQtys[res.id] ?? 1) : 0;
                const fillPct = selected ? (qty / res.quantity) * 100 : 0;
                return (
                  <div key={res.id} className={cn(
                    "relative flex min-h-[3rem] items-stretch overflow-hidden rounded-lg border transition-colors",
                    selected ? "border-primary/50" : "border-outline-variant"
                  )}>
                    {/* Relleno proporcional a las unidades usadas del stock */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 bg-primary-container/40 transition-all duration-200" style={{ width: `${fillPct}%` }} />

                    {/* − en el borde izquierdo */}
                    <button type="button" onClick={() => decResource(res)} disabled={!selected} aria-label="Restar"
                      className="relative z-10 grid w-9 shrink-0 place-items-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent">
                      <Minus className="h-4 w-4" />
                    </button>

                    {/* Nombre + cantidad (mezcla) + subtotal */}
                    <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1.5 text-center">
                      <span className="flex max-w-full items-center gap-1.5">
                        <span className="truncate text-body-md text-on-surface">{res.name}</span>
                        {selected && (res.quantity > 1 ? (
                          <span className="flex shrink-0 cursor-text items-center rounded-pill bg-primary pl-1.5 pr-1 text-label-md font-medium text-white transition-colors hover:bg-primary/90 focus-within:bg-white focus-within:text-primary focus-within:ring-1 focus-within:ring-primary">
                            ×
                            <input
                              type="number"
                              min={1}
                              max={res.quantity}
                              value={qty}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setResourceQty(res, parseInt(e.target.value))}
                              aria-label="Cantidad"
                              className="w-6 cursor-text border-b border-dashed border-white/70 bg-transparent text-center caret-white tabular-nums outline-none focus:border-solid focus:border-primary focus:caret-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-pill bg-primary px-1.5 text-label-md font-medium text-white tabular-nums">×1</span>
                        ))}
                      </span>
                      <span className="text-label-md text-on-surface-variant tabular-nums">{formatCurrency(selected ? res.price * qty : res.price)}</span>
                    </div>

                    {/* + en el borde derecho */}
                    <button type="button" onClick={() => incResource(res)} disabled={qty >= res.quantity} aria-label="Sumar"
                      className="relative z-10 grid w-9 shrink-0 place-items-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        </div>

        {/* Footer: notas (overlay) + total + acciones (siempre visible) */}
        <div className="relative shrink-0 border-t border-outline-variant bg-surface-container-low">
          {notesOpen && (
            <div className="absolute inset-x-0 bottom-full z-20 border-t border-outline-variant bg-surface-container-low px-6 py-4 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.18)]">
              <Textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.form.notesPlaceholder}
                rows={2}
                className="resize-none bg-surface-container-lowest"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="leading-tight">
                <p className="text-body-sm text-on-surface-variant">{t.form.summaryLabel}</p>
                <p className="text-headline-lg text-primary">
                  {t.form.totalLabel}: {formatCurrency(totalPrice)}
                  {numDays > 0 && pricePerDay > 0 && (
                    <span className="ml-2 text-body-sm font-normal text-on-surface-variant">
                      ({numDays} {numDays === 1 ? "día" : "días"} × {formatCurrency(pricePerDay)})
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen((o) => !o)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-label-md transition-colors",
                  notesOpen
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                {t.form.notesLabel}
                {notes.trim() && !notesOpen && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>{es.common.cancel}</Button>
              <Button type="submit" disabled={isSubmitting || !config} className="gap-2">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />{es.common.saving}</>
                  : <><span className="material-symbols-outlined text-[18px]">save</span>{isEditing ? t.form.saveChanges : es.common.save}</>}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <CreateGuestModal open={isCreateGuestModalOpen} onOpenChange={setIsCreateGuestModalOpen}
        onGuestCreated={(g) => { setGuestId(g.id); setGuestOverride(g); setGuestSearchQuery(""); }} />
    </>
  );
}
