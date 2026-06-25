import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import { useSalonConfig, type SalonConfigInput } from "@/hooks/useSalonConfig";
import { useSalonSlots, type SalonSlot, type NewSalonSlotInput } from "@/hooks/useSalonSlots";
import { useSalonMenus, type SalonMenu, type NewSalonMenuInput } from "@/hooks/useSalonMenus";
import { useSalonSpaces, useSalonSpaceRates, type SalonSpace } from "@/hooks/useSalonSpaces";
import { useSalonResources, type SalonResource, type NewSalonResourceInput } from "@/hooks/useSalonResources";

const t = es.salonPage;

const PILL_ACTIVE   = "inline-flex items-center px-2 py-0.5 rounded-full text-label-md bg-[#e6f4ea] text-[#137333]";
const PILL_INACTIVE = "inline-flex items-center px-2 py-0.5 rounded-full text-label-md bg-surface-variant text-on-surface-variant";

const pill = (active: boolean) => <span className={active ? PILL_ACTIVE : PILL_INACTIVE}>{active ? "Activo" : "Inactivo"}</span>;

const cardHeader = (icon: string, title: string, btnLabel: string, onClick: () => void) => (
  <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
      <h3 className="text-headline-md font-semibold text-on-surface">{title}</h3>
    </div>
    <button
      onClick={onClick}
      className="border border-primary text-primary text-label-md px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-[16px]">add</span>{btnLabel}
    </button>
  </div>
);

const tableHead = (...cols: string[]) => (
  <thead className="bg-surface-container-low border-b border-outline-variant">
    <tr>
      {cols.map((c) => (
        <th key={c} className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant font-normal uppercase tracking-wider">
          {c}
        </th>
      ))}
    </tr>
  </thead>
);

const editBtn = (onClick: () => void) => (
  <button onClick={onClick} className="text-outline hover:text-primary transition-colors">
    <span className="material-symbols-outlined text-[18px]">edit</span>
  </button>
);

// ── Catering form ─────────────────────────────────────────────────────────────
function CateringForm() {
  const { config, loading, saveConfig } = useSalonConfig();
  const empty: SalonConfigInput = { coffee_price_per_person: 0, coffee_min_attendees: 30, cookies_price: 0 };
  const [form, setForm] = useState<SalonConfigInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) setForm({
      coffee_price_per_person: config.coffee_price_per_person,
      coffee_min_attendees: config.coffee_min_attendees,
      cookies_price: config.cookies_price,
    });
  }, [config]);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" />{es.common.loading}</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try { await saveConfig(form); toast.success(t.config.saved); }
        catch { toast.error(es.common.unexpectedError); }
        finally { setSaving(false); }
      }}
      className="flex flex-col gap-4"
    >
      {[
        { key: "coffee_price_per_person" as const, label: t.config.coffeePricePerPerson, isInt: false },
        { key: "coffee_min_attendees"    as const, label: t.config.coffeeMinAttendees,   isInt: true  },
        { key: "cookies_price"           as const, label: t.config.cookiesPrice,         isInt: false },
      ].map(({ key, label, isInt }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-label-bold text-on-surface-variant uppercase tracking-wider">{label}</label>
          <Input
            type="number" min={0} step={isInt ? 1 : 0.01}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: isInt ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0 }))}
            className="bg-transparent"
          />
        </div>
      ))}
      <Button type="submit" disabled={saving} className="mt-4 gap-2">
        <span className="material-symbols-outlined text-[18px]">save</span>
        {saving ? es.common.saving : t.config.save}
      </Button>
    </form>
  );
}

