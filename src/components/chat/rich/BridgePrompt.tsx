"use client";

import { Download, Monitor, ExternalLink } from "lucide-react";

interface Props {
  store: string;
  checkoutUrl?: string;
  onAction: (message: string) => void;
}

export function BridgePrompt({ store, checkoutUrl, onAction }: Props) {
  return (
    <div className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-yellow-700" />
        <p className="text-xs font-semibold text-yellow-900">
          Para pagar en {store} necesito abrir tu browser
        </p>
      </div>

      <p className="text-[10px] text-yellow-700">
        Instala la extension de Chrome de Alfred para que pueda abrir {store}, agregar los productos al carro y dejarte en el checkout.
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href="/alfred-bridge-extension.zip"
          download
          className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-yellow-700"
        >
          <Download className="h-3 w-3" /> Descargar Extension Chrome
        </a>
        {checkoutUrl && (
          <a
            href={checkoutUrl}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-md border border-yellow-300 px-3 py-1.5 text-[10px] text-yellow-700 hover:bg-yellow-100"
          >
            <ExternalLink className="h-3 w-3" /> Abrir {store} manualmente
          </a>
        )}
        <button
          onClick={() => onAction("dame los links directos de cada producto para agregarlos manualmente")}
          className="inline-flex items-center gap-1 rounded-md border border-yellow-300 px-3 py-1.5 text-[10px] text-yellow-700 hover:bg-yellow-100"
        >
          Links directos
        </button>
      </div>
    </div>
  );
}
