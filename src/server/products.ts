import { GoogleGenAI, Modality, Type } from '@google/genai'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/client'
import { products, type Product } from '#/db/schema'

export const listProducts = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.select().from(products).orderBy(desc(products.createdAt))
  },
)

export const searchProducts = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      query: z.string().trim().default(''),
      category: z.string().trim().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const query = `%${data.query}%`
    const filters = []

    if (data.query) {
      filters.push(
        or(
          ilike(products.name, query),
          ilike(products.description, query),
          ilike(products.shortDescription, query),
          sql`${products.styleTags}::text ilike ${query}`,
          sql`${products.colors}::text ilike ${query}`,
        ),
      )
    }

    if (data.category) {
      filters.push(eq(products.category, data.category as Product['category']))
    }

    return db
      .select()
      .from(products)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(products.createdAt))
  })

const tryOnInput = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(6),
  prompt: z.string().trim().min(1),
  photoDataUrl: z.string().startsWith('data:image/'),
})

export const createVirtualTryOn = createServerFn({ method: 'POST' })
  .inputValidator(tryOnInput)
  .handler(async ({ data }) => {
    const selectedProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, data.productIds))

    if (!selectedProducts.length) {
      throw new Error('Products not found')
    }

    const generationPrompt = buildTryOnPrompt(selectedProducts, data.prompt)

    if (!process.env.GEMINI_API_KEY) {
      return {
        status: 'mock' as const,
        products: selectedProducts,
        references: buildTryOnReferences(selectedProducts),
        imageUrl: data.photoDataUrl,
        message:
          'GEMINI_API_KEY is not configured. Returning the captured photo and a prompt that can be sent to Gemini/Nano Banana.',
        chatModel: getChatModel(),
        imageModel: getImageModel(),
        generationPrompt,
      }
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      const referenceImages = await Promise.all(
        selectedProducts.map((product) => fetchImageAsInlineData(product.imageUrl)),
      )
      const userPhoto = parseImageDataUrl(data.photoDataUrl)
      const response = await ai.models.generateContent({
        model: getImageModel(),
        contents: [
          {
            role: 'user',
            parts: [
              { text: generationPrompt },
              {
                text:
                  'CUSTOMER_CAMERA_IMAGE_START: edit this image. Keep the person and camera scene; only replace/add the selected garments.',
              },
              {
                inlineData: {
                  mimeType: userPhoto.mimeType,
                  data: userPhoto.base64,
                },
              },
              {
                text:
                  'CUSTOMER_CAMERA_IMAGE_END. The following images are exact selected garment references. Do not invent product design, pattern, color, logos, pockets, or silhouette beyond these references.',
              },
              ...referenceImages.flatMap((image, index) => {
                const product = selectedProducts[index]

                return [
                  {
                    text: [
                      `GARMENT_REFERENCE_${index + 1}_START`,
                      `Selected product id: ${product?.id}`,
                      `Selected product name: ${product?.name}`,
                      `Selected product category: ${product?.category}`,
                      `Selected product image URL: ${product?.imageUrl}`,
                      `Visual description: ${product?.imageDescription}`,
                      'Use this exact garment image as the source of truth for color, fabric, cut, pockets, collar, pattern, and silhouette.',
                    ].join('\n'),
                  },
                  {
                    inlineData: {
                      mimeType: image.mimeType,
                      data: image.base64,
                    },
                  },
                  { text: `GARMENT_REFERENCE_${index + 1}_END` },
                ]
              }),
            ],
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      })
      const generatedImage = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/'),
      )?.inlineData

      if (!generatedImage?.data) {
        return {
          status: 'failed' as const,
          products: selectedProducts,
          references: buildTryOnReferences(selectedProducts),
          imageUrl: data.photoDataUrl,
          message:
            'Gemini image generation did not return an edited image. Showing the source photo instead.',
          chatModel: getChatModel(),
          imageModel: getImageModel(),
          generationPrompt,
        }
      }

      return {
        status: 'generated' as const,
        products: selectedProducts,
        references: buildTryOnReferences(selectedProducts),
        imageUrl: `data:${generatedImage.mimeType ?? 'image/png'};base64,${generatedImage.data}`,
        message: `Generated virtual try-on with ${getImageModel()} using your camera photo and ${selectedProducts.length} garment reference image${selectedProducts.length === 1 ? '' : 's'}.`,
        chatModel: getChatModel(),
        imageModel: getImageModel(),
        generationPrompt,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      return {
        status: 'failed' as const,
        products: selectedProducts,
        references: buildTryOnReferences(selectedProducts),
        imageUrl: data.photoDataUrl,
        message: `Gemini image generation failed: ${reason}. Showing the source photo instead.`,
        chatModel: getChatModel(),
        imageModel: getImageModel(),
        generationPrompt,
      }
    }

  })

const voiceCommandInput = z.object({
  audioDataUrl: z.string().startsWith('data:audio/'),
  currentProductIds: z.array(z.string().uuid()).max(6).default([]),
})

