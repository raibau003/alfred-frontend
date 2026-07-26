// Alfred Carritos — popup: muestra el progreso del armado.
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function render(state) {
  const wrap = document.getElementById("stores");
  const empty = document.getElementById("empty");
  const entries = Object.entries((state && state.progress) || {});
  if (entries.length === 0) { wrap.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  wrap.innerHTML = entries.map(([store, p]) => {
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    const label = p.status === "done" ? `<span class="done">¡Carrito listo!</span>`
      : p.status === "error" ? `<span style="color:#dc2626">Error</span>`
      : p.status === "opening" ? "Conectando…" : `${p.done}/${p.total} productos`;
    return `<div class="store">
      <div style="flex:1">
        <div class="name">${esc(p.name || store)}</div>
        <div class="bar"><div style="width:${pct}%"></div></div>
      </div>
      <div class="stat">${label}</div>
    </div>`;
  }).join("");
}

function poll() {
  try {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
      if (chrome.runtime.lastError) { chrome.storage.local.get("alfredState", (d) => render(d.alfredState)); return; }
      render(state);
    });
  } catch { chrome.storage.local.get("alfredState", (d) => render(d.alfredState)); }
}
poll();
setInterval(poll, 1000);
