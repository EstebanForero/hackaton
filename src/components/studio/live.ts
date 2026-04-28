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
At the beginning of the session, do not show clothes or call tools until the customer asks for clothes, options, recommendations, search results, selection, try-on, or product details.
When the customer asks for clothes, options, recommendations, or to choose an option, call the matching tool immediately and give only a very short spoken acknowledgement.
The kiosk backend will decide exact products from the database and show them on screen.
Use tools to update the kiosk screen whenever possible, but if tools are unavailable, do not list product names yourself.
For instant kiosk updates like show_items, add_items, expand_item, and clear_outfit, call the tool and keep speech to one short sentence.
Never add multiple final products from the same clothing group unless they are alternatives.
If the customer chooses, selects, picks, or adds outfit items, acknowledge briefly. In Spanish, include exactly "Nos vemos en tu siguiente compra." In English, say "See you on your next shop."
If the customer asks to render, try on, or take a photo, briefly tell them to wait while the outfit renders, then call render_try_on.
After calling render_try_on, do not speak just because the rendered image appears. If the customer speaks while the image is rendering, answer normally and keep helping.
If the customer asks to see an item better, larger, closer, zoomed, opened, or with details, call expand_item with one product id.

Catalog:
${catalog}
`.trim()
}

export function buildLiveTools(
  Type: typeof import('@google/genai').Type,
  Behavior?: typeof import('@google/genai').Behavior,
  options: { nonBlocking?: boolean } = {},
) {
  const nonBlockingBehavior = options.nonBlocking ? Behavior?.NON_BLOCKING : undefined
  const withBehavior = <T extends Record<string, unknown>>(tool: T) =>
    nonBlockingBehavior ? { ...tool, behavior: nonBlockingBehavior } : tool
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
      withBehavior({
        name: 'show_items',
        description:
          'Show products on the kiosk screen as search results or alternatives.',
        parameters: productIdsSchema,
      }),
      withBehavior({
        name: 'add_items',
        description:
          'Add selected products to the outfit board. Same-category products become alternatives. Prefer productIds. If the user chooses by visible option number, provide visibleIndex.',
        parameters: selectionSchema,
      }),
      withBehavior({
        name: 'expand_item',
        description:
          'Expand one product on the camera view. Prefer productIds. If the user refers to a visible option by number or "this one", provide visibleIndex.',
        parameters: selectionSchema,
      }),
      withBehavior({
        name: 'clear_outfit',
        description: 'Clear the current outfit board.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      }),
      withBehavior({
        name: 'render_try_on',
        description:
          'Take the current camera frame and generate the try-on using the selected outfit.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      }),
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

export function supportsNonBlockingLiveTools(model: string) {
  return !model.startsWith('gemini-3.1-')
}
