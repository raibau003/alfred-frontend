"use client";

// La semana de COMIDA en tabla. Es la otra mitad de La semana: el entrenamiento define
// cuánto gastás y esto define qué comés para llegar ahí.
//
// Tres decisiones que vale la pena explicar:
//
// 1. Los SIETE días siempre, igual que en entrenamiento. El día sin menú sale gris y lo
//    dice. Una tabla de tres filas no deja ver que faltan cuatro, y era exactamente lo
//    que pasaba: el nutricionista había guardado un solo día y en pantalla no había forma
//    de notarlo.
//
// 2. La pauta va ARRIBA y con su explicación. El menú sin las calorías objetivo es una
//    lista de platos; con ellas es un plan que se puede verificar. Y el número tiene que
//    poder auditarse: una pauta que no se entiende no se sigue.
//
// 3. Cuando no hay nada, la pantalla no dice "vacío" — dice qué escribirle al
//    nutricionista para que exista. Un estado vacío sin salida es una pared.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, RefreshCw, AlertTriangle, Salad, Moon, Flame, Check, MessageSquare, ShoppingCart,
} from "lucide-react";
import {
  getPlanAlimentacion, elegirVersionMenu, agregarComprasDelMenu,
  type PlanAlimentacion as Plan, type FilaAlimentacion, type VersionMenu,
} from "@/lib/alfred/client";

const NOMBRE_COMIDA: Record<string, string> = {
  desayuno: "Desayuno", snack_am: "Media mañana", almuerzo: "Almuerzo",
  snack_pm: "Snack", snack: "Snack", cena: "Cena", colacion: "Colación",
};

