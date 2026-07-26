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

export async function createSession(title: string, userId?: string): Promise<string | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "/home/agent/sandbox", title, user_id: userId }),
    });
    const data = await resp.json();
    return data?.id ?? null;
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
