import { Behavior, Type } from '@google/genai'
import type { Product } from '#/db/schema'
import { getChatModel } from './geminiConfig'

export function buildVoiceCommandPrompt(
  catalog: Product[],
  currentProductIds: string[],
  visibleProductIds: string[] = [],
) {
  const productLines = buildCatalogLines(catalog)

  return `
You are an in-store fashion voice assistant. Listen to the audio and decide what the customer wants.

Catalog:
${productLines}

Current selected product ids: ${currentProductIds.join(', ') || 'none'}
Current visible option ids in screen order: ${visibleProductIds.join(', ') || 'none'}

Return only JSON with this exact shape:
{
  "status": "ok",
  "transcript": "what the customer said",
  "reply": "short spoken response for the kiosk",
  "addProductIds": ["product ids to add to the outfit board"],
  "visibleProductIds": ["product ids to show as search results"],
  "expandedProductId": "one product id to show enlarged, or empty string",
  "clearOutfit": false,
  "tryOnRequested": false,
  "needsClarification": false,
  "question": "",
  "model": "${getChatModel()}"
}

Rules:
- Act like a consultative stylist, not a search box.
- Write reply and question in the same language the customer used in the transcript or text.
- You are inventory-locked. Only recommend, show, or add products whose ids appear in the catalog above.
- If the customer says "choose this", "pick that", "the first one", "option two", "the blazer", or similar, interpret it against Current visible option ids first, then current selected ids, then catalog.
- If choosing from visible options, put the chosen id in addProductIds and keep visibleProductIds as the visible option list unless the user asks for new options.
- If the user asks "show me better", "make it bigger", "zoom in", "open that one", "show details", or similar, choose one product from Current visible option ids first, then current selected ids, then catalog, and put it in expandedProductId.
- If the user asks vaguely for recommendations, an outfit, clothes, or "what should I wear" and you do not know occasion, style, color preference, fit, or formality, ask one short clarifying question first.
- When asking a question, set needsClarification true, put the question in question, keep addProductIds empty, and visibleProductIds empty unless useful examples help.
- Good first questions: occasion, preferred style, color palette, comfort/formality, weather, or whether they want bold vs minimal.
- If the user asks for a category, style, color, outfit, or recommendation, choose matching products from the catalog.
- Add only useful products. Do not add repeated same-category products unless they are alternatives.
- If the user asks to clear, reset, or start over, set clearOutfit true.
- If the user asks to try on, take a photo, render, or generate the outfit, set tryOnRequested true.
- visibleProductIds can include alternatives, but addProductIds should be concise.
`.trim()
}

export function buildLiveSystemInstruction(catalog: Product[]) {
  return `
You are Atelier AI, a real-time voice stylist inside a physical clothing store.
You have access to the store inventory below and must never claim you have no inventory.
Use only these catalog products. Do not mention online stores.
Always speak in the same language the customer is using. If the customer speaks Spanish, answer in Spanish. If the customer speaks English, answer in English.
When the customer asks for clothes, options, recommendations, or to choose an option, call the matching tool immediately. Only speak when you need a clarifying question.
When the user asks what clothes are available, call show_items with relevant product ids.
When the user asks to choose, select, pick, or add an option, call add_items with selected product ids.
When the user asks to see a product better, larger, closer, zoomed, opened, or with details, call expand_item with one product id.
When the user asks to clear the outfit, call clear_outfit.
For instant kiosk updates like show_items, add_items, expand_item, and clear_outfit, call the tool and then stay quiet unless the customer asked a separate question.
When the user asks to render, try on, generate, or take a photo, call render_try_on.
After calling render_try_on, stay quiet until the rendered image is loaded. The kiosk will ask the customer how they feel about the look after the preview appears.
If the user request is vague, ask one short style question, but still use tools when showing or adding concrete products.

Catalog:
${buildCatalogLines(catalog)}
`.trim()
}

