"use client";

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    brand?: string | null;
    price: number;
    salePrice?: number | null;
    pricePerUnit?: number | null;
    unit?: string | null;
    size?: string | null;
    store: string;
    storeSlug?: string;
    imageUrl?: string | null;
    onSale?: boolean;
    savings?: number;
    savingsPercent?: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="flex gap-3 items-center border rounded-lg px-3 py-2 bg-card">
      {/* Product image */}
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="size-12 object-contain rounded bg-muted shrink-0"
        />
      ) : (
        <div className="size-12 rounded bg-muted shrink-0 flex items-center justify-center text-muted-foreground text-[10px]">
          N/A
        </div>
      )}

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {product.brand && `${product.brand} · `}
          {product.size && `${product.size} · `}
          {product.store}
        </p>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        {product.onSale && product.salePrice ? (
          <>
            <p className="text-sm font-bold text-green-600">
              {product.salePrice.toFixed(2)}$
            </p>
            <p className="text-xs text-muted-foreground line-through">
              {product.price.toFixed(2)}$
            </p>
          </>
        ) : (
          <p className="text-sm font-bold">{product.price.toFixed(2)}$</p>
        )}
        {product.pricePerUnit && product.unit && (
          <p className="text-[10px] text-muted-foreground">
            {product.pricePerUnit.toFixed(2)}$/{product.unit}
          </p>
        )}
      </div>
    </div>
  );
}
