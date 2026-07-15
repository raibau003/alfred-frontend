"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";

interface Props {
  nodeId: string;
  onClose: () => void;
}

export function NodeInspector({ nodeId, onClose }: Props) {
  const node = useWorkflowStore((s) =>
    s.workflow?.nodes.find((n) => n.id === nodeId)
  );
  const block = useWorkflowStore((s) =>
    node ? s.catalog.find((b) => b.id === node.blockId) : undefined
  );
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const [label, setLabel] = useState(node?.label ?? "");
  const [intent, setIntent] = useState(node?.intent ?? "");

  useEffect(() => {
    if (!node) return;
    setLabel(node.label);
    setIntent(node.intent ?? "");
  }, [nodeId, node]);

  if (!node) {
    return (
      <aside className="flex h-full w-80 flex-col border-l border-surface-4 bg-surface-2 p-3 text-xs text-slate-400">
        Nodo no encontrado.
      </aside>
    );
  }

  function commitLabel() {
    if (!node) return;
    const next = label.trim() || node.label;
    if (next !== node.label) updateNode(node.id, { label: next });
  }

  function commitIntent() {
    if (!node) return;
    updateNode(node.id, { intent });
  }

  const placeholder =
    block?.intentPlaceholder ??
    "Describí qué querés que haga este paso. El agente lo interpreta libremente.";

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-surface-4 bg-surface-2">
      <div className="flex items-center justify-between border-b border-surface-4 px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Configurar paso
          </div>
          <div className="font-mono text-[10px] text-slate-400">{node.id}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-surface-3 hover:text-slate-900"
          title="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Tipo
          </div>
          <div className="font-mono text-xs text-slate-600">{node.kind}</div>
          <div className="font-mono text-[10px] text-slate-400">{node.blockId}</div>
          {block?.description && (
            <div className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {block.description}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Etiqueta del nodo
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full rounded-md border border-surface-4 bg-surface-1 px-2 py-1 text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
            placeholder="Nombre visible"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Intención
          </label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onBlur={commitIntent}
            rows={6}
            className="w-full resize-y rounded-md border border-surface-4 bg-surface-1 px-2 py-1.5 text-xs leading-relaxed text-slate-900 focus:border-brand-600 focus:outline-none"
            placeholder={placeholder}
          />
          <div className="mt-1 text-[10px] text-slate-400">
            Texto libre. El agente lo interpreta usando los tools y MCPs que tenga
            disponibles. Mencioná creds, formato, restricciones — lo que quieras.
          </div>
        </div>
      </div>
    </aside>
  );
}
