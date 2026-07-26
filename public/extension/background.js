// Alfred Carritos — service worker (MV3)
// Orquesta el armado de carritos en las tiendas, EN LA SESIÓN DEL USUARIO.
// Nunca paga, nunca toca medios de pago, nunca lee credenciales.

// URLs verificadas por fetch en vivo (2026-07-26): Jumbo/Santa Isabel = Cencosud/VTEX (?ft=),
// Unimarc VTEX (?q=), Tottus = Falabella/ATG (?Ntt=), Líder = Walmart/ATG bajo /supermercado (?Ntt=).
const STORES = {
  jumbo:          { name: "Jumbo",        search: (q) => `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(q)}` },
  lider:          { name: "Líder",        search: (q) => `https://www.lider.cl/supermercado/search?Ntt=${encodeURIComponent(q)}` },
  unimarc:        { name: "Unimarc",      search: (q) => `https://www.unimarc.cl/search?q=${encodeURIComponent(q)}` },
  tottus:         { name: "Tottus",       search: (q) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(q)}` },
  "santa isabel": { name: "Santa Isabel", search: (q) => `https://www.santaisabel.cl/busqueda?ft=${encodeURIComponent(q)}` },
};

const state = { running: false, progress: {}, lastSpec: null };

// El service worker MV3 se recicla. Al arrancar restauramos el último estado para que el popup
// no muestre "vacío" en falso; si estaba "running", el loop murió con el SW → lo marcamos parado.
chrome.storage.local.get("alfredState", (d) => {
  // Si un build ya arrancó antes de que resolviera el restore, NO lo pisamos (evita duplicar loops).
  if (state.running) return;
  if (d && d.alfredState) { Object.assign(state, d.alfredState); state.running = false; }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "BUILD_CARTS") {
    buildCarts(msg.spec, sender.tab?.id).catch((e) => console.warn("[alfred] build error", e));
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "GET_STATE") { sendResponse(state); return true; }
  if (msg?.type === "START_LAST" && state.lastSpec) {
    buildCarts(state.lastSpec, null).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});

// Normaliza el store crudo (LLM/usuario) a una clave canónica de STORES: minúsculas, sin
// acentos, sin underscores, con alias por "contiene". Evita descartar tiendas silenciosamente.
function normStore(raw) {
  const s = (raw || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/_/g, " ").trim();
  if (s.includes("santa") && s.includes("isabel")) return "santa isabel";
  if (STORES[s]) return s;
  for (const k of Object.keys(STORES)) if (k !== "santa isabel" && s.includes(k)) return k;
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitTabLoad(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return resolve();
        if (tab.status === "complete" || Date.now() - t0 > timeout) return resolve();
        setTimeout(check, 400);
      });
    };
    setTimeout(check, 600);
  });
}

function report(alfredTabId) {
  const payload = { type: "CART_PROGRESS", progress: state.progress, running: state.running };
  if (alfredTabId) { try { chrome.tabs.sendMessage(alfredTabId, payload); } catch {} }
  chrome.storage.local.set({ alfredState: state });
}

// Inyectada en la página de la tienda. Espera a que el SPA renderice resultados, acota al
// PRIMER producto, y clickea su "Agregar" (evitando favoritos/tarjeta/cupón). Devuelve el
// resultado real para no reportar "listo" en falso. Los selectores varían por tienda → v1.
async function addToCart(qty, wholeDoc) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rx = /(agregar|añadir|add to cart|sumar)/i;
  const badRx = /(favorito|wishlist|deseos|tarjeta|cup[oó]n|direcci|lista)/i;
  const cardSel = '[data-testid*="product"], article, li[class*="roduct"], div[class*="roduct-card"], div[class*="roductCard"], [class*="shelf"] li, [class*="ProductCard"], [class*="pod"]';
  const findBtn = (scope) => [...scope.querySelectorAll('button, a[role="button"], [role="button"], [data-testid*="add"], [aria-label*="gregar"], [class*="add-to-cart"], [class*="addToCart"]')].find((b) => {
    const t = (b.getAttribute("aria-label") || "") + " " + (b.textContent || "") + " " + (b.title || "");
    return rx.test(t) && !badRx.test(t) && b.offsetParent !== null && !b.disabled;
  });
  // Esperar hasta ~8s: en búsqueda, la 1ª tarjeta + su botón; en PDP, el botón principal del documento.
  let card = null, btn = null;
  for (let t = 0; t < 20; t++) {
    if (wholeDoc) { btn = findBtn(document); if (btn) break; }
    else { card = document.querySelector(cardSel); if (card) { btn = findBtn(card); if (btn) break; } }
    await sleep(400);
  }
  if (!btn) {
    const link = card && card.querySelector('a[href]');
    return { added: false, reason: (wholeDoc || card) ? "sin_boton_agregar" : "sin_resultados", pdpUrl: link ? link.href : null };
  }
  for (let k = 0; k < (qty || 1); k++) { btn.click(); await sleep(350); }
  return { added: true };
}

async function buildCarts(spec, alfredTabId) {
  if (state.running) return;
  state.running = true;
  state.progress = {};
  state.lastSpec = spec;
  const carts = (spec && spec.carts) || [];

  for (const cart of carts) {
    const key = normStore(cart.store);
    const store = STORES[key];
    const items = cart.items || [];
    if (!store || items.length === 0) continue;

    state.progress[cart.store] = { name: store.name, done: 0, total: items.length, status: "opening" };
    report(alfredTabId);

    let tab;
    try {
      tab = await chrome.tabs.create({ url: store.search(items[0]?.name || ""), active: false });
      await waitTabLoad(tab.id);
    } catch { state.progress[cart.store].status = "error"; report(alfredTabId); continue; }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let res = { added: false, reason: "error" };
      try {
        await chrome.tabs.update(tab.id, { url: store.search(item.name) });
        await waitTabLoad(tab.id);
        const out = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: addToCart, args: [item.qty || 1, false] });
        res = (out && out[0] && out[0].result) || res;
        // Fallback: si el ítem no tiene botón en la tarjeta (ej: perecibles por peso), abrir la PDP.
        if (!res.added && res.pdpUrl) {
          await chrome.tabs.update(tab.id, { url: res.pdpUrl });
          await waitTabLoad(tab.id);
          const out2 = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: addToCart, args: [item.qty || 1, true] });
          res = (out2 && out2[0] && out2[0].result) || res;
        }
      } catch { res = { added: false, reason: "inyeccion_fallo" }; }
      const pr = state.progress[cart.store];
      pr.done = i + 1;
      if (res.added) pr.added = (pr.added || 0) + 1; else pr.failed = (pr.failed || 0) + 1;
      pr.status = "adding";
      report(alfredTabId);
    }
    const pr = state.progress[cart.store];
    pr.status = (pr.failed || 0) > 0 ? "done_partial" : "done";
    report(alfredTabId);
  }

  state.running = false;
  report(alfredTabId);
}
