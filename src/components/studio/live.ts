import type { Product } from '#/db/schema'

type LiveEnums = {
  ActivityHandling: typeof import('@google/genai').ActivityHandling
  EndSensitivity: typeof import('@google/genai').EndSensitivity
  StartSensitivity: typeof import('@google/genai').StartSensitivity
  TurnCoverage: typeof import('@google/genai').TurnCoverage
}

export function buildLiveSystemInstruction(products: Product[]) {
  const catalog = products
    .map(
      (product) =>
        `${product.id}: ${product.name}, category=${product.category}, tags=${product.styleTags.join(', ')}, colors=${product.colors.join(', ')}, ${product.shortDescription}`,
    )
    .join('\n')

  return `
You are Atelier AI, a real-time voice stylist inside a physical clothing store.
Speak naturally and briefly, but do not invent or name products from memory.
When the customer asks for clothes, options, recommendations, or to choose an option, say a short acknowledgement like "I am checking the store inventory" or ask one style question.
The kiosk backend will decide exact products from the database and show them on screen.
Use tools to update the kiosk screen whenever possible, but if tools are unavailable, do not list product names yourself.
Never add multiple final products from the same clothing group unless they are alternatives.
If the customer asks to render, try on, or take a photo, call render_try_on.
After calling render_try_on, stay quiet until the rendered image appears. The kiosk will ask the customer how they feel about the look after the preview loads.
If the customer asks to see an item better, larger, closer, zoomed, opened, or with details, call expand_item with one product id.

Catalog:
${catalog}
`.trim()
}

export function buildLiveTools(
  Type: typeof import('@google/genai').Type,
  Behavior?: typeof import('@google/genai').Behavior,
) {
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

  return {
    functionDeclarations: [
      {
        name: 'show_items',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Show products on the kiosk screen as search results or alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'add_items',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Add selected products to the outfit board. Same-category products become alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'expand_item',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Expand one product on the camera view. Use when the user asks to see it better, bigger, closer, zoomed, opened, or with details.',
        parameters: productIdsSchema,
      },
      {
        name: 'clear_outfit',
        behavior: Behavior?.NON_BLOCKING,
        description: 'Clear the current outfit board.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'render_try_on',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Take the current camera frame and generate the try-on using the selected outfit.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ],
  }
}

export function buildLiveRealtimeInputConfig({
  ActivityHandling,
  EndSensitivity,
  StartSensitivity,
  TurnCoverage,
}: LiveEnums) {
  return {
    automaticActivityDetection: {
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 500,
      silenceDurationMs: 1100,
    },
    activityHandling: ActivityHandling.NO_INTERRUPTION,
    turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
  }
}
