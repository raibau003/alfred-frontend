"use client";

interface Product {
  name: string;
  price: number;
  store: string;
  image?: string;
  url?: string;
}

interface Props {
  product: Product;
  onCompare?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onCompare, onAddToCart }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:shadow-sm transition-shadow">
      {product.image && (
        <img src={product.image} alt={product.name} className="h-12 w-12 rounded-md object-cover" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{product.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#0a1628]">${product.price.toLocaleString("es-CL")}</span>
          <span className="text-[10px] text-slate-400 uppercase">{product.store}</span>
        </div>
      </div>
      <div className="flex gap-1">
        {onCompare && (
          <button
            onClick={() => onCompare(product)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
          >
            Comparar
          </button>
        )}
        {onAddToCart && (
          <button
            onClick={() => onAddToCart(product)}
            className="rounded-md bg-[#0a1628] px-2 py-1 text-[10px] text-white hover:bg-[#1e3a5f]"
          >
            Agregar
          </button>
        )}
      </div>
    </div>
  );
}
