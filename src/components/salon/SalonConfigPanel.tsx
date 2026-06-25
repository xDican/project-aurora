import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import { useSalonConfig, type SalonConfigInput } from "@/hooks/useSalonConfig";
import { useSalonSlots, type SalonSlot, type NewSalonSlotInput } from "@/hooks/useSalonSlots";
import { useSalonMenus, type SalonMenu, type NewSalonMenuInput } from "@/hooks/useSalonMenus";
import { useSalonSpaces, useSalonSpaceRates, type SalonSpace } from "@/hooks/useSalonSpaces";

const t = es.salonPage;

// ── Config form ──────────────────────────────────────────────────────────────
function SalonConfigForm() {
  const { config, loading, saveConfig } = useSalonConfig();
  const empty: SalonConfigInput = {
    projector_price: 0, screen_price: 0,
    audio_basic_price: 0, audio_complete_price: 0,
    coffee_price_per_person: 0, coffee_min_attendees: 30, cookies_price: 0,
    projector_count: 1, screen_count: 1, audio_count: 1,
  };
  const [form, setForm] = useState<SalonConfigInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) setForm({
      projector_price: config.projector_price,
      screen_price: config.screen_price,
      audio_basic_price: config.audio_basic_price,
      audio_complete_price: config.audio_complete_price,
      coffee_price_per_person: config.coffee_price_per_person,
      coffee_min_attendees: config.coffee_min_attendees,
      cookies_price: config.cookies_price,
      projector_count: config.projector_count,
      screen_count: config.screen_count,
      audio_count: config.audio_count,
    });
  }, [config]);

  const num = (key: keyof SalonConfigInput, label: string, isInt = false) => (
    <div className="space-y-1">
      <Label className="text-label-md text-on-surface-variant uppercase">{label}</Label>
      <Input type="number" min={0} step={isInt ? 1 : 0.01} value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: isInt ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0 }))}
        className="bg-surface-container-low" />
    </div>
  );

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" />{es.common.loading}</div>;

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await saveConfig(form); toast.success(t.config.saved); } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); } }} className="space-y-4">
      <p className="text-label-md text-on-surface-variant uppercase">Precios</p>
      <div className="grid grid-cols-2 gap-3">
        {num("projector_price", t.config.projectorPrice)}
        {num("screen_price", t.config.screenPrice)}
        {num("audio_basic_price", t.config.audiBasicPrice)}
        {num("audio_complete_price", t.config.audioCompletePrice)}
        {num("coffee_price_per_person", t.config.coffeePricePerPerson)}
        {num("coffee_min_attendees", t.config.coffeeMinAttendees, true)}
        {num("cookies_price", t.config.cookiesPrice)}
      </div>
      <p className="text-label-md text-on-surface-variant uppercase pt-2 border-t border-outline-variant">Inventario de recursos</p>
      <div className="grid grid-cols-3 gap-3">
        {num("projector_count", t.config.projectorCount, true)}
        {num("screen_count", t.config.screenCount, true)}
        {num("audio_count", t.config.audioCount, true)}
      </div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? es.common.saving : t.config.save}</Button>
    </form>
  );
}

// ── Space rates sub-form (inside space dialog) ────────────────────────────────
function SpaceRatesForm({ spaceId, slots }: { spaceId: string; slots: SalonSlot[] }) {
  const { rates, loading, upsertRate } = useSalonSpaceRates(spaceId);
  const [saving, setSaving] = useState<string | null>(null);

  const rateFor = (slotId: string) => rates.find((r) => r.slot_id === slotId)?.price_per_day ?? 0;

  return (
    <div className="space-y-3 pt-3 border-t border-outline-variant">
      <p className="text-label-md text-on-surface-variant uppercase">{t.spaces.ratesTitle}</p>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : slots.map((slot) => (
        <div key={slot.id} className="flex items-center gap-3">
          <span className="text-body-md text-foreground w-32 shrink-0">{slot.name} <span className="text-on-surface-variant text-body-sm">({slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)})</span></span>
          <Input type="number" min={0} step={0.01} defaultValue={rateFor(slot.id)}
            onBlur={async (e) => {
              const price = parseFloat(e.target.value) || 0;
              setSaving(slot.id);
              try { await upsertRate(spaceId, slot.id, price); toast.success("Tarifa guardada"); }
              catch { toast.error(es.common.unexpectedError); }
              finally { setSaving(null); }
            }}
            className="bg-surface-container-low w-36"
          />
          {saving === slot.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      ))}
      {slots.length === 0 && <p className="text-body-sm text-on-surface-variant">{t.slots.noSlots}</p>}
    </div>
  );
}

