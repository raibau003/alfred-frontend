"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell, Plus, Trash2, Check, Clock, Calendar, Pencil, X, Loader2, RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Alfred vive en el WhatsApp de Javier; los recordatorios se guardan por chat_id.
const CHATS = ["56998293288@c.us", "76914358263914@lid"];

const CATS = ["personal", "trabajo", "colegio", "salud", "casa", "compras", "finanzas", "otro"] as const;
const CAT_META: Record<string, { icon: string; color: string }> = {
  personal: { icon: "🔵", color: "bg-blue-100 text-blue-700" },
  trabajo: { icon: "💼", color: "bg-purple-100 text-purple-700" },
  colegio: { icon: "🎒", color: "bg-amber-100 text-amber-700" },
  salud: { icon: "🩺", color: "bg-red-100 text-red-700" },
  casa: { icon: "🏠", color: "bg-green-100 text-green-700" },
  compras: { icon: "🛒", color: "bg-pink-100 text-pink-700" },
  finanzas: { icon: "💳", color: "bg-emerald-100 text-emerald-700" },
  otro: { icon: "⚪", color: "bg-slate-100 text-slate-600" },
};

interface Reminder {
  id: string;
  texto: string;
  tipo: string;
  categoria: string | null;
  remind_at: string | null;
  recurrencia: string;
  estado: string;
  outlook_event_id?: string | null;
}

