const ROUTER_PRIMARY = process.env.NEXT_PUBLIC_ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const ROUTER_BACKUP = "https://alfred-router-backup-production.up.railway.app";
let ROUTER_URL = ROUTER_PRIMARY;
let lastHealthCheck = 0;

// Auto-failover: check primary, switch to backup if down
async function getRouterUrl(): Promise<string> {
  if (Date.now() - lastHealthCheck < 30000) return ROUTER_URL; // cache 30s
  lastHealthCheck = Date.now();
  try {
    const resp = await fetch(`${ROUTER_PRIMARY}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) { ROUTER_URL = ROUTER_PRIMARY; return ROUTER_URL; }
  } catch {}
  try {
    const resp = await fetch(`${ROUTER_BACKUP}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) { ROUTER_URL = ROUTER_BACKUP; console.log("[failover] Using backup router"); return ROUTER_URL; }
  } catch {}
  return ROUTER_PRIMARY; // default
}

export interface AlfredMessage {
  role: "user" | "assistant";
  text: string;
  agent?: string;
  rich?: { type: string; products?: any[]; actions?: any[]; [key: string]: any };
}

/**
 * Crea la sesión en el router.
 *
 * Devuelve también `heredados`: cuántos mensajes viejos del chat trae la sesión recién
 * creada. El router hereda las últimas vueltas para que el agente tenga contexto, pero esos
 * mensajes YA están en pantalla (salen de conversation_messages). Si el polling los toma por
 * nuevos, se pintan dos veces.
 */
export async function createSession(title: string, userId?: string, chatId?: string): Promise<{ id: string; heredados: number } | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "/home/agent/sandbox", title, user_id: userId, chat_id: chatId }),
    });
    const data = await resp.json();
    return data?.id ? { id: data.id, heredados: Number(data.heredados) || 0 } : null;
  } catch {
    return null;
  }
}

export async function sendPrompt(sessionId: string, text: string): Promise<void> {
  const url = await getRouterUrl();
  await fetch(`${url}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directory: "/home/agent/sandbox",
      parts: [{ type: "text", text }],
    }),
  });
}

export async function getMessages(sessionId: string): Promise<{ messages: AlfredMessage[]; status: string }> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/session/${sessionId}/message?directory=/home/agent/sandbox`);
    const data = await resp.json();

    // Support both old format (array) and new format ({ messages, status })
    const rawMessages = Array.isArray(data) ? data : (data.messages || []);
    const status = Array.isArray(data) ? "unknown" : (data.status || "unknown");

    const result: AlfredMessage[] = [];
    for (const msg of rawMessages) {
      const role = (msg.role || msg.info?.role) as "user" | "assistant";
      if (!role) continue;

      let text = "";
      let rich: any = null;

      for (const p of (msg.parts || [])) {
        if (p.type === "text" && p.text) text = p.text;
        if (p.type === "rich" && p.richType) {
          rich = { type: p.richType, ...p.data };
        }
      }

      if (text) {
        result.push({ role, text, rich: rich || undefined });
      }
    }
    return { messages: result, status };
  } catch {
    return { messages: [], status: "error" };
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  const url = await getRouterUrl();
  await fetch(`${url}/session/${sessionId}/stop`, { method: "POST" });
}

export { ROUTER_URL };

// ═══════════════════════════════════════════════════════════════════════════
// COMPRAS — optimizador de canasta y carro por supermercado
//
// Los botones de decisión mandaban texto libre al chat ("lo mas barato"), lo que
// disparaba una búsqueda nueva en 5 supermercados: 1-4 min para responder algo que ya
// estaba en pantalla. Eso era el "sigue buscando". Ahora se le pregunta al optimizador
// del router, que calcula sobre los productos ya encontrados en ~9 ms.
// ═══════════════════════════════════════════════════════════════════════════

// Los endpoints del carro derivan el usuario del JWT: sin este header responden 401.
async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } catch {}
  return h;
}

export interface EstrategiaTienda {
  tienda: string;
  nombre: string;
  subtotal: number;
  despacho: number;
  despacho_gratis: boolean;
  items: { nombre: string; precio: number; cantidad: number; url?: string | null }[];
}

