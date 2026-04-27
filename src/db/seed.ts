import { db, pool } from './client'
import { productSeed } from './products-seed'
import { products } from './schema'

export async function seedProducts() {
  for (const product of productSeed) {
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: product.name,
          category: product.category,
          price: product.price,
          currency: product.currency,
          shortDescription: product.shortDescription,
          description: product.description,
          imageUrl: product.imageUrl,
          imageAlt: product.imageAlt,
          imageDescription: product.imageDescription,
          colors: product.colors,
          sizes: product.sizes,
          material: product.material,
          styleTags: product.styleTags,
          inventory: product.inventory,
          updatedAt: new Date(),
        },
      })
  }
}

if (import.meta.main) {
  await seedProducts()
  await pool.end()
}
