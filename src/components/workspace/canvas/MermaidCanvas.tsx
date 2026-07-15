"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidPayload {
  title?: string;
  kind?: string;
  code?: string;
}

// The current viewBox of the SVG, in the SVG's intrinsic coordinate units.
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

let mermaidInited = false;

export function MermaidCanvas({ payload }: { payload: MermaidPayload }) {
  // viewportRef: clips + receives wheel/pointer events.
  // svgWrapRef: holds the rendered <svg> (which fills the viewport).
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // `base` = the natural viewBox of the diagram (the "fit" state). Set after
  // each render. `view` = the current viewBox we apply to the <svg>. Zoom/pan
  // mutate `view`; "Ajustar" resets view = base.
  const baseRef = useRef<View | null>(null);
  const [view, setView] = useState<View | null>(null);
  // Live ref of `view` for wheel/pointer handlers (avoids stale closures).
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;

  // Render generation: bumped on each successful render so dependent effects
  // re-run even when `code` is unchanged (re-mount, tab switch).
  const [renderGen, setRenderGen] = useState(0);
  const code = payload.code ?? "";

  // Drag state held in a ref — pointermove fires too often for React state.
  const dragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    originView: View;
    // SVG-units per screen-pixel at drag start (depends on current zoom + size).
    unitsPerPxX: number;
    unitsPerPxY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!mermaidInited) {
      mermaid.initialize({
        startOnLoad: false,
        // Prevents Mermaid from injecting its own bomb-icon error SVG into
        // <body> on parse failure — we render our own inline message instead.
        suppressErrorRendering: true,
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        // htmlLabels:false → labels render as native SVG <text>, not
        // foreignObject HTML. Native text scales crisply under viewBox zoom;
        // foreignObject gets raster-blurred. Global key is authoritative since
        // v11.12.3 (flowchart.htmlLabels deprecated); keep both for safety.
        htmlLabels: false,
        flowchart: { curve: "basis", htmlLabels: false, padding: 16 },
        mindmap: { padding: 20 },
        themeVariables: {
          primaryColor: "#e0e7ff",
          primaryTextColor: "#1e293b",
          primaryBorderColor: "#6366f1",
          lineColor: "#64748b",
          secondaryColor: "#f1f5f9",
          tertiaryColor: "#fafafa",
          background: "#ffffff",
          mainBkg: "#f8fafc",
          secondBkg: "#f1f5f9",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        },
      });
      mermaidInited = true;
    }
  }, []);

  // Push a viewBox onto the live <svg>. Re-renders the SVG vectorially →
  // crisp at any zoom level (no raster scaling).
  const applyViewBox = useCallback((v: View) => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  }, []);

  // Render Mermaid into the wrapper.
  useEffect(() => {
    if (!svgWrapRef.current || !code) return;
    setError(null);
    setRendering(true);

    // Sweep any residual error overlays Mermaid might have left in <body>
    // from previous failed renders (older versions ignore suppressError).
    document
      .querySelectorAll('[id^="dmermaid"], [id^="merlina-mermaid-"]')
      .forEach((el) => {
        if (el.parentElement === document.body) el.remove();
      });

    let cancelled = false;
    const id = `merlina-mermaid-${Date.now()}`;
    (async () => {
      try {
        // Validate syntax first — if it throws, we show our own message
        // without ever touching the DOM with a half-rendered SVG.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(id, code);
        if (cancelled) return;
        if (svgWrapRef.current) {
          svgWrapRef.current.innerHTML = svg;
          const el = svgWrapRef.current.querySelector("svg");
          if (el) {
            // Read the natural viewBox (the fit state). Fall back to bbox.
            let base: View | null = null;
            const vb = el.viewBox?.baseVal;
            if (vb && vb.width > 0 && vb.height > 0) {
              base = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
            } else {
              try {
                const bbox = el.getBBox();
                base = {
                  x: bbox.x,
                  y: bbox.y,
                  w: bbox.width,
                  h: bbox.height,
                };
              } catch {
                /* getBBox can throw if not yet laid out */
              }
            }
            // Make the SVG fill the viewport. Strip Mermaid's inline
            // max-width/width/height so our CSS (width/height:100%) wins, and
            // let preserveAspectRatio fit + CENTER the diagram by default.
            el.removeAttribute("width");
            el.removeAttribute("height");
            el.style.maxWidth = "none";
            el.style.width = "100%";
            el.style.height = "100%";
            el.style.display = "block";
            el.setAttribute("preserveAspectRatio", "xMidYMid meet");

            if (base) {
              baseRef.current = base;
              setView(base);
              applyViewBox(base);
            }
          }
          // Trigger dependent effects.
          setRenderGen((g) => g + 1);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        // Strip Mermaid's verbose "Expecting ..." dump to a short first line.
        const firstLine = msg.split("\n")[0].slice(0, 200);
        setError(firstLine);
        // Clear stale SVG content from last successful render.
        if (svgWrapRef.current) svgWrapRef.current.innerHTML = "";
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, applyViewBox]);

  // Reset to the fit state (base viewBox). preserveAspectRatio re-centers it.
  const fitToView = useCallback(() => {
    const base = baseRef.current;
    if (!base) return;
    setView(base);
    applyViewBox(base);
  }, [applyViewBox]);

  // Re-fit when the viewport resizes. With preserveAspectRatio="xMidYMid meet"
  // the SVG already re-centers itself on container resize, but resetting the
  // viewBox keeps zoom predictable after a resize. Only matters if the user
  // hasn't zoomed; we leave the current view if they have? — keep it simple:
  // on resize we re-apply the *current* view (no reset) so the SVG re-lays out
  // crisply, and only the initial render sets base.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const v = viewRef.current;
        if (v) applyViewBox(v);
      });
    });
    ro.observe(viewport);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [renderGen, applyViewBox]);

  // Zoom around a point given in screen pixels relative to the viewport.
  // factor > 1 = zoom in (smaller viewBox). Crisp because we change viewBox,
  // not CSS scale.
  const zoomAround = useCallback(
    (factor: number, px: number, py: number) => {
      const viewport = viewportRef.current;
      const v = viewRef.current;
      const base = baseRef.current;
      if (!viewport || !v || !base) return;

      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      if (vw === 0 || vh === 0) return;

      // Clamp by comparing widths against base (scale = base.w / view.w).
      const curScale = base.w / v.w;
      let nextScale = curScale * factor;
      nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      if (nextScale === curScale) return;

      const newW = base.w / nextScale;
      const newH = base.h / nextScale;

      // preserveAspectRatio="meet" letterboxes: the SVG is scaled uniformly to
      // fit the viewport, centered. Compute the SVG-unit coordinate currently
      // under (px,py), then keep it fixed after the zoom.
      const fitScale = Math.min(vw / v.w, vh / v.h); // px per SVG-unit
      const drawnW = v.w * fitScale;
      const drawnH = v.h * fitScale;
      const offsetX = (vw - drawnW) / 2; // letterbox offset (px)
      const offsetY = (vh - drawnH) / 2;
      // SVG-unit point under the cursor.
      const ux = v.x + (px - offsetX) / fitScale;
      const uy = v.y + (py - offsetY) / fitScale;

      // After zoom, the new fit scale (px per unit) for the new viewBox.
      const newFitScale = Math.min(vw / newW, vh / newH);
      const newDrawnW = newW * newFitScale;
      const newDrawnH = newH * newFitScale;
      const newOffsetX = (vw - newDrawnW) / 2;
      const newOffsetY = (vh - newDrawnH) / 2;
      // Solve for new viewBox x,y so that (ux,uy) maps back to (px,py).
      const nx = ux - (px - newOffsetX) / newFitScale;
      const ny = uy - (py - newOffsetY) / newFitScale;

      const next: View = { x: nx, y: ny, w: newW, h: newH };
      setView(next);
      applyViewBox(next);
    },
    [applyViewBox],
  );

  // Wheel zoom toward the cursor. Non-passive so we can preventDefault
  // (stops the page/panel from scrolling while zooming).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(factor, px, py);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  // Pan with pointer drag. Move the viewBox x,y in SVG units (screen delta
  // converted via the current fit scale).
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const viewport = viewportRef.current;
    const v = viewRef.current;
    if (!viewport || !v) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const fitScale = Math.min(vw / v.w, vh / v.h); // px per SVG-unit
    if (!Number.isFinite(fitScale) || fitScale === 0) return;
    dragRef.current = {
      active: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originView: v,
      unitsPerPxX: 1 / fitScale,
      unitsPerPxY: 1 / fitScale,
    };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const dxPx = e.clientX - d.startClientX;
      const dyPx = e.clientY - d.startClientY;
      // Drag right → content follows cursor → viewBox x decreases.
      const next: View = {
        ...d.originView,
        x: d.originView.x - dxPx * d.unitsPerPxX,
        y: d.originView.y - dyPx * d.unitsPerPxY,
      };
      setView(next);
      applyViewBox(next);
    },
    [applyViewBox],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      setDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
  }, []);

  // Button zoom — toward the viewport center.
  const zoomButton = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      zoomAround(factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
    },
    [zoomAround],
  );

  // % = base.w / view.w * 100 (current zoom relative to the fit state).
  const zoomPct =
    view && baseRef.current
      ? Math.round((baseRef.current.w / view.w) * 100)
      : 100;

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center justify-between border-b border-surface-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {payload.title ?? "Diagrama"}
          </h2>
          {rendering && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </span>
              Renderizando…
            </span>
          )}
        </div>
        {payload.kind && (
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {payload.kind}
          </span>
        )}
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <div className="font-medium">Error renderizando Mermaid</div>
          <div className="mt-0.5 font-mono">{error}</div>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {rendering && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <svg
                className="h-8 w-8 animate-spin text-indigo-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-xs text-slate-500">Renderizando diagrama…</div>
            </div>
          </div>
        )}

        {!code ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Sin diagrama.
          </div>
        ) : (
          <>
            {/* Viewport: clips, captures wheel/drag. The <svg> fills it and
                zoom/pan happen via viewBox (crisp vector re-render). */}
            <div
              ref={viewportRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              onPointerCancel={endDrag}
              className="absolute inset-0 touch-none select-none"
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              {/* Mermaid injects the <svg> here; it's sized to 100%/100%. */}
              <div ref={svgWrapRef} className="h-full w-full" />
            </div>

            {/* Floating controls */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-surface-4 bg-white/90 p-1 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => zoomButton(1 / 1.2)}
                aria-label="Alejar"
                title="Alejar"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span className="min-w-[3rem] select-none text-center text-xs tabular-nums text-slate-500">
                {zoomPct}%
              </span>
              <button
                type="button"
                onClick={() => zoomButton(1.2)}
                aria-label="Acercar"
                title="Acercar"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <span className="mx-0.5 h-4 w-px bg-surface-4" />
              <button
                type="button"
                onClick={fitToView}
                title="Ajustar al área"
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                Ajustar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