export interface Estrategia {
  id: string;
  etiqueta: string;
  tiendas: EstrategiaTienda[];
  n_tiendas: number;
  total_productos: number;
  total_despacho: number;
  total_final: number;
  cobertura: number;
  total_items: number;
  faltantes: string[];
  completa: boolean;
  recomendada: boolean;
  diferencia_vs_recomendada: number;
}

export interface Optimizacion {
  estrategias: Estrategia[];
  recomendada: Estrategia | null;
  veredicto: {
    ahorro_en_productos: number;
    despacho_extra: number;
    conviene_repartir: boolean;
    diferencia_final: number;
  } | null;
  resumen: string;
  delivery_estimado: boolean;
  ms: number;
}

/** Calcula las estrategias sobre los productos que YA están en pantalla. Instantáneo. */
export async function optimizarCanasta(products: any[], chatId?: string): Promise<Optimizacion | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/shopping/optimize`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ products, chat_id: chatId }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export interface CarroTienda {
  tienda: string;
  nombre: string;
  items: { id: string; nombre: string; precio: number; cantidad: number; subtotal: number; url?: string | null; imagen?: string | null }[];
  n_items: number;
  subtotal: number;
  despacho: number;
  despacho_gratis: boolean;
  falta_para_envio_gratis: number;
  total: number;
  store_url: string | null;
}

export interface Carro {
  tiendas: CarroTienda[];
  n_tiendas: number;
  n_items: number;
  total_productos: number;
  total_despacho: number;
  total: number;
  delivery_estimado: boolean;
  nota_consolidacion: string | null;
}

/** El carro completo, agrupado por supermercado (con despacho por tienda). */
export async function getCarro(): Promise<Carro | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart`, { headers: await authHeaders() });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Cambiar cantidad, precio o mover un item de tienda. Devuelve el carro actualizado. */
export async function actualizarItem(id: string, cambios: { quantity?: number; store?: string; price?: number }): Promise<Carro | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart/items/${id}`, {
      method: "PATCH", headers: await authHeaders(), body: JSON.stringify(cambios),
    });
    if (!resp.ok) return null;
    return (await resp.json()).carro ?? null;
  } catch {
    return null;
  }
}

/** Sacar un item del carro. */
export async function eliminarItem(id: string): Promise<Carro | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart/items/${id}`, { method: "DELETE", headers: await authHeaders() });
    if (!resp.ok) return null;
    return (await resp.json()).carro ?? null;
  } catch {
    return null;
  }
}

/** Vaciar una tienda entera sin tocar las otras. */
export async function vaciarTienda(store: string): Promise<Carro | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart/store/${encodeURIComponent(store)}`, { method: "DELETE", headers: await authHeaders() });
    if (!resp.ok) return null;
    return (await resp.json()).carro ?? null;
  } catch {
    return null;
  }
}

export interface ResultadoCheckout {
  ok: boolean;
  motivo?: string;
  mensaje?: string;
  open_urls?: string[];
  store_url?: string;
  commands_sent?: number;
  login_omitido?: boolean;
}

/**
 * Arma el carro en el sitio del super. Antes esto era un `<a href>` a la home de la
 * tienda: abría el sitio y no agregaba nada — y con "santa isabel" la clave del mapa
 * local no matcheaba, así que el href quedaba en "#" y abría la propia app de Alfred.
 * Si no hay extensión/bridge conectado, devuelve las URLs para abrirlas en pestañas.
 */
export async function armarCarroEnTienda(store: string, products: any[]): Promise<ResultadoCheckout | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart/open-in-browser`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ store, products }),
    });
    return await resp.json();
  } catch {
    return null;
  }
}

/** Reemplaza el carro por una estrategia del optimizador ("pasame todo a Jumbo"). */
export async function aplicarEstrategia(estrategia: Estrategia): Promise<Carro | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/cart/apply-strategy`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ estrategia }),
    });
    if (!resp.ok) return null;
    return (await resp.json()).carro ?? null;
  } catch {
    return null;
  }
}

/** Mapa canónico de supermercados del router (id, nombre, url). No mantener uno local. */
export async function getTiendas(): Promise<{ id: string; nombre: string; url: string }[]> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/shopping/stores`);
    if (!resp.ok) return [];
    return (await resp.json()).stores ?? [];
  } catch {
    return [];
  }
}

