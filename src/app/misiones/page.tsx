"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, Loader2, RefreshCw, StopCircle, MessageSquare, Mail, Bell, PenLine, Sparkles, ChevronDown, ChevronRight, Plus, Pencil, Trash2, RotateCcw, Wand2, Play, X } from "lucide-react";

type Mission = {
  id: string;
  chat_id: string;
  chat_nombre: string | null;
  objetivo: string;
  estado: string;
  transcript: { rol: string; texto: string; ts?: string }[];
  intentos_seguimiento: number;
  followup_horas: number;
  last_reply_at: string | null;
  created_at: string;
};
type Proposal = {
  id: string; tipo: string; fuente: string; titulo: string; detalle: string; sugerencia: string; batch_num: number;
};

const ESTADO: Record<string, { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "bg-emerald-100 text-emerald-700" },
  lograda: { label: "Lograda ✓", cls: "bg-blue-100 text-blue-700" },
  pausada: { label: "Pausada", cls: "bg-amber-100 text-amber-700" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500" },
  borrador: { label: "Borrador", cls: "bg-slate-100 text-slate-500" },
  eliminada: { label: "Eliminada", cls: "bg-red-50 text-red-400" },
};
const TIPO_ICON: Record<string, typeof MessageSquare> = {
  responder: MessageSquare, correo_borrador: PenLine, mision: Target, recordatorio: Bell, coordinar: Bell,
};