const textCommandInput = z.object({
  text: z.string().trim().min(1),
  currentProductIds: z.array(z.string().uuid()).max(6).default([]),
  visibleProductIds: z.array(z.string().uuid()).max(8).default([]),
})

export const processVoiceCommand = createServerFn({ method: 'POST' })
  .inputValidator(voiceCommandInput)
  .handler(async ({ data }) => {
    const catalog = await db.select().from(products).orderBy(desc(products.createdAt))

    if (!process.env.GEMINI_API_KEY) {
      return {
        status: 'mock' as const,
        transcript: '',
        reply:
          'GEMINI_API_KEY is not configured. Add your key to .env to enable model voice commands.',
        addProductIds: [] as string[],
        visibleProductIds: [] as string[],
        expandedProductId: '',
        clearOutfit: false,
        tryOnRequested: false,
        needsClarification: true,
        question:
          'What style are you going for today: business, casual, evening, or travel?',
        model: getChatModel(),
      }
    }

    const { mimeType, base64 } = parseAudioDataUrl(data.audioDataUrl)
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: getChatModel(),
      contents: [
        {
          text: buildVoiceCommandPrompt(catalog, data.currentProductIds),
        },
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    return voiceCommandResponse.parse(JSON.parse(response.text ?? '{}'))
  })

export const processTextCommand = createServerFn({ method: 'POST' })
  .inputValidator(textCommandInput)
  .handler(async ({ data }) => {
    const catalog = await db.select().from(products).orderBy(desc(products.createdAt))

    if (!process.env.GEMINI_API_KEY) {
      return {
        status: 'mock' as const,
        transcript: data.text,
        reply:
          'GEMINI_API_KEY is not configured. Add your key to .env to enable model commands.',
        addProductIds: [] as string[],
        visibleProductIds: [] as string[],
        expandedProductId: '',
        clearOutfit: false,
        tryOnRequested: false,
        needsClarification: true,
        question:
          'What style are you going for today: business, casual, evening, or travel?',
        model: getChatModel(),
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: getChatModel(),
      contents: [
        {
          text: `${buildVoiceCommandPrompt(catalog, data.currentProductIds, data.visibleProductIds)}\n\nCustomer said: ${data.text}`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    return voiceCommandResponse.parse(JSON.parse(response.text ?? '{}'))
  })

export const createLiveSessionToken = createServerFn({ method: 'POST' }).handler(
  async () => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for Gemini Live API.')
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const catalog = await db.select().from(products).orderBy(desc(products.createdAt))
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const model = getLiveModel()
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
                },
              },
            },
            systemInstruction: {
              parts: [{ text: buildLiveSystemInstruction(catalog) }],
            },
            tools: [buildLiveTools()],
          },
        },
        httpOptions: {
          apiVersion: 'v1alpha',
        },
      },
    })

    return {
      token: token.name,
      model,
      expiresAt: expireTime,
      voice: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
      toolNames: [
        'show_items',
        'add_items',
        'expand_item',
        'clear_outfit',
        'render_try_on',
      ],
    }
  },
)

const voiceCommandResponse = z.object({
  status: z.literal('ok').default('ok'),
  transcript: z.string().default(''),
  reply: z.string(),
  addProductIds: z.array(z.string().uuid()).default([]),
  visibleProductIds: z.array(z.string().uuid()).default([]),
  expandedProductId: z.string().uuid().or(z.literal('')).default(''),
  clearOutfit: z.boolean().default(false),
  tryOnRequested: z.boolean().default(false),
  model: z.string().default(getChatModel()),
  needsClarification: z.boolean().default(false),
  question: z.string().default(''),
})

const speechInput = z.object({
  text: z.string().trim().min(1).max(1200),
})

export const generateAssistantSpeech = createServerFn({ method: 'POST' })
  .inputValidator(speechInput)
  .handler(async ({ data }) => {
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_TTS_MODEL) {
      return {
        status: 'fallback' as const,
        audioDataUrl: '',
        model: '',
        voice: '',
        mimeType: '',
        reason: 'Missing GEMINI_API_KEY or GEMINI_TTS_MODEL.',
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: getTtsModel(),
      contents: [
        {
          text: `Say warmly and concisely as a helpful in-store fashion stylist: "${data.text}"`,
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
            },
          },
        },
      },
    })

    const inlineData = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    )?.inlineData

    if (!inlineData?.data) {
      return {
        status: 'fallback' as const,
        audioDataUrl: '',
        model: getTtsModel(),
        voice: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
        mimeType: '',
        reason: 'Gemini TTS did not return inline audio data.',
      }
    }

    const playableAudio = toPlayableAudioDataUrl(
      inlineData.data,
      inlineData.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
    )

    return {
      status: 'ok' as const,
      audioDataUrl: playableAudio.audioDataUrl,
      model: getTtsModel(),
      voice: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
      mimeType: playableAudio.mimeType,
      reason: '',
    }
  })