export function PlanAlimentacion({ onHablar }: { onHablar?: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cargando, setCargando] = useState(true);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async (spinner = true) => {
    if (spinner) setCargando(true);
    setPlan(await getPlanAlimentacion());
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const elegir = async (v: VersionMenu) => {
    setEligiendo(v.id);
    setAviso(null);
    const r = await elegirVersionMenu(v.id);
    setEligiendo(null);
    if (r.error) { setAviso({ tipo: "error", texto: r.error }); return; }
    await cargar(false);
    if (r.mensaje) setAviso({ tipo: "ok", texto: r.mensaje });
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando tu menú…
      </div>
    );
  }

  const p = plan!;
  const vacio = p.dias_definidos === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Salad className="h-4 w-4" /> Alimentación de la semana
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {p.alternativas.find(v => v.elegido)
              ? <>Usás <strong className="text-slate-700">{p.alternativas.find(v => v.elegido)!.nombre}</strong>. </>
              : null}
            {p.pauta
              ? <>Tu pauta es de <strong className="text-slate-700">{p.pauta.kcal_objetivo} kcal/día</strong>. El menú se arma sobre eso.</>
              : "Todavía no hay una pauta calculada."}
          </p>
        </div>
        <button
          onClick={() => void cargar(false)}
          title="Actualizar"
          className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {p.error && (
        <Banda tipo="error">No pude leer tu menú ({p.error}). Probá actualizar.</Banda>
      )}
      {aviso && <Banda tipo={aviso.tipo === "ok" ? "ok" : "error"}>{aviso.texto}</Banda>}
      {p.aviso && !p.error && <Banda tipo="alerta">{p.aviso}</Banda>}

      {/* De dónde viene el menú, igual que en Deporte. Sin esto la tabla aparecía sin
          historia: no se sabía qué versión se estaba mirando ni había forma de volver a la
          anterior si el nutricionista cambiaba algo que no gustó. */}
      {p.alternativas.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {p.alternativas.map((v, i) => (
            <button
              key={v.id}
              onClick={() => !v.elegido && void elegir(v)}
              disabled={v.elegido || eligiendo !== null}
              className={`rounded-xl border p-3 text-left transition-colors ${
                v.elegido
                  ? "border-slate-800 bg-white"
                  : "border-slate-200 bg-white hover:border-slate-400 disabled:opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-800">Menú {i + 1}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    <MessageSquare className="h-2.5 w-2.5" /> del chat
                  </span>
                  {v.elegido && (
                    <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Check className="h-2.5 w-2.5" /> En uso
                    </span>
                  )}
                  {eligiendo === v.id && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{v.nombre}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {v.dias_definidos} día{v.dias_definidos === 1 ? "" : "s"} · {v.comidas} comidas
                {v.kcal_dia ? ` · ~${v.kcal_dia} kcal/día` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {p.pauta && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Macro etiqueta="Calorías" valor={`${p.pauta.kcal_objetivo} kcal`} destacado />
            <Macro etiqueta="Proteína" valor={`${p.pauta.proteina_g} g`} />
            <Macro etiqueta="Carbohidratos" valor={`${p.pauta.carbo_g} g`} />
            <Macro etiqueta="Grasas" valor={`${p.pauta.grasa_g} g`} />
          </div>
          {/* De dónde sale el número. Sin esto la pauta es un dato que hay que creer. */}
          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500">
            {p.pauta.explicacion}
          </p>
        </div>
      )}

      {vacio ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Todavía no hay menú guardado</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            El nutricionista puede proponerte la semana en el chat, pero hasta que no la
            confirmes no queda guardada acá. Pedíselo con <em>&quot;armá mi semana y guardala&quot;</em>.
          </p>
          {onHablar && (
            <button
              onClick={onHablar}
              className="mt-3 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16233a]"
            >
              Hablar con el nutricionista
            </button>
          )}
        </div>
      ) : (
        <>
          <TablaSemana filas={p.tabla} />
          <ListaCompras
            compras={p.compras}
            agregando={agregando}
            onAgregar={async () => {
              setAgregando(true);
              setAviso(null);
              const r = await agregarComprasDelMenu();
              setAgregando(false);
              setAviso(r.error
                ? { tipo: "error", texto: r.error }
                : { tipo: "ok", texto: r.mensaje ?? "Lo agregué a tu lista de compras." });
            }}
          />
        </>
      )}

      {(p.perfil.restricciones || p.perfil.no_come || p.perfil.horarios) && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          {p.perfil.horarios && <p><span className="text-slate-400">Horarios:</span> {p.perfil.horarios}</p>}
          {p.perfil.restricciones && <p><span className="text-slate-400">Restricciones:</span> {p.perfil.restricciones}</p>}
          {p.perfil.no_come && <p><span className="text-slate-400">No come:</span> {p.perfil.no_come}</p>}
          {p.perfil.comidas_fuera != null && (
            <p><span className="text-slate-400">Come afuera:</span> {p.perfil.comidas_fuera} vez/veces por semana</p>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Lo que acuerdes con el nutricionista en <strong>Nutrición</strong> aparece acá. Los
        avisos de cada comida salen 15 minutos antes por WhatsApp.
      </p>
    </div>
  );
}

function Macro({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{etiqueta}</span>
      <span className={destacado ? "text-sm font-semibold text-slate-800" : "text-sm text-slate-700"}>{valor}</span>
    </span>
  );
}

function TablaSemana({ filas }: { filas: FilaAlimentacion[] }) {
  return (
    // El overflow va en el contenedor y no en la página: en el teléfono la tabla se
    // desliza sola y el resto de la vista no se mueve de lado.
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Día</th>
            <th className="px-3 py-2 font-medium">Comidas</th>
            <th className="px-3 py-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f) => (
            <tr key={f.dia} className={f.estado === "definido" ? "" : "bg-slate-50/60"}>
              <td className="whitespace-nowrap px-3 py-2 align-top font-medium text-slate-800">
                <span className="flex items-center gap-1.5">
                  {f.estado === "definido"
                    ? <Salad className="h-3 w-3 text-slate-400" />
                    : <Moon className="h-3 w-3 text-slate-300" />}
                  {f.nombre}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {f.comidas.length ? (
                  <ul className="space-y-1">
                    {f.comidas.map((c, i) => (
                      <li key={i}>
                        <span className="text-slate-400">{NOMBRE_COMIDA[c.tipo] ?? c.tipo}:</span>{" "}
                        {c.plato || <span className="text-slate-400">—</span>}
                        {c.cantidades && <span className="text-slate-400"> · {c.cantidades}</span>}
                        {c.kcal != null && <span className="text-slate-400"> · {c.kcal} kcal</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">Sin definir</span>
                )}
              </td>
              {/* Un día sin kcal muestra "—" y no "0": decir cero es afirmar que no comió,
                  y lo que pasa es que el menú no las trae. */}
              <td className="whitespace-nowrap px-3 py-2 align-top text-slate-600">
                {f.kcal_dia != null
                  ? <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-slate-400" />{f.kcal_dia} kcal</span>
                  : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// La lista de compras del menú, debajo de la tabla. Pedido de Javier, y es literal: un
// plan que no dice qué comprar no se puede cumplir — la semana se cae el martes, cuando
// falta el pollo.
//
// Se muestra CON las cantidades ya sumadas entre días ("pollo 350 g", no "pollo" tres
// veces): en la góndola lo que se necesita saber es cuánto, no qué.
function ListaCompras({
  compras, agregando, onAgregar,
}: {
  compras: Plan["compras"];
  agregando: boolean;
  onAgregar: () => void;
}) {
  if (!compras?.cuantos) return null;
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ShoppingCart className="h-4 w-4" /> Qué comprar para esta semana
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
            {compras.cuantos} productos
          </span>
        </h3>
        <button
          onClick={onAgregar}
          disabled={agregando}
          className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16233a] disabled:opacity-60"
        >
          {agregando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
          Agregar a mi lista
        </button>
      </div>

      <ul className="grid gap-x-6 gap-y-1 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
        {compras.productos.map((x, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2 border-b border-slate-50 py-0.5">
            <span className="capitalize">{x.producto}</span>
            {x.cantidad != null
              ? <span className="shrink-0 tabular-nums text-slate-500">{x.cantidad} {x.unidad}</span>
              : <span className="shrink-0 text-slate-300">a ojo</span>}
          </li>
        ))}
      </ul>

      {compras.sin_cantidad.length > 0 && (
        // No se inventa una cantidad: se dice cuáles faltan. Un número inventado en una
        // lista de compras se compra igual.
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Sin cantidad en el menú: {compras.sin_cantidad.join(", ")}. Si le pedís al
          nutricionista que las precise, la próxima lista sale completa.
        </p>
      )}
    </div>
  );
}

function Banda({ tipo, children }: { tipo: "error" | "alerta" | "ok"; children: React.ReactNode }) {
  const estilo = {
    error: "border-red-200 bg-red-50 text-red-800",
    alerta: "border-amber-200 bg-amber-50 text-amber-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tipo];
  return (
    <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${estilo}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