export default function MisionesPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        fetch("/api/missions", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/proposals", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setMissions(m.missions ?? []);
      setProposals(p.proposals ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      await fetch("/api/proposals", { method: "POST" });
      await load();
    } catch {}
    setScanning(false);
  };

  const post = async (body: object) => {
    await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    await load();
  };
  const stop = (id: string) => post({ action: "stop", id });
  const del = (id: string) => post({ action: "estado", id, estado: "eliminada" });
  const revive = (id: string) => post({ action: "estado", id, estado: "pausada" });
  const start = (id: string) => post({ action: "estado", id, estado: "activa" });

  // Formulario crear/editar
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fObjetivo, setFObjetivo] = useState("");
  const [fContacto, setFContacto] = useState("");
  const [fHoras, setFHoras] = useState("2");
  const [showDeleted, setShowDeleted] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [sugerencias, setSugerencias] = useState<{ objetivo: string; quien?: string }[]>([]);

  const openNew = () => { setEditId(null); setFObjetivo(""); setFContacto(""); setFHoras("2"); setShowForm(true); };
  const openEdit = (m: Mission) => { setEditId(m.id); setFObjetivo(m.objetivo); setFContacto(m.chat_nombre || m.chat_id || ""); setFHoras(String(m.followup_horas || 2)); setShowForm(true); };
  const saveForm = async () => {
    if (!fObjetivo.trim()) return;
    if (editId) await post({ action: "edit", id: editId, objetivo: fObjetivo, chat_nombre: fContacto, followup_horas: Number(fHoras) || 2 });
    else await post({ action: "create", objetivo: fObjetivo, chat_id: fContacto, nombre: fContacto, followup_horas: Number(fHoras) || 2 });
    setShowForm(false);
  };
  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest" }) });
      const j = await r.json();
      setSugerencias(j.sugerencias ?? []);
    } catch {}
    setSuggesting(false);
  };
  const useSuggestion = (s: { objetivo: string; quien?: string }) => { setEditId(null); setFObjetivo(s.objetivo); setFContacto(s.quien || ""); setFHoras("2"); setShowForm(true); };

  const activas = missions.filter((m) => m.estado === "activa" || m.estado === "pausada" || m.estado === "borrador");
  const cerradas = missions.filter((m) => m.estado === "lograda" || m.estado === "cancelada");
  const eliminadas = missions.filter((m) => m.estado === "eliminada");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <Target className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Misiones & Propuestas</h1>
          <p className="text-sm text-slate-500">Lo que Alfred gestiona por vos y lo que te sugiere hacer.</p>
        </div>
        <button onClick={suggest} disabled={suggesting} title="Que Alfred invente misiones"
          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">
          {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Alfred inventá
        </button>
        <button onClick={openNew} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
          <Plus className="h-3.5 w-3.5" /> Nueva
        </button>
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{editId ? "Editar misión" : "Nueva misión"}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <label className="mb-1 block text-xs text-slate-500">Objetivo</label>
          <input value={fObjetivo} onChange={(e) => setFObjetivo(e.target.value)} placeholder="conseguir la garantía de la aspiradora"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">Contacto (número o nombre)</label>
              <input value={fContacto} onChange={(e) => setFContacto(e.target.value)} placeholder="+56 9 1234 5678"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-slate-500">Cada (h)</label>
              <input value={fHoras} onChange={(e) => setFHoras(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={saveForm} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">{editId ? "Guardar" : "Crear (queda en pausa)"}</button>
            <p className="text-xs text-slate-400">Se crea en pausa. Para que Alfred escriba, decile por WhatsApp o tocá ▶.</p>
          </div>
        </div>
      )}

      {/* Sugerencias de Alfred */}
      {sugerencias.length > 0 && (
        <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-violet-700"><Wand2 className="h-4 w-4" /> Misiones que propone Alfred</h3>
            <button onClick={() => setSugerencias([])} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1.5">
            {sugerencias.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="flex-1 text-slate-700">{s.objetivo}{s.quien ? <span className="text-slate-400"> · {s.quien}</span> : null}</span>
                <button onClick={() => useSuggestion(s)} className="rounded-lg border border-indigo-200 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50">Crear</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROPUESTAS PROACTIVAS */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-amber-500" /> Alfred te propone
          </h2>
          <button onClick={scan} disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Revisar WhatsApp y correos
          </button>
        </div>
        {proposals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
            Sin propuestas pendientes. Tocá “Revisar WhatsApp y correos” y Alfred te sugiere qué gestionar.
          </p>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => {
              const Icon = TIPO_ICON[p.tipo] ?? MessageSquare;
              return (
                <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600">{p.batch_num}</span>
                      <p className="truncate text-sm font-medium text-slate-800">{p.titulo}</p>
                      {p.fuente === "correo" ? <Mail className="h-3.5 w-3.5 text-slate-400" /> : <MessageSquare className="h-3.5 w-3.5 text-slate-400" />}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{p.sugerencia}</p>
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-center text-xs text-slate-400">
              Aprobalas por WhatsApp: decile a Alfred <b>“hacé la 1 y la 3”</b> o <b>“hacé todas”</b>.
            </p>
          </div>
        )}
      </div>

      {/* MISIONES ACTIVAS */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Misiones en curso</h2>
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
      ) : activas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          No hay misiones activas. Pedile a Alfred: “encargate de conseguir la garantía con +56 9… cada 2 horas”.
        </p>
      ) : (
        <div className="space-y-2">
          {activas.map((m) => {
            const e = ESTADO[m.estado] ?? ESTADO.borrador;
            const isOpen = open[m.id];
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} className="mt-0.5 text-slate-400 hover:text-slate-600">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{m.chat_nombre || m.chat_id}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${e.cls}`}>{e.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{m.objetivo}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {m.intentos_seguimiento || 0} seguimientos · cada {m.followup_horas}h · {m.last_reply_at ? "con respuesta" : "sin respuesta aún"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(m.estado === "pausada" || m.estado === "borrador") && (
                      <button onClick={() => start(m.id)} title="Iniciar (Alfred escribe)" className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50"><Play className="h-3.5 w-3.5" /></button>
                    )}
                    {m.estado === "activa" && (
                      <button onClick={() => stop(m.id)} title="Frenar" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"><StopCircle className="h-3.5 w-3.5" /></button>
                    )}
                    <button onClick={() => openEdit(m)} title="Editar" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(m.id)} title="Eliminar" className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    {(m.transcript || []).length === 0 ? (
                      <p className="text-xs text-slate-400">Sin mensajes todavía.</p>
                    ) : (
                      <div className="space-y-2">
                        {m.transcript.map((t, i) => (
                          <div key={i} className={`flex ${t.rol === "alfred" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${t.rol === "alfred" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                              {t.texto}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CERRADAS */}
      {cerradas.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Cerradas</h2>
          <div className="space-y-1.5">
            {cerradas.map((m) => {
              const e = ESTADO[m.estado] ?? ESTADO.borrador;
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${e.cls}`}>{e.label}</span>
                  <span className="text-slate-600">{m.chat_nombre || m.chat_id}</span>
                  <span className="flex-1 truncate text-slate-400">— {m.objetivo}</span>
                  <button onClick={() => revive(m.id)} title="Revivir" className="shrink-0 rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><RotateCcw className="h-3.5 w-3.5" /></button>
                  <button onClick={() => del(m.id)} title="Eliminar" className="shrink-0 rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ELIMINADAS (toggle) */}
      {eliminadas.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDeleted((v) => !v)} className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
            {showDeleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Eliminadas ({eliminadas.length})
          </button>
          {showDeleted && (
            <div className="space-y-1.5">
              {eliminadas.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-400 line-through">{m.chat_nombre || m.chat_id}</span>
                  <span className="flex-1 truncate text-slate-400">— {m.objetivo}</span>
                  <button onClick={() => revive(m.id)} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"><RotateCcw className="h-3 w-3" /> Revivir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