// ── Resource dialog ───────────────────────────────────────────────────────────
function ResourceDialog({ open, onOpenChange, editing, onCreate, onUpdate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: SalonResource | null;
  onCreate: (i: NewSalonResourceInput) => Promise<void>;
  onUpdate: (id: string, i: Partial<NewSalonResourceInput> & { is_active?: boolean }) => Promise<void>;
}) {
  const empty: NewSalonResourceInput = { name: "", description: "", price: 0, quantity: 1 };
  const [form, setForm] = useState<NewSalonResourceInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editing
      ? { name: editing.name, description: editing.description ?? "", price: editing.price, quantity: editing.quantity }
      : empty);
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>{editing ? "Editar recurso" : t.resources.newResource}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setSaving(true);
            try {
              editing ? await onUpdate(editing.id, form) : await onCreate(form);
              onOpenChange(false);
              toast.success(editing ? t.resources.updated : t.resources.created);
            } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1"><Label>{t.resources.name} *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-1"><Label>{t.resources.description}</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{t.resources.price} *</Label><Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} required /></div>
            <div className="space-y-1"><Label>{t.resources.quantity} *</Label><Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} required /></div>
          </div>
          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="res-active" checked={editing.is_active} onChange={(e) => onUpdate(editing.id, { is_active: e.target.checked })} className="rounded" />
              <Label htmlFor="res-active">Activo</Label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{es.common.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? es.common.saving : es.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Space rates sub-form ──────────────────────────────────────────────────────
function SpaceRatesForm({ spaceId, slots }: { spaceId: string; slots: SalonSlot[] }) {
  const { rates, loading, upsertRate } = useSalonSpaceRates(spaceId);
  const [saving, setSaving] = useState<string | null>(null);
  const rateFor = (slotId: string) => rates.find((r) => r.slot_id === slotId)?.price_per_day ?? 0;

  return (
    <div className="space-y-3 pt-3 border-t border-outline-variant">
      <p className="text-label-bold text-on-surface-variant uppercase tracking-wider">{t.spaces.ratesTitle}</p>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : slots.map((slot) => (
        <div key={slot.id} className="flex items-center gap-3">
          <span className="text-body-md text-foreground w-36 shrink-0">{slot.name} <span className="text-on-surface-variant text-body-sm">({slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)})</span></span>
          <Input type="number" min={0} step={0.01} defaultValue={rateFor(slot.id)} className="w-32 bg-transparent"
            onBlur={async (e) => {
              const price = parseFloat(e.target.value) || 0;
              setSaving(slot.id);
              try { await upsertRate(spaceId, slot.id, price); toast.success("Tarifa guardada"); }
              catch { toast.error(es.common.unexpectedError); } finally { setSaving(null); }
            }}
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
  onUpdate: (id: string, u: { name?: string; is_active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(editing?.name ?? ""); }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader><DialogTitle>{editing ? editing.name : t.spaces.newSpace}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setSaving(true);
            try {
              editing ? await onUpdate(editing.id, { name }) : await onCreate(name);
              if (!editing) onOpenChange(false);
              toast.success(editing ? t.spaces.updated : t.spaces.created);
            } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1"><Label>{t.spaces.name} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sp-active" checked={editing.is_active} onChange={(e) => onUpdate(editing.id, { is_active: e.target.checked })} className="rounded" />
              <Label htmlFor="sp-active">Activo</Label>
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
  open: boolean; onOpenChange: (v: boolean) => void; editing: SalonSlot | null;
  onCreate: (i: NewSalonSlotInput) => Promise<void>;
  onUpdate: (id: string, i: Partial<NewSalonSlotInput> & { is_active?: boolean }) => Promise<void>;
}) {
  const empty: NewSalonSlotInput = { name: "", start_time: "", end_time: "", price_per_day: 0 };
  const [form, setForm] = useState<NewSalonSlotInput>(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(editing ? { name: editing.name, start_time: editing.start_time.slice(0, 5), end_time: editing.end_time.slice(0, 5), price_per_day: editing.price_per_day } : empty); }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader><DialogTitle>{editing ? "Editar slot" : t.slots.newSlot}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setSaving(true);
            try {
              editing ? await onUpdate(editing.id, form) : await onCreate(form);
              onOpenChange(false);
              toast.success(editing ? t.slots.updated : t.slots.created);
            } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1"><Label>{t.slots.name} *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
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
  open: boolean; onOpenChange: (v: boolean) => void; editing: SalonMenu | null;
  onCreate: (i: NewSalonMenuInput) => Promise<void>;
  onUpdate: (id: string, i: Partial<NewSalonMenuInput> & { is_active?: boolean }) => Promise<void>;
}) {
  const empty: NewSalonMenuInput = { name: "", price_per_person: 0 };
  const [form, setForm] = useState<NewSalonMenuInput>(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(editing ? { name: editing.name, price_per_person: editing.price_per_person } : empty); }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader><DialogTitle>{editing ? "Editar menú" : t.menus.newMenu}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setSaving(true);
            try {
              editing ? await onUpdate(editing.id, form) : await onCreate(form);
              onOpenChange(false);
              toast.success(editing ? t.menus.updated : t.menus.created);
            } catch { toast.error(es.common.unexpectedError); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1"><Label>{t.menus.name} *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-1"><Label>{t.menus.pricePerPerson} *</Label><Input type="number" min={0} step={0.01} value={form.price_per_person} onChange={(e) => setForm((f) => ({ ...f, price_per_person: parseFloat(e.target.value) || 0 }))} required /></div>
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
  const { resources, createResource, updateResource } = useSalonResources();
  const { spaces, createSpace, updateSpace } = useSalonSpaces();
  const { slots, createSlot, updateSlot } = useSalonSlots();
  const { menus, createMenu, updateMenu } = useSalonMenus();

  const [resourceDialog, setResourceDialog] = useState<{ open: boolean; editing: SalonResource | null }>({ open: false, editing: null });
  const [spaceDialog,    setSpaceDialog]    = useState<{ open: boolean; editing: SalonSpace   | null }>({ open: false, editing: null });
  const [slotDialog,     setSlotDialog]     = useState<{ open: boolean; editing: SalonSlot    | null }>({ open: false, editing: null });
  const [menuDialog,     setMenuDialog]     = useState<{ open: boolean; editing: SalonMenu    | null }>({ open: false, editing: null });

  const tableCard = (icon: string, title: string, btnLabel: string, onAdd: () => void, content: React.ReactNode) => (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col">
      {cardHeader(icon, title, btnLabel, onAdd)}
      {content}
    </div>
  );

  const emptyRow = (msg: string) => (
    <p className="text-center py-8 text-on-surface-variant text-body-md">{msg}</p>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-stack_gap_md">
      {/* Left: Catering */}
      <div className="md:col-span-1">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-[24px]">coffee</span>
            <h3 className="text-headline-md font-semibold text-on-surface">{t.config.title}</h3>
          </div>
          <CateringForm />
        </div>
      </div>

      {/* Right: stacked tables */}
      <div className="md:col-span-2 flex flex-col gap-stack_gap_md">

        {/* Recursos */}
        {tableCard("inventory_2", t.resources.title, t.resources.newResource, () => setResourceDialog({ open: true, editing: null }),
          resources.length === 0 ? emptyRow(t.resources.noResources) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {tableHead("Nombre", "Descripción", "Precio", "Unidades", "Estado", "Acciones")}
                <tbody className="text-table-data text-on-surface divide-y divide-outline-variant/50">
                  {resources.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{r.name}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-on-surface-variant">{r.description ?? "—"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{formatCurrency(r.price)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{r.quantity}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(r.is_active)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">{editBtn(() => setResourceDialog({ open: true, editing: r }))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Espacios */}
        {tableCard("meeting_room", t.spaces.title, t.spaces.newSpace, () => setSpaceDialog({ open: true, editing: null }),
          spaces.length === 0 ? emptyRow(t.spaces.noSpaces) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {tableHead("Nombre", "Estado", "Acciones")}
                <tbody className="text-table-data text-on-surface divide-y divide-outline-variant/50">
                  {spaces.map((sp) => (
                    <tr key={sp.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{sp.name}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(sp.is_active)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">{editBtn(() => setSpaceDialog({ open: true, editing: sp }))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Slots */}
        {tableCard("schedule", t.slots.title, t.slots.newSlot, () => setSlotDialog({ open: true, editing: null }),
          slots.length === 0 ? emptyRow(t.slots.noSlots) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {tableHead("Nombre", "Hora inicio", "Hora fin", "Estado", "Acciones")}
                <tbody className="text-table-data text-on-surface divide-y divide-outline-variant/50">
                  {slots.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{s.name}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-on-surface-variant">{s.start_time.slice(0, 5)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-on-surface-variant">{s.end_time.slice(0, 5)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(s.is_active)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">{editBtn(() => setSlotDialog({ open: true, editing: s }))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Menús */}
        {tableCard("restaurant", t.menus.title, t.menus.newMenu, () => setMenuDialog({ open: true, editing: null }),
          menus.length === 0 ? emptyRow(t.menus.noMenus) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {tableHead("Nombre", "Precio / persona", "Estado", "Acciones")}
                <tbody className="text-table-data text-on-surface divide-y divide-outline-variant/50">
                  {menus.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{m.name}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-on-surface-variant">{formatCurrency(m.price_per_person)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">{pill(m.is_active)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">{editBtn(() => setMenuDialog({ open: true, editing: m }))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <ResourceDialog open={resourceDialog.open} onOpenChange={(v) => setResourceDialog((s) => ({ ...s, open: v }))} editing={resourceDialog.editing} onCreate={createResource} onUpdate={updateResource} />
      <SpaceDialog    open={spaceDialog.open}    onOpenChange={(v) => setSpaceDialog((s)    => ({ ...s, open: v }))} editing={spaceDialog.editing}    slots={slots}  onCreate={createSpace}   onUpdate={updateSpace}    />
      <SlotDialog     open={slotDialog.open}     onOpenChange={(v) => setSlotDialog((s)     => ({ ...s, open: v }))} editing={slotDialog.editing}     onCreate={createSlot}    onUpdate={updateSlot}     />
      <MenuDialog     open={menuDialog.open}     onOpenChange={(v) => setMenuDialog((s)     => ({ ...s, open: v }))} editing={menuDialog.editing}     onCreate={createMenu}    onUpdate={updateMenu}     />
    </div>
  );
}
