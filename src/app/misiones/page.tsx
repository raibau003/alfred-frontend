"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, Loader2, RefreshCw, StopCircle, MessageSquare, Mail, Bell, PenLine, Sparkles, ChevronDown, ChevronRight } from "lucide-react";

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

  const stop = async (id: string) => {
    await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    await load();
  };

  const activas = missions.filter((m) => m.estado === "activa" || m.estado === "pausada");
  const cerradas = missions.filter((m) => m.estado === "lograda" || m.estado === "cancelada");

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
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

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
                  <button onClick={() => stop(m.id)} title="Frenar misión"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600">
                    <StopCircle className="h-3.5 w-3.5" /> Frenar
                  </button>
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
                  <span className="truncate text-slate-400">— {m.objetivo}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