export function buildLiveTools() {
  const productIdsSchema = {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ['productIds'],
  }
  const selectionSchema = {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      visibleIndex: {
        type: Type.INTEGER,
        description:
          '1-based index from the currently visible kiosk options when the user says first, second, this one, that one, or similar.',
      },
    },
  }

  return {
    functionDeclarations: [
      {
        name: 'show_items',
        behavior: Behavior.NON_BLOCKING,
        description:
          'Show specific store catalog products on the kiosk screen. Use this for availability, options, recommendations, search results, and alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'add_items',
        behavior: Behavior.NON_BLOCKING,
        description:
          'Add selected catalog products to the outfit board. Use this when the user chooses, selects, picks, accepts, or asks to add an option. Prefer productIds. If the user chooses by visible option number, provide visibleIndex.',
        parameters: selectionSchema,
      },
      {
        name: 'expand_item',
        behavior: Behavior.NON_BLOCKING,
        description:
          'Expand one catalog product on the kiosk camera view. Use this when the user asks to see an item better, bigger, closer, zoomed, opened, or with details. Prefer productIds. If the user refers to a visible option by number or "this one", provide visibleIndex.',
        parameters: selectionSchema,
      },
      {
        name: 'clear_outfit',
        behavior: Behavior.NON_BLOCKING,
        description: 'Clear the current outfit board.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'render_try_on',
        behavior: Behavior.NON_BLOCKING,
        description:
          'Render the current selected outfit on the customer using the camera photo.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ],
  }
}

export function buildTryOnPrompt(
  selectedProducts: Product[],
  userPrompt: string,
) {
  const garmentDescriptions = selectedProducts
    .map(
      (product, index) =>
        `REQUIRED_GARMENT_${index + 1}: id=${product.id}; category=${product.category}; name=${product.name}; imageUrl=${product.imageUrl}; visual=${product.imageDescription}`,
    )
    .join(' | ')
  const requiredChecklist = selectedProducts
    .map(
      (product, index) =>
        `${index + 1}. ${product.name} (${product.category}) from reference image ${index + 1}`,
    )
    .join('; ')

  return [
    'Edit the first image, which is the original customer camera photo and the only source for the real person.',
    'Keep the person from the original camera photo the same: same face, hair, skin tone, body shape, proportions, pose, expression, age, identity, lighting, and store scene.',
    'Use the garment reference images only as clothing references. Do not copy the model, face, body, pose, skin, hair, hands, background, or identity from any garment reference image.',
    'Every selected garment is mandatory. The final image must include all required selected garments that are visible in the camera framing. Do not omit a selected garment, swap it for a different garment, or replace it with a similar generic item.',
    `Required garment checklist: ${requiredChecklist}`,
    'Use ONLY the selected garment reference images that follow the camera photo for garment design. Do not use memory, brand assumptions, or generic clothing.',
    `Selected garments to apply exactly: ${garmentDescriptions}`,
    'Transfer the exact visible garment design from each required reference image: color, fabric, collar, sleeves, pockets, pattern, buttons, zipper, hem, silhouette, and proportions.',
    'Place the referenced garments realistically on the person in the camera photo: align to body pose, preserve natural folds, scale, occlusion, and perspective.',
    'For body areas without a selected garment reference, keep the original camera-photo clothing or visible body unchanged. Do not invent extra clothes, shoes, accessories, logos, or colors.',
    'Preserve the real customer identity and camera-photo body exactly; only the required selected clothing should change.',
    'Do not return the original image unchanged. The output must visibly dress the customer in every selected garment reference image.',
    'Use only one final item per outfit group unless the groups are complementary accessories.',
    `Styling instruction from voice assistant: ${userPrompt}`,
  ].join(' ')
}

export function buildTryOnReferences(selectedProducts: Product[]) {
  return selectedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl,
    imageDescription: product.imageDescription,
  }))
}

function buildCatalogLines(catalog: Product[]) {
  return catalog
    .map(
      (product) =>
        [
          `id=${product.id}`,
          `name=${product.name}`,
          `category=${product.category}`,
          `tags=${product.styleTags.join(', ')}`,
          `colors=${product.colors.join(', ')}`,
          `description=${product.shortDescription}`,
        ].join(' | '),
    )
    .join('\n')
}