function toPlayableAudioDataUrl(base64Audio: string, mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase()

  if (
    normalizedMimeType.includes('wav') ||
    normalizedMimeType.includes('mpeg') ||
    normalizedMimeType.includes('mp3') ||
    normalizedMimeType.includes('ogg') ||
    normalizedMimeType.includes('mp4')
  ) {
    return {
      audioDataUrl: `data:${mimeType};base64,${base64Audio}`,
      mimeType,
    }
  }

  const sampleRate = readPcmSampleRate(mimeType)
  const pcm = Buffer.from(base64Audio, 'base64')
  const wav = encodePcm16MonoAsWav(pcm, sampleRate)

  return {
    audioDataUrl: `data:audio/wav;base64,${wav.toString('base64')}`,
    mimeType: 'audio/wav',
  }
}

function readPcmSampleRate(mimeType: string) {
  const rate = mimeType.match(/rate=(\d+)/i)?.[1]
  return rate ? Number(rate) : 24_000
}

function encodePcm16MonoAsWav(pcm: Buffer, sampleRate: number) {
  const channels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}

function parseAudioDataUrl(audioDataUrl: string) {
  const match = audioDataUrl.match(/^data:(audio\/[^;]+)(?:;[^,]*)?;base64,(.+)$/)

  if (!match) {
    throw new Error('Invalid audio data URL')
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

function parseImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/[^;]+)(?:;[^,]*)?;base64,(.+)$/)

  if (!match) {
    throw new Error('Invalid image data URL')
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

async function fetchImageAsInlineData(imageUrl: string) {
  const response = await fetch(imageUrl)

  if (!response.ok) {
    throw new Error(`Could not fetch garment image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg'

  if (!contentType.startsWith('image/')) {
    throw new Error(`Garment image URL returned ${contentType}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())

  return {
    mimeType: contentType.split(';')[0] ?? 'image/jpeg',
    base64: bytes.toString('base64'),
  }
}

function buildVoiceCommandPrompt(
  catalog: Product[],
  currentProductIds: string[],
  visibleProductIds: string[] = [],
) {
  const productLines = catalog
    .map((product) =>
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

function buildLiveSystemInstruction(catalog: Product[]) {
  const productLines = catalog
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

  return `
You are Atelier AI, a real-time voice stylist inside a physical clothing store.
You have access to the store inventory below and must never claim you have no inventory.
Use only these catalog products. Do not mention online stores.
When the user asks what clothes are available, call show_items with relevant product ids.
When the user asks to choose, select, pick, or add an option, call add_items with selected product ids.
When the user asks to see a product better, larger, closer, zoomed, opened, or with details, call expand_item with one product id.
When the user asks to clear the outfit, call clear_outfit.
When the user asks to render, try on, generate, or take a photo, call render_try_on.
If the user request is vague, ask one short style question, but still use tools when showing or adding concrete products.

Catalog:
${productLines}
`.trim()
}

function buildLiveTools() {
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
        description:
          'Show specific store catalog products on the kiosk screen. Use this for availability, options, recommendations, search results, and alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'add_items',
        description:
          'Add selected catalog products to the outfit board. Use this when the user chooses, selects, picks, accepts, or asks to add an option.',
        parameters: productIdsSchema,
      },
      {
        name: 'expand_item',
        description:
          'Expand one catalog product on the kiosk camera view. Use this when the user asks to see an item better, bigger, closer, zoomed, opened, or with details.',
        parameters: productIdsSchema,
      },
      {
        name: 'clear_outfit',
        description: 'Clear the current outfit board.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'render_try_on',
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

function getChatModel() {
  return process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash'
}

function getLiveModel() {
  return (
    process.env.GEMINI_LIVE_MODEL ??
    'gemini-2.5-flash-native-audio-preview-12-2025'
  )
}

function getImageModel() {
  return process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image'
}

function getTtsModel() {
  return process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts'
}

function buildTryOnPrompt(selectedProducts: Product[], userPrompt: string) {
  const garmentDescriptions = selectedProducts
    .map(
      (product) =>
        `id=${product.id}; category=${product.category}; name=${product.name}; imageUrl=${product.imageUrl}; visual=${product.imageDescription}`,
    )
    .join(' ')

  return [
    'Edit the first image, which is the customer camera photo.',
    'Use ONLY the selected garment reference images that follow the camera photo. Do not use memory, brand assumptions, or generic clothing.',
    `Selected garments to apply exactly: ${garmentDescriptions}`,
    'Transfer the exact visible garment design from each reference image: color, fabric, collar, sleeves, pockets, pattern, buttons, zipper, hem, silhouette, and proportions.',
    'Place the referenced garments realistically on the person in the camera photo: align to body pose, preserve natural folds, scale, occlusion, and perspective.',
    'Preserve the user identity, face, hair, skin tone, pose, lighting, body proportions, and store environment.',
    'Do not return the original image unchanged. The output must visibly dress the customer in the selected garment reference images.',
    'Use only one final item per outfit group unless the groups are complementary accessories.',
    `Styling instruction from voice assistant: ${userPrompt}`,
  ].join(' ')
}

function buildTryOnReferences(selectedProducts: Product[]) {
  return selectedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl,
    imageDescription: product.imageDescription,
  }))
}
