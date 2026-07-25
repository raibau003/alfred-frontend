"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Smartphone, Loader2, CheckCircle2, RefreshCw, Power, QrCode } from "lucide-react";

// Bridge de WhatsApp (WAHA). La 2ª sesión "alfred" es la línea propia de Alfred.
const BRIDGE_URL =
  process.env.NEXT_PUBLIC_ALFRED_BRIDGE_URL ??
  "https://whatsapp-bridge-production-426f.up.railway.app";

type Status =
  | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "STOPPED" | "UNKNOWN" | "OFFLINE";

const STATUS_META: Record<string, { label: string; color: string }> = {
  STARTING: { label: "Iniciando…", color: "text-amber-600" },
  SCAN_QR_CODE: { label: "Esperando que escanees el QR", color: "text-blue-600" },
  WORKING: { label: "Vinculado y funcionando", color: "text-emerald-600" },
  FAILED: { label: "Falló — reiniciá la vinculación", color: "text-red-600" },
  STOPPED: { label: "Detenida", color: "text-slate-500" },
  UNKNOWN: { label: "Estado desconocido", color: "text-slate-500" },
  OFFLINE: { label: "No pude contactar el bridge", color: "text-red-600" },
};

export default function LineaAlfredPage() {
  const [status, setStatus] = useState<Status>("STOPPED");
  const [me, setMe] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [qrTs, setQrTs] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BRIDGE_URL}/alfred-line/status`, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      setStatus((d.status as Status) || "UNKNOWN");
      setMe(d?.me?.pushName || d?.me?.id || null);
    } catch {
      setStatus("OFFLINE");
    }
  }, []);

  // Poll de estado cada 3s
  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [checkStatus]);

  // El QR de WhatsApp rota cada ~20s: refrescar la imagen mientras esté en SCAN_QR_CODE
  useEffect(() => {
    if (status !== "SCAN_QR_CODE") return;
    const t = setInterval(() => setQrTs(Date.now()), 18000);
    return () => clearInterval(t);
  }, [status]);

  const start = async () => {
    setStarting(true);
    try {
      await fetch(`${BRIDGE_URL}/alfred-line/start`, { method: "POST", signal: AbortSignal.timeout(15000) });
      setQrTs(Date.now());
      await checkStatus();
    } catch {
      setStatus("OFFLINE");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    setStarting(true);
    try {
      await fetch(`${BRIDGE_URL}/alfred-line/stop`, { method: "POST", signal: AbortSignal.timeout(10000) });
      await checkStatus();
    } catch {}
    setStarting(false);
  };

  const meta = STATUS_META[status] ?? STATUS_META.UNKNOWN;
  const showQR = status === "SCAN_QR_CODE";
  const working = status === "WORKING";

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Línea propia de Alfred</h1>
          <p className="text-sm text-slate-500">Un número de WhatsApp dedicado para hablar con Alfred, aparte del tuyo.</p>
        </div>
      </div>

      {/* Estado */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          {working ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            : status === "OFFLINE" || status === "FAILED" ? <Power className="h-5 w-5 text-red-600" />
            : <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
        </div>
        <button onClick={checkStatus} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {/* Vinculado */}
      {working && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
          <p className="font-medium text-emerald-800">Alfred ya tiene su número.{me ? ` (${me})` : ""}</p>
          <p className="mt-1 text-sm text-emerald-700">Escribile a ese número por WhatsApp y te responde como Alfred.</p>
          <button onClick={stop} disabled={starting}
            className="mt-4 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            Desvincular / reiniciar
          </button>
        </div>
      )}

      {/* QR para escanear */}
      {showQR && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="mb-3 text-sm text-slate-600">
            En el teléfono con la <b>SIM nueva</b>: WhatsApp → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b> → escaneá esto.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={qrTs}
            src={`${BRIDGE_URL}/alfred-line/qr?ts=${qrTs}`}
            alt="QR de la línea de Alfred"
            className="mx-auto h-64 w-64 rounded-lg border border-slate-200"
          />
          <p className="mt-3 text-xs text-slate-400">El QR se refresca solo cada ~18s.</p>
        </div>
      )}

      {/* Iniciar (detenida / offline / fallida) */}
      {!working && !showQR && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <QrCode className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="mb-1 text-sm text-slate-600">
            Cuando tengas la SIM nueva puesta en un teléfono, tocá <b>Iniciar</b> y te mostramos el QR para vincular a Alfred.
          </p>
          <p className="mb-4 text-xs text-slate-400">
            {status === "OFFLINE" ? "No hay conexión con el bridge — reintentá en unos segundos." : "Podés hacerlo cuando quieras; no se manda nada todavía."}
          </p>
          <button onClick={start} disabled={starting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Iniciar línea de Alfred
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Privada: pensada para que solo vos le escribas. Alfred no le escribe a desconocidos desde este número.
      </p>
    </div>
  );
}
