// Alfred Carritos — service worker (MV3)
// Orquesta el armado de carritos en las tiendas, EN LA SESIÓN DEL USUARIO.
// Nunca paga, nunca toca medios de pago, nunca lee credenciales.

const STORES = {
  jumbo:          { name: "Jumbo",        search: (q) => `https://www.jumbo.cl/search?q=${encodeURIComponent(q)}` },
  lider:          { name: "Líder",        search: (q) => `https://www.lider.cl/search?query=${encodeURIComponent(q)}` },
  unimarc:        { name: "Unimarc",      search: (q) => `https://www.unimarc.cl/search?query=${encodeURIComponent(q)}` },
  tottus:         { name: "Tottus",       search: (q) => `https://www.tottus.cl/tottus-cl/buscar?q=${encodeURIComponent(q)}` },
  "santa isabel": { name: "Santa Isabel", search: (q) => `https://www.santaisabel.cl/search?q=${encodeURIComponent(q)}` },
};

const state = { running: false, progress: {}, lastSpec: null };

// El service worker MV3 se recicla. Al arrancar restauramos el último estado para que el popup
// no muestre "vacío" en falso; si estaba "running", el loop murió con el SW → lo marcamos parado.
chrome.storage.local.get("alfredState", (d) => {
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
async function addFirstToCart(qty) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rx = /(agregar|añadir|add to cart|sumar)/i;
  const badRx = /(favorito|wishlist|deseos|tarjeta|cup[oó]n|direcci|lista)/i;
  const cardSel = '[data-testid*="product"], article, li[class*="roduct"], div[class*="roduct-card"], div[class*="roductCard"], [class*="shelf"] li, [class*="ProductCard"]';
  // Esperar hasta ~8s a que aparezca al menos una tarjeta de producto (SPA client-render)
  let card = null;
  for (let t = 0; t < 20; t++) { card = document.querySelector(cardSel); if (card) break; await sleep(400); }
  const scope = card || document;
  const btns = [...scope.querySelectorAll('button, a[role="button"], [role="button"], [data-testid*="add"], [class*="add-to-cart"], [class*="addToCart"]')];
  const btn = btns.find((b) => {
    const t = (b.getAttribute("aria-label") || "") + " " + (b.textContent || "") + " " + (b.title || "");
    return rx.test(t) && !badRx.test(t) && b.offsetParent !== null && !b.disabled;
  });
  if (!btn) return { added: false, reason: card ? "sin_boton_agregar" : "sin_resultados" };
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
    const key = (cart.store || "").toLowerCase();
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
        const out = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: addFirstToCart, args: [item.qty || 1] });
        res = (out && out[0] && out[0].result) || res;
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