// ── Configuración de compras ─────────────────────────────────────────────────
// Lo que el optimizador necesita saber y no puede adivinar: dónde recibís, si tenés
// algún programa de socio, cuántas tiendas tolerás y cuánto te cobran de despacho.

export interface PrefsCompras {
  comuna?: string;
  programas?: string[];              // ["jumbo_prime", …]
  retiro_en_tienda?: boolean;
  max_tiendas?: number;              // 0 = sin límite
  tiendas_evitadas?: string[];
  tiendas_preferidas?: string[];
  marcas_preferidas?: Record<string, string>;
  despacho_propio?: Record<string, number>;   // el número que viste al pagar
}

export async function getPrefsCompras(): Promise<PrefsCompras> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/prefs`, { headers: await authHeaders() });
    if (!resp.ok) return {};
    return (await resp.json())?.prefs?.compras ?? {};
  } catch {
    return {};
  }
}

export async function savePrefsCompras(compras: PrefsCompras, chatId?: string): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/prefs`, {
      method: "PUT",
      headers: await authHeaders(),
      // El PUT hace merge: mandar solo `compras` no borra las preferencias de correo.
      body: JSON.stringify({ compras, chat_id: chatId }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export interface TablaDespacho {
  comuna: string;
  tabla: Record<string, { costo: number; minimo: number; gratis_desde: number; propio?: boolean; comuna?: string }>;
  estimado: boolean;
  programas_conocidos: Record<string, { tienda: string; nombre: string; gratis_desde: number }>;
}

export async function getDespacho(comuna?: string): Promise<TablaDespacho | null> {
  try {
    const url = await getRouterUrl();
    const q = comuna ? `?comuna=${encodeURIComponent(comuna)}` : "";
    const resp = await fetch(`${url}/shopping/delivery${q}`, { headers: await authHeaders() });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SALUD — hogar, restricciones y pautas
//
// Las restricciones DURAS (alergias) las valida el router con código, no un modelo: es
// el único lugar donde un error hace daño físico. Acá solo se declaran y se muestran.
// ═══════════════════════════════════════════════════════════════════════════

export interface Restriccion {
  id: number;
  tipo: "dura" | "blanda";
  que: string;
  notas?: string | null;
}

export interface Pauta {
  kcal_objetivo?: number;
  proteina_g?: number;
  carbo_g?: number;
  grasa_g?: number;
  objetivo?: string;
  gasto_base?: number;
  gasto_actividad?: number;
  mantenimiento?: number;
  explicacion?: string;
  comidas_por_dia?: number;
  incompleta?: boolean;
  faltan?: string[];
  kcal_entrenamiento?: number;
  viene_del_coach?: boolean;
}

export interface Persona {
  id: number;
  nombre: string;
  tipo: "adulto" | "nino";
  edad?: number | null;
  rol: "residente" | "cocina" | "apoyo";
  whatsapp?: string | null;
  consentimiento_at?: string | null;
  consentimiento_por?: string | null;
  recibe?: Record<string, boolean>;
  restricciones: Restriccion[];
  pauta?: Pauta | null;
  // Colegio: el curso es lo que decide qué eventos del calendario le aplican, así que vive
  // en la persona y no en la fuente. Un hijo puede tener dos colegios y el curso es el mismo.
  curso?: string | null;
  colegio?: string | null;
  correo?: string | null;
}

export interface Hogar {
  personas: Persona[];
  completo: boolean;
  resumen?: { total: number; adultos: number; ninos: number; con_pauta: number; alergias: number };
}

export async function getHogar(): Promise<Hogar> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/hogar`, { headers: await authHeaders() });
    if (!r.ok) return { personas: [], completo: false };
    return await r.json();
  } catch {
    return { personas: [], completo: false };
  }
}

export async function guardarPersona(datos: Partial<Persona> & { nombre: string; consentimiento?: boolean }): Promise<Hogar | null> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/personas`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    if (!r.ok) return null;
    return (await r.json()).hogar ?? null;
  } catch {
    return null;
  }
}

/** Devuelve el hogar actualizado y el `efecto` (qué va a hacer Alfred con esta restricción). */
export async function agregarRestriccion(
  persona_id: number, tipo: "dura" | "blanda", que: string, notas?: string,
): Promise<{ hogar: Hogar; efecto: string } | null> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/restricciones`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ persona_id, tipo, que, notas }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return { hogar: d.hogar, efecto: d.efecto };
  } catch {
    return null;
  }
}

export async function quitarRestriccion(id: number): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/restricciones/${id}`, { method: "DELETE", headers: await authHeaders() });
    return r.ok;
  } catch {
    return false;
  }
}

