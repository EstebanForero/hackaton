import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Storefront } from '#/components/Storefront'
import { productsQueryOptions } from '#/server/productQueries'

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(productsQueryOptions()),
  component: Home,
})

function Home() {
  const { data: products } = useSuspenseQuery(productsQueryOptions())
  const heroProduct = products[0]

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Modern retail platform</p>
          <h1>Business-ready clothing with an AI fitting room.</h1>
          <p>
            Browse a polished product catalog, then step into the in-store
            voice assistant to search, style, and prepare virtual try-on photos.
          </p>
          <div className="hero-actions">
            <a href="#catalog">Shop collection</a>
            <Link to="/studio">Launch AI studio</Link>
          </div>
        </div>
        {heroProduct ? (
          <div className="hero-card">
            <img src={heroProduct.imageUrl} alt={heroProduct.imageAlt} />
            <div>
              <span>Featured</span>
              <strong>{heroProduct.name}</strong>
              <p>{heroProduct.imageDescription}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="store-intro" id="catalog">
        <div>
          <p className="eyebrow">Curated catalog</p>
          <h2>Sharp pieces for work, travel, and occasion dressing.</h2>
        </div>
        <p>
          Every seeded item includes product copy, image alt text, image
          descriptions, colors, sizes, materials, and style tags for AI search.
        </p>
      </section>

      <Storefront products={products} />
    </main>
  )
}
