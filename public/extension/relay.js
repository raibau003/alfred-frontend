// Alfred Carritos — content script en el sitio de Alfred.
// Puente entre la página de Compras (window.postMessage) y el service worker de la extensión.

// La página pide armar los carritos, o hace ping para detectar la extensión
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data) return;
  if (e.data.__alfred === "build_carts") {
    try { chrome.runtime.sendMessage({ type: "BUILD_CARTS", spec: e.data.spec }); } catch {}
  } else if (e.data.__alfred === "ping") {
    window.postMessage({ __alfred: "present", version: "1.0.0" }, "*");
  }
});

// El service worker informa progreso → lo reenviamos a la página
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "CART_PROGRESS") {
    window.postMessage({ __alfred: "progress", progress: msg.progress, running: msg.running }, "*");
  }
});

// Avisar a la página que la extensión está instalada
window.postMessage({ __alfred: "present", version: "1.0.0" }, "*");