/** Calcula la pauta SIN guardarla, para poder verla y conversarla antes de fijarla. */
export async function calcularPauta(datos: {
  peso?: number; altura?: number; edad?: number; sexo?: string; vida?: string; objetivo?: string;
}): Promise<Pauta | null> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/pauta/calcular`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function guardarPauta(persona_id: number, pauta: Pauta): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/pauta`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ persona_id, pauta }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface PreferenciasCocina {
  cocinas?: { cocina: string; peso: number }[];
  no_repetir_dias?: number;
  tiempo_max_cocina?: number;
  cena_cocinada?: boolean;
  comen_almuerzo?: number;
  comen_cena?: number;
  dias_fuera?: string[];
  escaneo_modo?: "auto" | "fijo" | "manual";
  escaneo_frecuencia?: number;
  es_default?: boolean;
}

export async function getPreferenciasCocina(): Promise<PreferenciasCocina> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/preferencias`, { headers: await authHeaders() });
    if (!r.ok) return {};
    return await r.json();
  } catch {
    return {};
  }
}

export async function guardarPreferenciasCocina(cambios: PreferenciasCocina): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/preferencias`, {
      method: "PUT", headers: await authHeaders(), body: JSON.stringify(cambios),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ── Cocina: menú de la semana, inventario y lista de compras ──────────────────────────
//
// Todo lo que sigue existe también por WhatsApp; la web sirve para VER de una vez lo que
// el chat entrega de a pedazos (las 7 comidas juntas, las 14 cosas de la lista) y para
// corregir con dos clics lo que por texto son tres mensajes.
//
// Nota sobre los tipos: los campos de confianza (`confianza`, `n_observaciones`,
// `sin_precio`, `unidades_inciertas`) NO son opcionales de adorno. El router los manda
// justamente para que la UI pueda distinguir lo que sabe de lo que estima, y esconderlos
// convertiría una estimación honesta en un dato duro.

export interface ItemInventario {
  id?: number;
  ingrediente: string;
  cantidad: number | null;
  unidad: string | null;
  zona?: string;
  visto_en?: string | null;
  mostrar?: string;
}

export async function getInventario(zona?: string): Promise<{ items: ItemInventario[]; total: number; por_zona: Record<string, number> }> {
  try {
    const url = await getRouterUrl();
    const q = zona ? `?zona=${encodeURIComponent(zona)}` : "";
    const r = await fetch(`${url}/inventario${q}`, { headers: await authHeaders() });
    if (!r.ok) return { items: [], total: 0, por_zona: {} };
    return await r.json();
  } catch {
    return { items: [], total: 0, por_zona: {} };
  }
}

export interface PorAcabarse {
  ingrediente: string;
  cantidad: number | null;
  unidad: string | null;
  dias: number | null;
  fecha: string | null;
  confianza: "alta" | "media" | "baja" | "ninguna";
  n_observaciones?: number;
  frase?: string;
  motivo?: string;
}

export async function getPorAcabarse(dias = 7): Promise<{
  criticos: PorAcabarse[]; sin_datos: PorAcabarse[]; total_en_casa: number;
  mensaje: string; nota_sin_datos: string | null;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/por-acabarse?dias=${dias}`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { criticos: [], sin_datos: [], total_en_casa: 0, mensaje: "No pude leer el inventario.", nota_sin_datos: null };
  }
}

export async function moverInventario(datos: {
  ingrediente: string; delta?: number; cantidad?: number; unidad?: string | null; motivo?: string; zona?: string;
}): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/mover`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface PropuestaEscaneo {
  ingrediente: string; cantidad: number | null; unidad: string | null;
  mostrar?: string; antes?: string | null; estado: "nuevo" | "actualiza"; duda?: boolean;
}

// La foto PROPONE. Devuelve lo que vio y el body listo para aplicar, pero no escribe nada
// hasta que alguien confirme: una foto mal leída no puede reescribir el inventario.
export async function escanearFoto(imageBase64: string, mimetype = "image/jpeg"): Promise<{
  ok: boolean; propuesta?: PropuestaEscaneo[]; no_vistos?: string[]; sin_cantidad?: string[];
  con_duda?: string[]; mensaje?: string; error?: string;
  para_aplicar?: { endpoint: string; body: Record<string, unknown> };
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/escaneo-foto`, {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ image_base64: imageBase64, mimetype }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function aplicarEscaneo(items: unknown[], zona = "refri"): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/escaneo`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ items, zona }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface ComidaMenu {
  dia: string; fecha?: string; plato_nombre: string; porciones: number;
  minutos?: number | null; relajado?: string | null; tipo?: string;
}

export async function proponerMenu(desde?: string, dias = 7, modo?: string): Promise<{
  comidas: ComidaMenu[]; resumen?: { cocinas: string[]; minutos_totales: number; aviso?: string; descartados_por_tiempo?: number };
  personas?: string[]; sin_resolver?: unknown[]; vacio?: boolean; mensaje?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/menu/proponer`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ desde, dias, modo }),
    });
    return await r.json();
  } catch {
    return { comidas: [], vacio: true, mensaje: "No pude armar el menú." };
  }
}

export async function guardarMenu(desde?: string, dias = 7): Promise<{ ok?: boolean; aviso?: string; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/menu/guardar`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ desde, dias }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getConLoQueHay(maxFaltantes = 2): Promise<{
  listos: { plato: string; minutos: number | null }[];
  casi: { plato: string; minutos: number | null; faltan: { ingrediente: string; motivo: string }[] }[];
  sin_inventario?: boolean; mensaje: string; vacio?: boolean;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/menu/con-lo-que-hay?max_faltantes=${maxFaltantes}`, { headers: await authHeaders() });
    return await r.json();
  } catch {
    return { listos: [], casi: [], mensaje: "No pude consultar el recetario." };
  }
}

export interface ItemLista {
  id: number; ingrediente: string; cantidad: number | null; unidad: string | null;
  origen: string; para: string | null; esencial: boolean; estado: string; mostrar?: string;
}

export async function getLista(): Promise<{ items: ItemLista[]; total: number; esenciales: number; por_origen: Record<string, number> }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/lista`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { items: [], total: 0, esenciales: 0, por_origen: {} };
  }
}

export async function listaDesdeMenu(): Promise<{ resumen?: string; mensaje?: string; vacio?: boolean }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/lista/desde-menu`, { method: "POST", headers: await authHeaders(), body: "{}" });
    return await r.json();
  } catch {
    return { mensaje: "No pude armar la lista desde el menú." };
  }
}

export async function marcarItemLista(id: number, estado: "pendiente" | "comprado" | "descartado"): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/lista/${id}`, {
      method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ estado }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface Presupuesto {
  modo: string; total: number; total_sin_techo?: number; cabe?: boolean; techo?: number;
  items: { ingrediente: string; costo?: number | null; envases?: number; unidad_incierta?: string }[];
  recortados?: { ingrediente: string; motivo: string }[];
  sin_precio?: string[]; nota_sin_precio?: string | null;
  unidades_inciertas?: string[];
  alerta_esenciales?: string | null;
  ahorro_total?: number; sin_opciones?: string[]; nota?: string | null;
  mensaje?: string; vacio?: boolean;
}

export async function presupuestar(modo: "libre" | "techo" | "comparado", techo?: number): Promise<Presupuesto> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/lista/presupuestar`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ modo, techo }),
    });
    return await r.json();
  } catch {
    return { modo, total: 0, items: [], mensaje: "No pude calcular el presupuesto." };
  }
}

export async function buscarPreciosLista(max = 8): Promise<{ mensaje?: string; pendientes?: string[]; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/lista/buscar-precios`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ max }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getSinUsar(): Promise<{
  parados: { ingrediente: string; dias_sin_uso: number; zona: string; frase: string }[];
  sugerencias: { plato: string; usa: string[]; faltan: number }[];
  mensaje: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/habitos/sin-usar`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { parados: [], sugerencias: [], mensaje: "No pude revisar el inventario." };
  }
}

// ── Contarle a Alfred qué hay: por voz, por foto o escribiendo ────────────────────────
//
// Los tres devuelven lo mismo —una PROPUESTA— y ninguno escribe. Es deliberado: un audio
// mal transcrito y una foto mal leída fallan distinto pero se corrigen igual, mirando la
// lista antes de guardarla.

export interface PropuestaInventario {
  ok: boolean;
  origen?: "foto" | "audio" | "texto";
  propuesta?: PropuestaEscaneo[];
  no_vistos?: string[];
  sin_cantidad?: string[];
  con_duda?: string[];
  mensaje?: string;
  error?: string;
  transcrito?: string;
  para_aplicar?: { endpoint: string; body: Record<string, unknown> };
}

export async function escanearAudio(audioBase64: string, mimetype: string): Promise<PropuestaInventario> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/escaneo-audio`, {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ audio_base64: audioBase64, mimetype }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function escanearTexto(texto: string): Promise<PropuestaInventario> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/inventario/escaneo-texto`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ texto }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Calendario familiar y automatizaciones ────────────────────────────────────────────

export interface EventoCalendario {
  id: number;
  titulo: string;
  fecha: string;
  hora_inicio: string | null;
  fecha_fin: string | null;
  categoria: string;
  requiere: string;
  avisar_horas_antes: number | null;
  cita: string | null;
  confianza: "alta" | "media" | "baja";
  estado: string;
  notas: string | null;
  dia_relativo: string;
  quienes: string[];
  avisado_en: string | null;
}

export async function getCalendario(desde?: string, hasta?: string): Promise<{
  eventos: EventoCalendario[]; total: number;
  por_categoria: Record<string, number>; accionables: number;
  personas: Record<string, string>;
}> {
  try {
    const url = await getRouterUrl();
    const q = new URLSearchParams();
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    const r = await fetch(`${url}/calendario?${q}`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { eventos: [], total: 0, por_categoria: {}, accionables: 0, personas: {} };
  }
}

export interface FuenteCalendario {
  id: number; nombre: string; tipo: string; url: string | null;
  persona: number | null; curso: string | null; activa: boolean;
  ultimo_sync: string | null; ultimo_error: string | null;
  eventos_ultimo_sync: number | null;
}

export async function getFuentes(): Promise<{ fuentes: FuenteCalendario[]; con_error: { nombre: string; error: string }[] }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/fuentes`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { fuentes: [], con_error: [] };
  }
}

