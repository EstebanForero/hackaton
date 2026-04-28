import type { Product } from '#/db/schema'
import type { LiveMicSettings } from './types'

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
Always speak in the same language the customer is using. If the customer speaks Spanish, answer in Spanish. If the customer speaks English, answer in English.
When the customer asks for clothes, options, recommendations, or to choose an option, call the matching tool immediately. Only speak when you need a clarifying question.
The kiosk backend will decide exact products from the database and show them on screen.
Use tools to update the kiosk screen whenever possible, but if tools are unavailable, do not list product names yourself.
For instant kiosk updates like show_items, add_items, expand_item, and clear_outfit, call the tool and then stay quiet unless the customer asked a separate question.
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
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Show products on the kiosk screen as search results or alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'add_items',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Add selected products to the outfit board. Same-category products become alternatives. Prefer productIds. If the user chooses by visible option number, provide visibleIndex.',
        parameters: selectionSchema,
      },
      {
        name: 'expand_item',
        behavior: Behavior?.NON_BLOCKING,
        description:
          'Expand one product on the camera view. Prefer productIds. If the user refers to a visible option by number or "this one", provide visibleIndex.',
        parameters: selectionSchema,
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
}: LiveEnums, micSettings: LiveMicSettings) {
  return {
    automaticActivityDetection: {
      startOfSpeechSensitivity:
        micSettings.startSensitivity === 'high'
          ? StartSensitivity.START_SENSITIVITY_HIGH
          : StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity:
        micSettings.endSensitivity === 'high'
          ? EndSensitivity.END_SENSITIVITY_HIGH
          : EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: micSettings.prefixPaddingMs,
      silenceDurationMs: micSettings.silenceDurationMs,
    },
    activityHandling: ActivityHandling.NO_INTERRUPTION,
    turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
  }
}
