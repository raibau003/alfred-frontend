"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, MapPin, Truck, Store, Ban, Info } from "lucide-react";
import {
  getPrefsCompras, savePrefsCompras, getDespacho,
  type PrefsCompras, type TablaDespacho,
} from "@/lib/alfred/client";

const TIENDAS = [
  { id: "jumbo", nombre: "Jumbo" },
  { id: "santaisabel", nombre: "Santa Isabel" },
  { id: "lider", nombre: "Líder" },
  { id: "unimarc", nombre: "Unimarc" },
  { id: "tottus", nombre: "Tottus" },
  { id: "acuenta", nombre: "acuenta" },
];

const COMUNAS = [
  "Las Condes", "Vitacura", "Providencia", "Lo Barnechea", "Ñuñoa", "La Reina", "Santiago",
  "Peñalolén", "Macul", "Huechuraba", "Colina", "Chicureo", "Maipú", "La Florida",
  "Viña del Mar", "Valparaíso", "Concón", "Rancagua", "Concepción", "Temuco", "La Serena",
];

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;

export function ConfiguracionCompras() {
  const [prefs, setPrefs] = useState<PrefsCompras>({});
  const [despacho, setDespacho] = useState<TablaDespacho | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getPrefsCompras();
      setPrefs(p);
      setDespacho(await getDespacho(p.comuna));
      setCargando(false);
    })();
  }, []);

  // Cada cambio se guarda solo: una pantalla de configuración con botón "Guardar" que
  // hay que acordarse de apretar es una forma de perder configuración.
  async function actualizar(cambios: PrefsCompras) {
    const nuevo = { ...prefs, ...cambios };
    setPrefs(nuevo);
    setGuardando(true);
    setGuardado(false);
    const ok = await savePrefsCompras(nuevo);
    setGuardando(false);
    if (ok) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
      if (cambios.comuna !== undefined) setDespacho(await getDespacho(nuevo.comuna));
    }
  }

  function toggleLista(campo: "programas" | "tiendas_evitadas", valor: string) {
    const actual = prefs[campo] ?? [];
    const nueva = actual.includes(valor) ? actual.filter((x) => x !== valor) : [...actual, valor];
    actualizar({ [campo]: nueva } as PrefsCompras);
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando tu configuración…
      </div>
    );
  }

  const programas = despacho?.programas_conocidos ?? {};

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0a1628]">Configuración de compras</h1>
          <p className="text-sm text-slate-500 mt-1">
            Esto es lo que Alfred necesita para decidir si te conviene repartir la compra o dejarla en un solo super.
          </p>
        </div>
        <span className="text-xs text-slate-400 h-5 flex items-center gap-1">
          {guardando && <><Loader2 className="h-3 w-3 animate-spin" /> guardando…</>}
          {guardado && <><Check className="h-3 w-3 text-green-600" /> guardado</>}
        </span>
      </header>

      {/* ── Dónde recibís ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-slate-400" /> Dónde recibís
        </h2>
        <p className="text-xs text-slate-500">
          El costo de despacho cambia por comuna, así que sin esto los totales son estimados.
        </p>
        <input
          list="comunas"
          value={prefs.comuna ?? ""}
          onChange={(e) => setPrefs({ ...prefs, comuna: e.target.value })}
          onBlur={(e) => actualizar({ comuna: e.target.value.trim() })}
          placeholder="Tu comuna (ej: Las Condes)"
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1628]/20"
        />
        <datalist id="comunas">
          {COMUNAS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </section>

      {/* ── Programas de socio ────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Store className="h-4 w-4 text-slate-400" /> Programas de socio
        </h2>
        <p className="text-xs text-slate-500">
          Cambian el monto desde el que el envío es gratis. Si tenés uno y Alfred no lo sabe, te está
          sumando un despacho que no pagás.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {Object.entries(programas).map(([clave, p]) => {
            const activo = (prefs.programas ?? []).includes(clave);
            return (
              <button
                key={clave}
                onClick={() => toggleLista("programas", clave)}
                className={`text-left rounded-lg border-2 px-3 py-2 transition-colors ${
                  activo ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{p.nombre}</span>
                  {activo && <Check className="h-4 w-4 text-green-600" />}
                </span>
                <span className="text-xs text-slate-500">
                  {p.gratis_desde > 0 ? `envío gratis sobre ${clp(p.gratis_desde)}` : "envío gratis sin mínimo"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Cómo preferís comprar ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-slate-400" /> Cómo preferís comprar
        </h2>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!prefs.retiro_en_tienda}
            onChange={(e) => actualizar({ retiro_en_tienda: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="text-sm text-slate-900">Retiro en tienda</span>
            <span className="block text-xs text-slate-500">
              No se paga despacho, pero hay que ir a buscarlo. Alfred deja de sumar envío en los totales.
            </span>
          </span>
        </label>

        <div>
          <span className="text-sm text-slate-900">¿En cuántos supermercados estás dispuesto a comprar?</span>
          <div className="flex gap-2 mt-1.5">
            {[
              { v: 1, t: "Solo 1" },
              { v: 2, t: "Máximo 2" },
              { v: 0, t: "Sin límite" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => actualizar({ max_tiendas: o.v })}
                className={`px-3 py-1.5 text-xs rounded-lg border-2 ${
                  (prefs.max_tiendas ?? 2) === o.v
                    ? "border-[#0a1628] bg-[#0a1628] text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sin límite busca el mínimo por producto aunque salgan 4 tiendas — y 4 despachos.
          </p>
        </div>
      </section>

      {/* ── Tiendas a evitar ──────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Ban className="h-4 w-4 text-slate-400" /> Tiendas que no querés
        </h2>
        <div className="flex flex-wrap gap-2">
          {TIENDAS.map((t) => {
            const evitada = (prefs.tiendas_evitadas ?? []).includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleLista("tiendas_evitadas", t.id)}
                className={`px-3 py-1.5 text-xs rounded-full border-2 ${
                  evitada ? "border-red-300 bg-red-50 text-red-700 line-through" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {t.nombre}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Si un producto solo existe en una tienda evitada, Alfred te lo muestra igual con la advertencia:
          mejor eso que decirte "no hay".
        </p>
      </section>

      {/* ── Costos de despacho ────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Costos de despacho</h2>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Los supermercados muestran el costo recién al pagar y cambia según el carrito, así que
            {despacho?.estimado ? " estos valores son estimados" : " estos son los que cargaste"}.
            Cuando veas el real, escribilo acá (o decíselo a Alfred por WhatsApp: <em>"el despacho de Jumbo cuesta 3990"</em>).
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {TIENDAS.map((t) => {
            const fila = despacho?.tabla?.[t.id];
            const propio = prefs.despacho_propio?.[t.id];
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm text-slate-700 flex-1">{t.nombre}</span>
                {fila && (
                  <span className="text-xs text-slate-400">
                    {propio ? "tuyo" : fila.comuna === "nacional" ? "estimado" : `de ${fila.comuna}`}
                    {fila.gratis_desde > 0 && ` · gratis sobre ${clp(fila.gratis_desde)}`}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    defaultValue={propio ?? fila?.costo ?? ""}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!v || v === (propio ?? fila?.costo)) return;
                      actualizar({ despacho_propio: { ...(prefs.despacho_propio ?? {}), [t.id]: v } });
                    }}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0a1628]/20"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-4">
        Todo esto también se puede decir por WhatsApp: <em>"recibo en Las Condes"</em>,{" "}
        <em>"tengo Jumbo Prime"</em>, <em>"no me mandes a Unimarc"</em>, <em>"máximo 2 tiendas"</em>.
      </p>
    </div>
  );
}