// ── Space dialog ──────────────────────────────────────────────────────────────
function SpaceDialog({ open, onOpenChange, editing, slots, onCreate, onUpdate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: SalonSpace | null; slots: SalonSlot[];
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, updates: { name?: string; is_active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(editing?.name ?? ""); }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) await onUpdate(editing.id, { name });
      else await onCreate(name);
      if (!editing) onOpenChange(false);
      toast.success(editing ? t.spaces.updated : t.spaces.created);
    } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? editing.name : t.spaces.newSpace}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>{t.spaces.name}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="space-active" checked={editing.is_active}
                onChange={(e) => onUpdate(editing.id, { is_active: e.target.checked })} className="rounded" />
              <Label htmlFor="space-active">Activo</Label>
            </div>
          )}
          {editing && <SpaceRatesForm spaceId={editing.id} slots={slots} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{es.common.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? es.common.saving : es.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Slot dialog ───────────────────────────────────────────────────────────────
function SlotDialog({ open, onOpenChange, editing, onCreate, onUpdate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: SalonSlot | null;
  onCreate: (input: NewSalonSlotInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<NewSalonSlotInput> & { is_active?: boolean }) => Promise<void>;
}) {
  const empty: NewSalonSlotInput = { name: "", start_time: "", end_time: "", price_per_day: 0 };
  const [form, setForm] = useState<NewSalonSlotInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editing ? { name: editing.name, start_time: editing.start_time.slice(0, 5), end_time: editing.end_time.slice(0, 5), price_per_day: editing.price_per_day } : empty);
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader><DialogTitle>{editing ? t.slots.name : t.slots.newSlot}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { editing ? await onUpdate(editing.id, form) : await onCreate(form); onOpenChange(false); toast.success(editing ? t.slots.updated : t.slots.created); } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); } }} className="space-y-3">
          <div className="space-y-1"><Label>{t.slots.name}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{t.slots.startTime}</Label><Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} required /></div>
            <div className="space-y-1"><Label>{t.slots.endTime}</Label><Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} required /></div>
          </div>
          {editing && <div className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => onUpdate(editing.id, { is_active: e.target.checked })} className="rounded" /><Label>Activo</Label></div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{es.common.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? es.common.saving : es.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Menu dialog ───────────────────────────────────────────────────────────────
function MenuDialog({ open, onOpenChange, editing, onCreate, onUpdate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: SalonMenu | null;
  onCreate: (input: NewSalonMenuInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<NewSalonMenuInput> & { is_active?: boolean }) => Promise<void>;
}) {
  const empty: NewSalonMenuInput = { name: "", price_per_person: 0 };
  const [form, setForm] = useState<NewSalonMenuInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(editing ? { name: editing.name, price_per_person: editing.price_per_person } : empty); }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader><DialogTitle>{editing ? t.menus.name : t.menus.newMenu}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { editing ? await onUpdate(editing.id, form) : await onCreate(form); onOpenChange(false); toast.success(editing ? t.menus.updated : t.menus.created); } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); } }} className="space-y-3">
          <div className="space-y-1"><Label>{t.menus.name}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-1"><Label>{t.menus.pricePerPerson}</Label><Input type="number" min={0} step={0.01} value={form.price_per_person} onChange={(e) => setForm((f) => ({ ...f, price_per_person: parseFloat(e.target.value) || 0 }))} required /></div>
          {editing && <div className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => onUpdate(editing.id, { is_active: e.target.checked })} className="rounded" /><Label>Activo</Label></div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{es.common.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? es.common.saving : es.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function SalonConfigPanel() {
  const { slots, createSlot, updateSlot } = useSalonSlots();
  const { menus, createMenu, updateMenu } = useSalonMenus();
  const { spaces, createSpace, updateSpace } = useSalonSpaces();
  const [spaceDialog, setSpaceDialog] = useState<{ open: boolean; editing: SalonSpace | null }>({ open: false, editing: null });
  const [slotDialog, setSlotDialog] = useState<{ open: boolean; editing: SalonSlot | null }>({ open: false, editing: null });
  const [menuDialog, setMenuDialog] = useState<{ open: boolean; editing: SalonMenu | null }>({ open: false, editing: null });

  const pill = (active: boolean) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-label-bold ${active ? "bg-[#DCFCE7] text-[#166534]" : "bg-surface-variant text-on-surface-variant"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Precios + inventario */}
      <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-primary">shopping_cart</span>
          <h3 className="text-headline-md font-semibold">{t.config.title}</h3>
        </div>
        <SalonConfigForm />
      </div>

      {/* Espacios, Slots, Menús */}
      <div className="lg:col-span-2 space-y-6">

        {/* Espacios */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-table_cell_padding_x py-4 border-b border-outline-variant">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">meeting_room</span><h3 className="text-headline-md font-semibold">{t.spaces.title}</h3></div>
            <Button size="sm" variant="outline" onClick={() => setSpaceDialog({ open: true, editing: null })} className="gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span>{t.spaces.newSpace}
            </Button>
          </div>
          {spaces.length === 0 ? <p className="text-center py-8 text-on-surface-variant">{t.spaces.noSpaces}</p> : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  {[t.spaces.name, "Estado", es.common.actions].map((h) => (
                    <th key={h} className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {spaces.map((sp) => (
                  <tr key={sp.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data">{sp.name}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(sp.is_active)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      <button onClick={() => setSpaceDialog({ open: true, editing: sp })} className="p-1 text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Slots */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-table_cell_padding_x py-4 border-b border-outline-variant">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">schedule</span><h3 className="text-headline-md font-semibold">{t.slots.title}</h3></div>
            <Button size="sm" variant="outline" onClick={() => setSlotDialog({ open: true, editing: null })} className="gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span>{t.slots.newSlot}
            </Button>
          </div>
          {slots.length === 0 ? <p className="text-center py-8 text-on-surface-variant">{t.slots.noSlots}</p> : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>{[t.slots.name, t.slots.startTime, t.slots.endTime, "Estado", es.common.actions].map((h) => <th key={h} className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {slots.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data">{s.name}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{s.start_time.slice(0, 5)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{s.end_time.slice(0, 5)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(s.is_active)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      <button onClick={() => setSlotDialog({ open: true, editing: s })} className="p-1 text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Menús */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-table_cell_padding_x py-4 border-b border-outline-variant">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">restaurant</span><h3 className="text-headline-md font-semibold">{t.menus.title}</h3></div>
            <Button size="sm" variant="outline" onClick={() => setMenuDialog({ open: true, editing: null })} className="gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span>{t.menus.newMenu}
            </Button>
          </div>
          {menus.length === 0 ? <p className="text-center py-8 text-on-surface-variant">{t.menus.noMenus}</p> : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>{[t.menus.name, t.menus.pricePerPerson, "Estado", es.common.actions].map((h) => <th key={h} className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {menus.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data">{m.name}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{formatCurrency(m.price_per_person)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(m.is_active)}</td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      <button onClick={() => setMenuDialog({ open: true, editing: m })} className="p-1 text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SpaceDialog open={spaceDialog.open} onOpenChange={(v) => setSpaceDialog((s) => ({ ...s, open: v }))} editing={spaceDialog.editing} slots={slots} onCreate={createSpace} onUpdate={updateSpace} />
      <SlotDialog open={slotDialog.open} onOpenChange={(v) => setSlotDialog((s) => ({ ...s, open: v }))} editing={slotDialog.editing} onCreate={createSlot} onUpdate={updateSlot} />
      <MenuDialog open={menuDialog.open} onOpenChange={(v) => setMenuDialog((s) => ({ ...s, open: v }))} editing={menuDialog.editing} onCreate={createMenu} onUpdate={updateMenu} />
    </div>
  );
}
