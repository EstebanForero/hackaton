import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { VoiceTryOnStudio } from '#/components/VoiceTryOnStudio'
import { productsQueryOptions } from '#/server/productQueries'

export const Route = createFileRoute('/studio')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(productsQueryOptions()),
  component: Studio,
})

function Studio() {
  const { data: products } = useSuspenseQuery(productsQueryOptions())

  return (
    <main className="studio-page">
      <section className="studio-hero">
        <p className="eyebrow">Physical store kiosk</p>
        <h1>Camera-led shopping, controlled by voice.</h1>
        <p>
          This tab is designed for placement inside the store. It uses the
          browser camera, speech recognition, product search, recommendations,
          and an AI image-generation handoff for virtual try-on.
        </p>
      </section>
      <VoiceTryOnStudio products={products} />
    </main>
  )
}
