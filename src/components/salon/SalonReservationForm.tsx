import { useState, useMemo, useEffect } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { GuestCombobox } from "@/components/reservations/GuestCombobox";
import { CreateGuestModal } from "@/components/reservations/CreateGuestModal";
import type { SalonSlot } from "@/hooks/useSalonSlots";
import type { SalonMenu } from "@/hooks/useSalonMenus";
import type { SalonConfig } from "@/hooks/useSalonConfig";
import type { SalonSpace } from "@/hooks/useSalonSpaces";
import { useSalonSpaceRates } from "@/hooks/useSalonSpaces";
import type { NewSalonReservationInput, AudioPackage } from "@/hooks/useSalonReservations";

const t = es.salonPage;

interface InitialValues {
  guestId: string;
  initialGuest?: Guest;
  spaceId: string;
  slotId: string;
  startDate: string;
  endDate: string;
  attendees: number | null;
  includesProjector: boolean;
  includesScreen: boolean;
  audioPackage: AudioPackage;
  menuId: string | null;
  coffeeStation: boolean;
  coffeeCookies: boolean;
  notes: string | null;
}

interface SalonReservationFormProps {
  spaces: SalonSpace[];
  slots: SalonSlot[];
  menus: SalonMenu[];
  config: SalonConfig | null;
  onSubmit: (input: NewSalonReservationInput) => Promise<void>;
  onCancel: () => void;
  isAdmin?: boolean;
  editingId?: string;
  initialValues?: InitialValues;
}