// UTC ISO -> value para <input type="datetime-local"> en hora de Chile (UTC-4)
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 4 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
// value del input (hora Chile) -> UTC ISO
function localInputToIso(v: string): string | null {
  if (!v) return null;
  return new Date(new Date(v).getTime() + 4 * 3600 * 1000).toISOString();
}
function fmtChile(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(new Date(iso).getTime() - 4 * 3600 * 1000).toLocaleString("es-CL", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function RecordatoriosPage() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const estados = showDone ? ["pendiente", "enviado", "hecho"] : ["pendiente", "enviado"];
    const { data } = await supabase
      .from("reminders")
      .select("id,texto,tipo,categoria,remind_at,recurrencia,estado,outlook_event_id")
      .in("chat_id", CHATS)
      .in("estado", estados)
      .order("remind_at", { ascending: true, nullsFirst: false })
      .limit(300);
    setItems((data as Reminder[]) || []);
    setLoading(false);
  }, [supabase, showDone]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, changes: Partial<Reminder>) => {
    await supabase.from("reminders").update(changes).eq("id", id);
    load();
  };
  const complete = (id: string) => patch(id, { estado: "hecho" });
  const reactivate = (id: string) => patch(id, { estado: "pendiente" });
  const remove = async (id: string) => {
    await supabase.from("reminders").update({ estado: "cancelado" }).eq("id", id);
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from("reminders").update({
      texto: editing.texto,
      categoria: editing.categoria,
      remind_at: editing.remind_at,
      estado: "pendiente",
    }).eq("id", editing.id);
    setEditing(null);
    load();
  };

  const createNew = async (r: Partial<Reminder>) => {
    await supabase.from("reminders").insert([{
      chat_id: CHATS[1], texto: r.texto, tipo: r.remind_at ? "recordatorio" : "tarea",
      categoria: r.categoria || "personal", remind_at: r.remind_at || null,
      recurrencia: "once", estado: "pendiente", origen: "frontend",
    }]);
    setCreating(false);
    load();
  };

  // Agrupar por Hoy / Esta semana / Más adelante / Sin fecha
  const now = Date.now();
  const groups: Record<string, Reminder[]> = { hoy: [], semana: [], despues: [], sinfecha: [], hechos: [] };
  for (const r of items) {
    if (r.estado === "hecho") { groups.hechos.push(r); continue; }
    if (!r.remind_at) { groups.sinfecha.push(r); continue; }
    const t = new Date(r.remind_at).getTime();
    const chileHoy = new Date(now - 4 * 3600 * 1000).toISOString().slice(0, 10);
    const rHoy = new Date(t - 4 * 3600 * 1000).toISOString().slice(0, 10);
    if (rHoy === chileHoy) groups.hoy.push(r);
    else if (t <= now + 7 * 86400000) groups.semana.push(r);
    else groups.despues.push(r);
  }

  const Row = ({ r }: { r: Reminder }) => {
    const cat = CAT_META[r.categoria || "personal"] || CAT_META.otro;
    const done = r.estado === "hecho";
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:shadow-sm">
        <button
          onClick={() => (done ? reactivate(r.id) : complete(r.id))}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-green-500 bg-green-500 text-white" : "border-slate-300 hover:border-green-400"}`}
          title={done ? "Reactivar" : "Marcar hecho"}
        >
          {done ? <Check className="h-4 w-4" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{r.texto}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className={`rounded px-1.5 py-0.5 ${cat.color}`}>{cat.icon} {r.categoria || "personal"}</span>
            {r.remind_at && (<span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtChile(r.remind_at)}</span>)}
            {r.recurrencia !== "once" && <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" />{r.recurrencia}</span>}
            {r.outlook_event_id && <span className="inline-flex items-center gap-1 text-blue-500"><Calendar className="h-3 w-3" />en calendario</span>}
          </div>
        </div>
        {done && (
          <button onClick={() => reactivate(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-emerald-50 hover:text-emerald-600" title="Volver a pendiente"><RotateCcw className="h-3.5 w-3.5" /> Pendiente</button>
        )}
        <button onClick={() => setEditing({ ...r })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => remove(r.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Borrar"><Trash2 className="h-4 w-4" /></button>
      </div>
    );
  };

  const Section = ({ title, rows }: { title: string; rows: Reminder[] }) =>
    rows.length ? (
      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title} · {rows.length}</h2>
        <div className="space-y-2">{rows.map((r) => <Row key={r.id} r={r} />)}</div>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-800">Recordatorios y tareas</h1>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          <button onClick={() => setShowDone(false)}
            className={`px-3 py-1.5 text-sm font-medium ${!showDone ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            Pendientes
          </button>
          <button onClick={() => setShowDone(true)}
            className={`px-3 py-1.5 text-sm font-medium ${showDone ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            Completados
          </button>
        </div>
        <button onClick={load} className="ml-auto text-slate-400 hover:text-slate-700" title="Recargar"><RotateCcw className="h-4 w-4" /></button>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Tocá el círculo para marcar como <b>hecho</b>; tocá el círculo verde de un completado para <b>volverlo a pendiente</b>.
      </p>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center text-slate-400">
          No tienes recordatorios. Pídeselos a Alfred por WhatsApp o crea uno con “Nuevo”.
        </div>
      ) : (
        <>
          <Section title="⏰ Hoy" rows={groups.hoy} />
          <Section title="📅 Esta semana" rows={groups.semana} />
          <Section title="🗓️ Más adelante" rows={groups.despues} />
          <Section title="📝 Tareas (sin fecha)" rows={groups.sinfecha} />
          {showDone && <Section title="✅ Completados" rows={groups.hechos} />}
        </>
      )}

      {(editing || creating) && (
        <EditModal
          reminder={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaveEdit={(r) => { setEditing(r); saveEdit(); }}
          onCreate={createNew}
        />
      )}
    </div>
  );
}

function EditModal({
  reminder, onClose, onSaveEdit, onCreate,
}: {
  reminder: Reminder | null;
  onClose: () => void;
  onSaveEdit: (r: Reminder) => void;
  onCreate: (r: Partial<Reminder>) => void;
}) {
  const [texto, setTexto] = useState(reminder?.texto || "");
  const [categoria, setCategoria] = useState(reminder?.categoria || "personal");
  const [local, setLocal] = useState(isoToLocalInput(reminder?.remind_at || null));

  const save = () => {
    const remind_at = local ? localInputToIso(local) : null;
    if (reminder) onSaveEdit({ ...reminder, texto, categoria, remind_at });
    else onCreate({ texto, categoria, remind_at });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{reminder ? "Editar recordatorio" : "Nuevo recordatorio"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Qué</label>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: llamar al dentista"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <label className="mb-1 block text-xs font-medium text-slate-500">Fecha y hora (opcional = tarea sin hora)</label>
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCategoria(c)}
              className={`rounded-full px-3 py-1 text-xs ${categoria === c ? "ring-2 ring-brand-500 " + (CAT_META[c]?.color || "") : "bg-slate-100 text-slate-600"}`}>
              {CAT_META[c]?.icon} {c}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button onClick={save} disabled={!texto.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Guardar</button>
        </div>
      </div>
    </div>
  );
}
