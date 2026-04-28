import type { Product } from '#/db/schema'

export type OutfitSlot =
  | 'outerwear'
  | 'top'
  | 'bottom'
  | 'dress'
  | 'footwear'
  | 'accessory'

export type OutfitGroup = {
  slot: OutfitSlot
  selected: Product
  alternatives: Product[]
  reason: string
}

export type VoiceDebugInfo = {
  transcript: string
  reply: string
  addProductIds: string[]
  visibleProductIds: string[]
  expandedProductId: string
  clearOutfit: boolean
  tryOnRequested: boolean
  needsClarification: boolean
  question: string
  model: string
}

export type LiveEvent = {
  id: number
  text: string
}

export type LiveInputMode =
  | 'idle'
  | 'listening'
  | 'hearing'
  | 'muted'
  | 'recording'

export type TryOnResult = {
  imageUrl: string
  message: string
  generationPrompt: string
  imageModel: string
  status: 'generated' | 'failed' | 'mock'
  references: Array<{
    id: string
    name: string
    category: Product['category']
    imageUrl: string
    imageDescription: string
  }>
}