export async function guardarFuente(datos: {
  nombre: string; tipo: string; url?: string; persona?: number | null; curso?: string | null; cada_horas?: number;
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/fuentes`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

// La página del colegio embebe un Google Calendar: de la URL humana sale el feed .ics.
export async function descubrirCalendario(pagina: string): Promise<{
  ok: boolean; feeds?: { id: string; ics: string }[]; mensaje?: string; error?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/descubrir`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ url: pagina }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function sincronizarCalendario(): Promise<{ mensaje?: string; error?: string; vacio?: boolean }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/sync`, { method: "POST", headers: await authHeaders(), body: "{}" });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function crearEvento(datos: {
  titulo: string; fecha: string; hora_inicio?: string; categoria?: string;
  para?: number[]; requiere?: string; notas?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/evento`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getAvisosPendientes(): Promise<{
  hay: boolean; aviso: { texto: string; cuantos: number; accionable: boolean } | null; pendientes: number; mensaje: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/calendario/avisos`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { hay: false, aviso: null, pendientes: 0, mensaje: "No pude consultar los avisos." };
  }
}

export interface Regla {
  id: number; nombre: string; cuando: string; condicion: Record<string, unknown>;
  accion: string; parametros: Record<string, unknown>;
  nivel: "avisar" | "preparar" | "ejecutar";
  simulacion: boolean; activa: boolean; veces: number;
  ultimo_disparo: string | null; descripcion: string | null;
  descripcion_accion: string; hacia_afuera: boolean;
  ultimas: { cuando_at: string; hizo: string | null; simulado: boolean; resultado: string }[];
}

export async function getReglas(): Promise<{ reglas: Regla[]; en_simulacion: number; total: number }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/reglas`, { headers: await authHeaders() });
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { reglas: [], en_simulacion: 0, total: 0 };
  }
}

