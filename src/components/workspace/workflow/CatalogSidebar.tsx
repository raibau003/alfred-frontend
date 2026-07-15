"use client";

import { useMemo, useState, DragEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { CatalogBlock, BlockKind } from "@/lib/workflow/types";

// Kinds visible to the user by default. Everything else is hidden behind
// the "Avanzado" toggle — the philosophy is: the user expresses WHAT in
// natural language, the agent decides HOW using whatever tools it has.
const USER_KINDS: BlockKind[] = ["semantic_step", "control_flow"];

function partition(blocks: CatalogBlock[]) {
  const userFacing: CatalogBlock[] = [];
  const advanced: CatalogBlock[] = [];
  for (const b of blocks) {
    (USER_KINDS.includes(b.kind) ? userFacing : advanced).push(b);
  }
  return { userFacing, advanced };
}

function groupBlocks(blocks: CatalogBlock[]) {
  const map = new Map<string, CatalogBlock[]>();
  for (const block of blocks) {
    const key = block.group ?? "Otros";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(block);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function CatalogSidebar() {
  const catalog = useWorkflowStore((s) => s.catalog);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { userFacing, advanced } = useMemo(() => partition(catalog), [catalog]);
  const userGroups = useMemo(() => groupBlocks(userFacing), [userFacing]);
  const advancedGroups = useMemo(() => groupBlocks(advanced), [advanced]);

  function onDragStart(e: DragEvent<HTMLDivElement>, block: CatalogBlock) {
    e.dataTransfer.setData("application/merlina-block", JSON.stringify(block));
    e.dataTransfer.effectAllowed = "move";
  }

  if (catalog.length === 0) {
    return (
      <div className="h-full w-64 bg-surface-2 p-3 text-xs text-slate-400">
        Cargando catálogo del agente...
      </div>
    );
  }

  return (
    <aside className="h-full w-64 shrink-0 overflow-y-auto bg-surface-2">
      <div className="sticky top-0 z-10 border-b border-surface-4 bg-surface-2 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Bloques
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          Arrastralos al lienzo. Describí qué querés en lenguaje natural.
        </div>
      </div>

      {userGroups.map(([group, blocks]) => (
        <BlockGroup key={group} title={group} blocks={blocks} onDragStart={onDragStart} />
      ))}

      {advanced.length > 0 && (
        <div className="border-t border-surface-4 mt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between bg-surface-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-surface-4 hover:text-slate-700 transition-colors"
            title="Tools y MCPs crudos. Normalmente no hace falta usarlos — el agente los invoca solo cuando es necesario."
          >
            <span>Avanzado (tools crudos)</span>
            {showAdvanced ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          {showAdvanced && (
            <>
              <div className="px-3 py-1.5 text-[10px] leading-snug text-slate-400 border-b border-surface-4 bg-surface-2">
                Estos son los tools/MCPs reales del agente. El agente los usa solo cuando le hacen falta — preferí los bloques de arriba.
              </div>
              {advancedGroups.map(([group, blocks]) => (
                <BlockGroup
                  key={group}
                  title={group}
                  blocks={blocks}
                  onDragStart={onDragStart}
                  muted
                />
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function BlockGroup({
  title,
  blocks,
  onDragStart,
  muted = false,
}: {
  title: string;
  blocks: CatalogBlock[];
  onDragStart: (e: DragEvent<HTMLDivElement>, block: CatalogBlock) => void;
  muted?: boolean;
}) {
  return (
    <div className="border-b border-surface-4 last:border-b-0">
      <div className="bg-surface-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {title}
      </div>
      <div className="py-1">
        {blocks.map((block) => (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => onDragStart(e, block)}
            className={`mx-2 my-0.5 cursor-grab rounded-md border border-transparent px-2 py-1.5 text-xs transition-colors hover:border-surface-4 hover:bg-white active:cursor-grabbing ${
              muted
                ? "bg-surface-2 text-slate-500 hover:text-slate-900"
                : "bg-surface-1 text-slate-900"
            }`}
            title={block.description ?? block.label}
          >
            <span className="mr-1.5">{block.icon ?? "🔧"}</span>
            {block.label}
          </div>
        ))}
      </div>
    </div>
  );
}
