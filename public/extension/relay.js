// Alfred Carritos — content script en el sitio de Alfred.
// Puente entre la página de Compras (window.postMessage) y el service worker de la extensión.

// La página pide armar los carritos
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__alfred !== "build_carts") return;
  try { chrome.runtime.sendMessage({ type: "BUILD_CARTS", spec: e.data.spec }); } catch {}
});

// El service worker informa progreso → lo reenviamos a la página
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "CART_PROGRESS") {
    window.postMessage({ __alfred: "progress", progress: msg.progress, running: msg.running }, "*");
  }
});

// Avisar a la página que la extensión está instalada
window.postMessage({ __alfred: "present", version: "1.0.0" }, "*");