export async function crearRegla(datos: {
  nombre: string; cuando: string; condicion: Record<string, unknown>;
  accion: string; parametros: Record<string, unknown>; nivel?: string; descripcion?: string;
}): Promise<{ ok?: boolean; mensaje?: string; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/reglas`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(datos),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function cambiarRegla(id: number, cambios: Partial<{ activa: boolean; simulacion: boolean; nivel: string }>):
  Promise<{ ok?: boolean; aviso?: string | null; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/reglas/${id}`, {
      method: "PATCH", headers: await authHeaders(), body: JSON.stringify(cambios),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function borrarRegla(id: number): Promise<boolean> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/reglas/${id}`, { method: "DELETE", headers: await authHeaders() });
    return r.ok;
  } catch {
    return false;
  }
}

// Probar una regla con un hecho de mentira. Sin esto, escribir una regla es escribir a
// ciegas y esperar semanas a ver si acierta.
export async function probarRegla(regla: unknown, hecho: Record<string, unknown>): Promise<{
  coincide?: boolean; motivo?: string; porque?: string;
  decision?: { hacer: string; habria?: string; propuesta?: string; descripcion?: string };
  error?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/reglas/probar`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ regla, hecho }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export interface ChatWhatsapp { id: string; nombre: string; grupo: boolean; ultimo: string | null }

export async function getChatsWhatsapp(): Promise<{ chats: ChatWhatsapp[]; total: number; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/whatsapp/chats?limit=200`, { headers: await authHeaders() });
    if (!r.ok) return { chats: [], total: 0, error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { chats: [], total: 0, error: String(e) };
  }
}

export async function eliminarPersona(id: number): Promise<{ ok?: boolean; mensaje?: string; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/salud/personas/${id}`, { method: "DELETE", headers: await authHeaders() });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

// ── Seguimiento por persona: notas y lo que se le viene ───────────────────────────────

export interface NotaRamo {
  asignatura: string;
  nota: number | null;
  periodo: string;
  detalle: string | null;
  leido_en: string;
  tendencia: { direccion: "subiendo" | "bajando" | "estable" | "sin_datos"; dif?: number; lecturas: number; motivo?: string };
}

export interface SeguimientoPersona {
  id: number; nombre: string; edad: number | null;
  curso: string | null; colegio: string | null;
  notas: NotaRamo[];
  promedio: number | null;
  proximos: EventoCalendario[];
  pendientes: EventoCalendario[];
  ultima_lectura: string | null;
}

export async function getSeguimiento(): Promise<{
  personas: SeguimientoPersona[]; sin_notas: string[]; sin_curso: string[]; error?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/seguimiento`, { headers: await authHeaders() });
    if (!r.ok) return { personas: [], sin_notas: [], sin_curso: [], error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { personas: [], sin_notas: [], sin_curso: [], error: String(e) };
  }
}

export async function sincronizarNotas(persona?: number): Promise<{ mensaje?: string; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/colegio/notas/sync`, {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify(persona ? { persona } : {}),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRENAMIENTO — el plan de la semana y sus alternativas
//
// La tabla se arma en el router (aTabla) y no acá: los siete días, el estado de cada uno
// y el resumen son decisiones que también usa WhatsApp, y calcularlas en dos lugares es
// la receta para que la web y el chat digan cosas distintas del mismo plan.

export interface BloqueEntrenamiento {
  ejercicio: string;
  series: number | null;
  reps: string | null;
  carga: string | null;
}

export interface FilaEntrenamiento {
  dia: string;
  nombre: string;
  foco: string;
  min: number | null;
  cardio: string;
  bloques: BloqueEntrenamiento[];
  estado: "entrena" | "descanso" | "sin_definir";
}

export interface ResumenEntrenamiento {
  dias_entrena: number;
  dias_descanso: number;
  dias_sin_definir: number;
  min_semana: number;
  min_por_sesion: number | null;
  sin_minutos: string[];
  completo: boolean;
}

export interface EquipoFaltante {
  dia: string;
  ejercicio: string;
  necesita: string;
}

export interface AlternativaEntrenamiento {
  id: string | null;
  nombre: string;
  enfoque: string;
  elegido: boolean;
  tabla: FilaEntrenamiento[];
  resumen: ResumenEntrenamiento;
  // "conversacion" = salió de hablar con el coach en la pestaña Deporte. Se distingue
  // porque es el que trae el contexto que se conversó, y el que uno reconoce.
  origen?: "generado" | "conversacion";
  // Ejercicios que piden equipo que no está declarado. El router los calcula para que
  // WhatsApp pueda avisar lo mismo que la web.
  equipo_faltante?: EquipoFaltante[];
  fuera_de_lote?: boolean;
}

export interface PlanEntrenamiento {
  vigente: AlternativaEntrenamiento | null;
  alternativas: AlternativaEntrenamiento[];
  generado_en: string | null;
  kcal_entrenamiento: number;
  peso: number;
  equipo?: string;
  error?: string;
}

const SIN_PLAN: PlanEntrenamiento = {
  vigente: null, alternativas: [], generado_en: null, kcal_entrenamiento: 0, peso: 80,
};

// ── La semana de COMIDA ─────────────────────────────────────────────────────
//
// Espeja a getPlanEntrenamiento a propósito: son las dos mitades de la misma pregunta
// ("¿qué me toca esta semana?") y conviene que se lean igual.

export type ComidaPlan = {
  tipo: string;
  plato: string;
  cantidades: string | null;
  kcal: number | null;
  proteina_g: number | null;
  ingredientes: string[];
};

export type FilaAlimentacion = {
  dia: string;
  nombre: string;
  estado: "definido" | "sin_definir";
  comidas: ComidaPlan[];
  kcal_dia: number | null;
};

export type VersionMenu = {
  id: string;
  nombre: string;
  origen: string;
  elegido: boolean;
  creado_en: string;
  dias_definidos: number;
  kcal_dia: number | null;
  comidas: number;
};

export type PlanAlimentacion = {
  tabla: FilaAlimentacion[];
  alternativas: VersionMenu[];
  pauta: {
    kcal_objetivo: number; proteina_g: number; carbo_g: number; grasa_g: number;
    objetivo: string; explicacion: string;
  } | null;
  perfil: {
    objetivo: string | null; comidas: number | null; restricciones: string | null;
    no_come: string | null; horarios: string | null; comidas_fuera: number | null;
    alcohol: string | null; dia_libre: string | null;
  };
  dias_definidos: number;
  aviso: string | null;
  error?: string;
};

const SIN_MENU: PlanAlimentacion = {
  tabla: [], alternativas: [], pauta: null, dias_definidos: 0, aviso: null,
  perfil: { objetivo: null, comidas: null, restricciones: null, no_come: null,
            horarios: null, comidas_fuera: null, alcohol: null, dia_libre: null },
};

export async function getPlanAlimentacion(): Promise<PlanAlimentacion> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/nutricion/plan`, { headers: await authHeaders() });
    if (!r.ok) return { ...SIN_MENU, error: `el router respondió ${r.status}` };
    return await r.json();
  } catch (e) {
    // Mismo criterio que en entrenamiento: "no pude preguntar" y "no tenés menú" se ven
    // igual en pantalla, y solo el primero se arregla reintentando.
    return { ...SIN_MENU, error: String(e) };
  }
}

export async function elegirVersionMenu(id: string): Promise<{ ok?: boolean; nombre?: string; mensaje?: string; error?: string }> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/nutricion/elegir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();
    return r.ok ? j : { error: j?.error ?? `el router respondió ${r.status}` };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getPlanEntrenamiento(): Promise<PlanEntrenamiento> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/entrenamiento/plan`, { headers: await authHeaders() });
    if (!r.ok) return { ...SIN_PLAN, error: `el router respondió ${r.status}` };
    return await r.json();
  } catch (e) {
    // Se devuelve el error y no un plan vacío: "no pude preguntar" y "no tenés plan" se
    // ven igual en pantalla, y el primero se arregla reintentando.
    return { ...SIN_PLAN, error: String(e) };
  }
}

export async function generarPlanesEntrenamiento(pedido?: string): Promise<{
  ok?: boolean; alternativas?: AlternativaEntrenamiento[]; nota?: string | null; error?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/entrenamiento/generar`, {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify(pedido ? { pedido } : {}),
      // El coach tarda: arma tres semanas completas. Con el timeout por defecto la
      // llamada moría antes de que contestara y parecía que no funcionaba.
      signal: AbortSignal.timeout(300000),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export async function elegirPlanEntrenamiento(id: string): Promise<{
  ok?: boolean; nombre?: string; kcal_entrenamiento?: number; aviso?: string | null; error?: string;
}> {
  try {
    const url = await getRouterUrl();
    const r = await fetch(`${url}/entrenamiento/elegir`, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ id }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}
