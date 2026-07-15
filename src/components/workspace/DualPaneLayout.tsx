"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import type { ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
}

export function DualPaneLayout({ left, right }: Props) {
  return (
    <Group orientation="horizontal" className="flex h-full w-full">
      <Panel defaultSize={40} minSize={25} className="h-full overflow-hidden">
        {left}
      </Panel>
      <Separator className="w-1 cursor-col-resize bg-surface-4 hover:bg-brand-500 transition-colors" />
      <Panel defaultSize={60} minSize={30} className="h-full overflow-hidden">
        {right}
      </Panel>
    </Group>
  );
}