export function SalonReservationForm({
  spaces, slots, menus, config,
  onSubmit, onCancel,
  isAdmin = false, editingId, initialValues,
}: SalonReservationFormProps) {
  const isEditing = Boolean(editingId);

  const [guestId, setGuestId] = useState(initialValues?.guestId ?? "");
  const [guestOverride, setGuestOverride] = useState<Guest | null>(initialValues?.initialGuest ?? null);
  const [spaceId, setSpaceId] = useState(initialValues?.spaceId ?? "");
  const [slotId, setSlotId] = useState(initialValues?.slotId ?? "");
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "");
  const [attendees, setAttendees] = useState<number | null>(initialValues?.attendees ?? null);
  const [includesProjector, setIncludesProjector] = useState(initialValues?.includesProjector ?? false);
  const [includesScreen, setIncludesScreen] = useState(initialValues?.includesScreen ?? false);
  const [audioPackage, setAudioPackage] = useState<AudioPackage>(initialValues?.audioPackage ?? "none");
  const [menuId, setMenuId] = useState<string | null>(initialValues?.menuId ?? null);
  const [coffeeStation, setCoffeeStation] = useState(initialValues?.coffeeStation ?? false);
  const [coffeeCookies, setCoffeeCookies] = useState(initialValues?.coffeeCookies ?? false);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateGuestModalOpen, setIsCreateGuestModalOpen] = useState(false);

  const { guests: searchedGuests, search: guestSearchQuery, setSearch: setGuestSearchQuery, loading: isSearchingGuests, error: guestSearchError } = useGuests();

  const { rates: spaceRates } = useSalonSpaceRates(spaceId || undefined);

  const selectedGuest = (guestOverride?.id === guestId ? guestOverride : null) ?? searchedGuests.find((g) => g.id === guestId) ?? null;
  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  const selectedMenu = menus.find((m) => m.id === menuId) ?? null;
  const spaceRate = spaceRates.find((r) => r.slot_id === slotId);

  // When space or slot changes, recalculate base price from space_rate
  const pricePerDay = spaceRate?.price_per_day ?? 0;

  const { numDays, basePrice, addonsPrice, totalPrice } = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate || !selectedSlot || !spaceId) {
      return { numDays: 0, basePrice: 0, addonsPrice: 0, totalPrice: 0 };
    }
    const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    const base = pricePerDay * days;
    let addons = 0;
    if (config) {
      if (includesProjector) addons += config.projector_price;
      if (includesScreen) addons += config.screen_price;
      if (audioPackage === "basic") addons += config.audio_basic_price;
      if (audioPackage === "complete") addons += config.audio_complete_price;
      if (selectedMenu && attendees) addons += selectedMenu.price_per_person * attendees * days;
      if (coffeeStation && attendees) addons += config.coffee_price_per_person * attendees;
      if (coffeeCookies && coffeeStation) addons += config.cookies_price;
    }
    return { numDays: days, basePrice: base, addonsPrice: addons, totalPrice: base + addons };
  }, [startDate, endDate, selectedSlot, spaceId, pricePerDay, selectedMenu, attendees, includesProjector, includesScreen, audioPackage, coffeeStation, coffeeCookies, config]);

  // Reset slot when space changes (avoid stale rate)
  useEffect(() => { if (spaceId) setSlotId(""); }, [spaceId]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!guestId) errs.guestId = t.validation.guestRequired;
    if (!spaceId) errs.spaceId = t.validation.spaceRequired;
    if (!slotId) errs.slotId = t.validation.slotRequired;
    if (!startDate) errs.startDate = t.validation.startDateRequired;
    if (!endDate) errs.endDate = t.validation.endDateRequired;
    if (startDate && endDate && endDate < startDate) errs.endDate = t.validation.dateRangeInvalid;
    if (!isEditing) {
      const today = new Date().toISOString().split("T")[0];
      if (startDate && startDate < today) errs.startDate = t.validation.startDatePast;
    }
    if ((menuId || coffeeStation) && !attendees) errs.attendees = t.validation.attendeesRequired;
    if (coffeeStation && attendees && config && attendees < config.coffee_min_attendees) errs.attendees = t.validation.coffeMinAttendees;
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
      await onSubmit({ guestId, spaceId, slotId, startDate, endDate, attendees, includesProjector, includesScreen, audioPackage, menuId, coffeeStation, coffeeCookies, basePrice, addonsPrice, finalPrice: totalPrice, notes: notes || null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : es.common.unexpectedError;
      const errMap: Record<string, string> = {
        SALON_OVERLAP:          t.errors.salonOverlap,
        PROJECTOR_UNAVAILABLE:  t.errors.projectorUnavailable,
        SCREEN_UNAVAILABLE:     t.errors.screenUnavailable,
        AUDIO_UNAVAILABLE:      t.errors.audioUnavailable,
        INVALID_DATES:          t.errors.invalidDates,
        PAST_START_DATE:        t.errors.pastStartDate,
      };
      setSubmitError(errMap[msg] ?? msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSpaces = spaces.filter((s) => s.is_active);
  const slotsWithRate = slots.filter((s) => s.is_active && (spaceId ? spaceRates.some((r) => r.slot_id === s.id) : true));

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{submitError}</AlertDescription></Alert>}
        {!config && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{t.noConfigWarning}</AlertDescription></Alert>}

        {/* Guest */}
        <div className="space-y-2">
          <Label>{t.form.guestLabel} *</Label>
          <GuestCombobox guests={searchedGuests} selectedGuestId={guestId} selectedGuest={selectedGuest} onSelect={setGuestId}
            onOpenCreateModal={() => setIsCreateGuestModalOpen(true)} searchQuery={guestSearchQuery} onSearchChange={setGuestSearchQuery}
            isSearching={isSearchingGuests} error={errors.guestId} searchError={guestSearchError} />
        </div>

        {/* Space */}
        <div className="space-y-2">
          <Label>{t.form.spaceLabel} *</Label>
          <Select value={spaceId} onValueChange={setSpaceId}>
            <SelectTrigger className={errors.spaceId ? "border-destructive" : ""}><SelectValue placeholder="Seleccionar espacio" /></SelectTrigger>
            <SelectContent>{activeSpaces.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
          </Select>
          {errors.spaceId && <p className="text-sm text-destructive">{errors.spaceId}</p>}
        </div>

        {/* Slot */}
        <div className="space-y-2">
          <Label>{t.form.slotLabel} *</Label>
          <Select value={slotId} onValueChange={setSlotId} disabled={!spaceId}>
            <SelectTrigger className={errors.slotId ? "border-destructive" : ""}><SelectValue placeholder={spaceId ? "Seleccionar slot" : "Selecciona un espacio primero"} /></SelectTrigger>
            <SelectContent>
              {slotsWithRate.map((s) => {
                const rate = spaceRates.find((r) => r.slot_id === s.id);
                return <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}){rate ? ` — ${formatCurrency(rate.price_per_day)}/día` : ""}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          {errors.slotId && <p className="text-sm text-destructive">{errors.slotId}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t.form.startDateLabel} *</Label>
            <Input type="date" value={startDate} min={isEditing ? undefined : new Date().toISOString().split("T")[0]}
              onChange={(e) => setStartDate(e.target.value)} className={errors.startDate ? "border-destructive" : ""} />
            {errors.startDate && <p className="text-sm text-destructive">{errors.startDate}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t.form.endDateLabel} *</Label>
            <Input type="date" value={endDate} min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)} className={errors.endDate ? "border-destructive" : ""} />
            {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
          </div>
        </div>

        {/* Attendees */}
        <div className="space-y-2">
          <Label>{t.form.attendeesLabel}</Label>
          <Input type="number" min={1} value={attendees ?? ""} placeholder="Ej: 50"
            onChange={(e) => setAttendees(e.target.value ? parseInt(e.target.value) : null)}
            className={errors.attendees ? "border-destructive" : ""} />
          {errors.attendees && <p className="text-sm text-destructive">{errors.attendees}</p>}
        </div>

        {/* Add-ons */}
        <div className="space-y-3 pt-1 border-t border-outline-variant">
          <p className="text-label-md text-on-surface-variant uppercase pt-1">Equipamiento y servicios</p>
          <div className="flex items-center gap-2">
            <Checkbox id="projector" checked={includesProjector} onCheckedChange={(v) => setIncludesProjector(Boolean(v))} />
            <Label htmlFor="projector">{t.form.projectorLabel}{config ? ` — ${formatCurrency(config.projector_price)}` : ""}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="screen" checked={includesScreen} onCheckedChange={(v) => setIncludesScreen(Boolean(v))} />
            <Label htmlFor="screen">{t.form.screenLabel}{config ? ` — ${formatCurrency(config.screen_price)}` : ""}</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.form.audioLabel}</Label>
              <Select value={audioPackage} onValueChange={(v) => setAudioPackage(v as AudioPackage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["none", "basic", "complete"] as AudioPackage[]).map((v) => <SelectItem key={v} value={v}>{es.audioPackageLabels[v]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.form.menuLabel}</Label>
              <Select value={menuId ?? "none"} onValueChange={(v) => setMenuId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.form.noMenu}</SelectItem>
                  {menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} — {formatCurrency(m.price_per_person)}/pax</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="coffee" checked={coffeeStation} onCheckedChange={(v) => { setCoffeeStation(Boolean(v)); if (!v) setCoffeeCookies(false); }} />
              <Label htmlFor="coffee">{t.form.coffeeLabel}{config ? ` — ${formatCurrency(config.coffee_price_per_person)}/pax` : ""}</Label>
            </div>
            {coffeeStation && (
              <div className="flex items-center gap-2 ml-6">
                <Checkbox id="cookies" checked={coffeeCookies} onCheckedChange={(v) => setCoffeeCookies(Boolean(v))} />
                <Label htmlFor="cookies">{t.form.cookiesLabel}{config ? ` — ${formatCurrency(config.cookies_price)}` : ""}</Label>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>{t.form.notesLabel}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.form.notesPlaceholder} rows={2} />
        </div>

        {/* Price summary */}
        {numDays > 0 && pricePerDay > 0 && (
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1 border-t border-outline-variant">
            <div className="flex justify-between text-on-surface-variant">
              <span>{t.form.basePriceLabel} ({numDays} {numDays === 1 ? "día" : "días"} × {formatCurrency(pricePerDay)}):</span>
              <span>{formatCurrency(basePrice)}</span>
            </div>
            {addonsPrice > 0 && <div className="flex justify-between text-on-surface-variant"><span>{t.form.addonsPriceLabel}:</span><span>{formatCurrency(addonsPrice)}</span></div>}
            <div className="flex justify-between font-semibold text-lg pt-1 border-t border-outline-variant">
              <span>{t.form.totalLabel}:</span>
              <span className="text-primary">{formatCurrency(totalPrice)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>{es.common.cancel}</Button>
          <Button type="submit" disabled={isSubmitting || !config}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{es.common.saving}</> : isEditing ? t.form.saveChanges : es.common.save}
          </Button>
        </div>
      </form>

      <CreateGuestModal open={isCreateGuestModalOpen} onOpenChange={setIsCreateGuestModalOpen}
        onGuestCreated={(g) => { setGuestId(g.id); setGuestOverride(g); setGuestSearchQuery(""); }} />
    </>
  );
}
