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

// Heurística inyectada en la página de la tienda: hace click en el primer "Agregar" del
// primer producto del resultado de búsqueda. Los selectores varían por tienda → best-effort v1.
function addFirstToCart(qty) {
  const rx = /(agregar|añadir|add to cart|agregar al carro|sumar al carro)/i;
  const candidates = [...document.querySelectorAll('button, a[role="button"], [role="button"], [data-testid*="add"], [class*="add-to-cart"], [class*="addToCart"]')];
  const btn = candidates.find((b) => {
    const t = (b.getAttribute("aria-label") || "") + " " + (b.textContent || "") + " " + (b.title || "");
    return rx.test(t) && b.offsetParent !== null;
  });
  if (btn) { for (let k = 0; k < (qty || 1); k++) btn.click(); return true; }
  return false;
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
      try {
        await chrome.tabs.update(tab.id, { url: store.search(item.name) });
        await waitTabLoad(tab.id);
        await sleep(1600);
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: addFirstToCart, args: [item.qty || 1] });
      } catch {}
      state.progress[cart.store].done = i + 1;
      state.progress[cart.store].status = "adding";
      report(alfredTabId);
    }
    state.progress[cart.store].status = "done";
    report(alfredTabId);
  }

  state.running = false;
  report(alfredTabId);
}
