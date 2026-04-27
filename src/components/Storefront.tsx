import type { Product } from '#/db/schema'

type StorefrontProps = {
  products: Product[]
  onSelect?: (product: Product) => void
}

export function Storefront({ products, onSelect }: StorefrontProps) {
  return (
    <section className="catalog-grid">
      {products.map((product) => (
        <article className="product-card" key={product.id}>
          <button
            className="product-image-button"
            onClick={() => onSelect?.(product)}
            type="button"
          >
            <img src={product.imageUrl} alt={product.imageAlt} loading="lazy" />
          </button>
          <div className="product-copy">
            <div className="product-meta">
              <span>{product.category}</span>
              <span>
                {product.currency} {Number(product.price).toFixed(2)}
              </span>
            </div>
            <h3>{product.name}</h3>
            <p>{product.shortDescription}</p>
            <div className="swatches" aria-label={`${product.name} colors`}>
              {product.colors.map((color) => (
                <span key={color}>{color}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
