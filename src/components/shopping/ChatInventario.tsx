"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mic, Send, Square, Loader2, Check, X } from "lucide-react";
import {
  escanearFoto, escanearAudio, escanearTexto, aplicarEscaneo,
  type PropuestaInventario, type PropuestaEscaneo,
} from "@/lib/alfred/client";

// Contarle a Alfred qué hay en la cocina hablando, sacando una foto o escribiendo.
//
// La regla que gobierna las tres vías: PROPONEN, no guardan. Aparece lo que entendió y
// alguien confirma. Un audio mal transcrito y una foto mal leída fallan de maneras
// distintas pero se corrigen igual —mirando la lista— y aceptar en silencio significa
// descubrir el error semanas después, cuando la lista de compras pida algo que ya había.
//
// Por eso también se muestra el TRANSCRITO del audio: si entendió mal, ver qué oyó es la
// única forma de saber si el problema fue escuchar o interpretar.

type Turno =
  | { yo: true; texto: string; adjunto?: "foto" | "audio" }
  | { yo: false; resultado: PropuestaInventario; aplicado?: boolean };

const MIME_AUDIO = ["audio/webm", "audio/mp4", "audio/ogg"];

function aBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

export function ChatInventario({ onAplicado }: { onAplicado: () => void }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [permiso, setPermiso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turnos]);

  // Al desmontar hay que soltar el micrófono: si no, el navegador queda con el punto rojo
  // encendido y la pestaña "escuchando" aunque nadie esté grabando.
  useEffect(() => () => {
    recRef.current?.stream.getTracks().forEach(t => t.stop());
  }, []);

  const responder = useCallback((r: PropuestaInventario) => {
    setTurnos(t => [...t, { yo: false, resultado: r }]);
  }, []);

  const mandarTexto = async () => {
    const t = texto.trim();
    if (!t || ocupado) return;
    setTexto(""); setOcupado(true);
    setTurnos(x => [...x, { yo: true, texto: t }]);
    responder(await escanearTexto(t));
    setOcupado(false);
  };

  const mandarFoto = async (f: File) => {
    setOcupado(true);
    setTurnos(x => [...x, { yo: true, texto: f.name, adjunto: "foto" }]);
    responder(await escanearFoto(await aBase64(f), f.type || "image/jpeg"));
    setOcupado(false);
  };

  const empezarGrabacion = async () => {
    setPermiso(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MIME_AUDIO.find(m => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        // Un audio de medio segundo es casi siempre un clic accidental. Whisper devolvería
        // ruido y el modelo inventaría ingredientes sobre ese ruido.
        if (blob.size < 2000) { setPermiso("El audio salió muy corto. Mantené apretado el micrófono mientras hablás."); return; }
        setOcupado(true);
        setTurnos(x => [...x, { yo: true, texto: "audio", adjunto: "audio" }]);
        responder(await escanearAudio(await aBase64(blob), rec.mimeType || "audio/webm"));
        setOcupado(false);
      };
      rec.start();
      recRef.current = rec;
      setGrabando(true);
    } catch {
      // El navegador no dice por qué falló; lo más común es el permiso denegado.
      setPermiso("No pude usar el micrófono. Revisá el permiso del sitio, o escribime qué hay.");
    }
  };

  const pararGrabacion = () => {
    recRef.current?.stop();
    setGrabando(false);
  };

  const aplicar = async (i: number, r: PropuestaInventario) => {
    const body = r.para_aplicar?.body as { items?: unknown[]; zona?: string } | undefined;
    if (!body?.items?.length) return;
    setOcupado(true);
    const ok = await aplicarEscaneo(body.items, body.zona ?? "refri");
    setOcupado(false);
    if (!ok) { setPermiso("No pude guardar los cambios. Probá de nuevo."); return; }
    setTurnos(t => t.map((x, j) => (j === i && !x.yo ? { ...x, aplicado: true } : x)));
    onAplicado();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2">
        <p className="text-xs font-medium text-slate-700">Contale qué hay</p>
        <p className="text-[11px] text-slate-400">
          Hablá, sacá una foto o escribilo. Te muestro qué entendí antes de guardar nada.
        </p>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {turnos.length === 0 && (
          <p className="text-xs text-slate-400">
            Por ejemplo: «en el refri hay dos litros de leche, media docena de huevos y una palta».
          </p>
        )}

        {turnos.map((t, i) =>
          t.yo ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#0a1628] px-3 py-2 text-xs text-white">
                {t.adjunto === "foto" ? "📷 foto" : t.adjunto === "audio" ? "🎤 audio" : t.texto}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm bg-slate-50 px-3 py-2 text-xs">
                {/* El transcrito primero: si entendió mal, es lo que explica por qué. */}
                {t.resultado.transcrito && (
                  <p className="italic text-slate-500">«{t.resultado.transcrito}»</p>
                )}

                {!t.resultado.ok ? (
                  <p className="text-amber-700">{t.resultado.error ?? "No pude interpretarlo."}</p>
                ) : (
                  <>
                    <p className="text-slate-700">{t.resultado.mensaje}</p>
                    <div className="space-y-0.5">
                      {(t.resultado.propuesta ?? []).map((p: PropuestaEscaneo) => (
                        <div key={p.ingrediente} className="flex items-center gap-2">
                          <span className={`rounded px-1 py-0.5 text-[10px] ${
                            p.estado === "nuevo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"
                          }`}>{p.estado === "nuevo" ? "nuevo" : "actualiza"}</span>
                          <span className="text-slate-800">{p.ingrediente}</span>
                          <span className="text-slate-500">{p.mostrar || "no sé cuánto"}</span>
                          {p.antes && <span className="text-slate-400">(antes: {p.antes})</span>}
                          {p.duda && <span className="text-amber-600">· dudoso</span>}
                        </div>
                      ))}
                    </div>

                    {!!t.resultado.no_vistos?.length && (
                      <p className="text-slate-400">
                        No mencionaste {t.resultado.no_vistos.length} que tenía anotadas: las dejo como estaban.
                      </p>
                    )}

                    {(t.resultado.propuesta?.length ?? 0) > 0 && (
                      t.aplicado ? (
                        <p className="flex items-center gap-1 text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Guardado.
                        </p>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => aplicar(i, t.resultado)} disabled={ocupado}
                            className="flex items-center gap-1 rounded-lg bg-[#0a1628] px-2.5 py-1 text-white disabled:opacity-50">
                            <Check className="h-3 w-3" /> Guardar
                          </button>
                          <button onClick={() => setTurnos(x => x.filter((_, j) => j !== i))}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600">
                            <X className="h-3 w-3" /> Descartar
                          </button>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}
        {ocupado && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
          </div>
        )}
        <div ref={finRef} />
      </div>

      {permiso && <p className="px-4 pb-2 text-xs text-amber-700">{permiso}</p>}

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <button onClick={() => fileRef.current?.click()} disabled={ocupado} title="Foto de la cocina"
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
          <Camera className="h-4 w-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) mandarFoto(f); e.target.value = ""; }} />

        <button
          onClick={grabando ? pararGrabacion : empezarGrabacion}
          disabled={ocupado}
          title={grabando ? "Parar y enviar" : "Grabar audio"}
          className={`rounded-lg border p-2 disabled:opacity-50 ${
            grabando ? "animate-pulse border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}>
          {grabando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandarTexto(); } }}
          placeholder={grabando ? "Grabando… apretá el cuadrado para enviar" : "Quedan 2 litros de leche…"}
          disabled={ocupado || grabando}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
        />
        <button onClick={mandarTexto} disabled={ocupado || !texto.trim()}
          className="rounded-lg bg-[#0a1628] p-2 text-white disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
