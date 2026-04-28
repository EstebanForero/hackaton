import type { Product } from '#/db/schema'
import type { OutfitSlot } from './types'

export const slotLabels: Record<OutfitSlot, string> = {
  outerwear: 'Outerwear',
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  footwear: 'Footwear',
  accessory: 'Accessory',
}

export function getSlot(product: Product): OutfitSlot {
  if (product.category === 'tops') return 'top'
  if (product.category === 'bottoms') return 'bottom'
  if (product.category === 'dresses') return 'dress'
  if (product.category === 'accessories') return 'accessory'
  return product.category
}

export function buildRenderableOutfit(
  selectedProducts: Product[],
  immediateProducts: Product[],
) {
  const productsBySlot = new Map<OutfitSlot, Product>()

  for (const product of selectedProducts) {
    productsBySlot.set(getSlot(product), product)
  }

  for (const product of immediateProducts) {
    productsBySlot.set(getSlot(product), product)
  }

  return Array.from(productsBySlot.values())
}
