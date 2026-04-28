import { GoogleGenAI, Modality } from '@google/genai'
import { createServerFn } from '@tanstack/react-start'
import { createHash } from 'node:crypto'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/client'
import { products, type Product } from '#/db/schema'
import {
  buildRealtimeInputConfig,
  defaultLiveMicSettings,
  getChatModel,
  getImageModel,
  getLiveModel,
  getTtsModel,
} from './ai/geminiConfig'
import {
  fetchImageAsInlineData,
  parseAudioDataUrl,
  parseImageDataUrl,
  toPlayableAudioDataUrl,
} from './ai/media'
import {
  buildLiveSystemInstruction,
  buildLiveTools,
  buildTryOnPrompt,
  buildTryOnReferences,
  buildVoiceCommandPrompt,
} from './ai/prompts'

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

    const productsById = new Map(
      selectedProducts.map((product) => [product.id, product]),
    )
    const orderedProducts = data.productIds
      .map((productId) => productsById.get(productId))
      .filter((product): product is Product => Boolean(product))
    if (orderedProducts.length !== data.productIds.length) {
      throw new Error('One or more selected outfit products were not found')
    }
    const generationPrompt = buildTryOnPrompt(orderedProducts, data.prompt)

    if (!process.env.GEMINI_API_KEY) {
      return {
        status: 'mock' as const,
        products: orderedProducts,
        references: buildTryOnReferences(orderedProducts),
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
        orderedProducts.map((product) => fetchImageAsInlineData(product.imageUrl)),
      )
      const userPhoto = parseImageDataUrl(data.photoDataUrl)
      logTryOnGeminiImages({
        requestedProductIds: data.productIds,
        products: orderedProducts,
        userPhoto,
        referenceImages,
      })
      const response = await ai.models.generateContent({
        model: getImageModel(),
        contents: [
          {
            role: 'user',
            parts: [
              { text: generationPrompt },
              {
                text:
                  'CUSTOMER_CAMERA_IMAGE_START: this is the original picture of the real customer. Edit this image. Keep this exact person, face, hair, skin tone, body, pose, lighting, and camera scene; only replace/add the selected garments.',
              },
              {
                inlineData: {
                  mimeType: userPhoto.mimeType,
                  data: userPhoto.base64,
                },
              },
              {
                text:
                  `CUSTOMER_CAMERA_IMAGE_END. The following ${orderedProducts.length} images are mandatory selected garment references only. Apply every listed garment to the customer if that body area is visible. Do not use the people, bodies, poses, faces, skin, hair, or backgrounds from reference images. Do not invent product design, pattern, color, logos, pockets, or silhouette beyond these references.`,
              },
              ...referenceImages.flatMap((image, index) => {
                const product = orderedProducts[index]

                return [
                  {
                    text: [
                      `REQUIRED_GARMENT_REFERENCE_${index + 1}_START`,
                      `Selected product id: ${product?.id}`,
                      `Selected product name: ${product?.name}`,
                      `Selected product category: ${product?.category}`,
                      `Selected product image URL: ${product?.imageUrl}`,
                      `Visual description: ${product?.imageDescription}`,
                      'This garment is required in the final output. Use this exact garment image as the source of truth for color, fabric, cut, pockets, collar, pattern, and silhouette.',
                      'Do not replace this required garment with another catalog item, the original camera clothing, or a generic approximation.',
                    ].join('\n'),
                  },
                  {
                    inlineData: {
                      mimeType: image.mimeType,
                      data: image.base64,
                    },
                  },
                  { text: `REQUIRED_GARMENT_REFERENCE_${index + 1}_END` },
                ]
              }),
              {
                text:
                  'FINAL_RENDER_CHECK: before returning the image, verify every REQUIRED_GARMENT_REFERENCE is present on the customer. If a required garment conflicts with another required garment, keep the most specific visible garment for that body area and do not add unrelated clothing.',
              },
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
          products: orderedProducts,
          references: buildTryOnReferences(orderedProducts),
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
        products: orderedProducts,
        references: buildTryOnReferences(orderedProducts),
        imageUrl: `data:${generatedImage.mimeType ?? 'image/png'};base64,${generatedImage.data}`,
        message: `Generated virtual try-on with ${getImageModel()} using your camera photo and ${orderedProducts.length} garment reference image${orderedProducts.length === 1 ? '' : 's'}.`,
        chatModel: getChatModel(),
        imageModel: getImageModel(),
        generationPrompt,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      return {
        status: 'failed' as const,
        products: orderedProducts,
        references: buildTryOnReferences(orderedProducts),
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

const liveMicSettingsInput = z
  .object({
    startSensitivity: z.enum(['high', 'low']).default(
      defaultLiveMicSettings.startSensitivity,
    ),
    endSensitivity: z.enum(['high', 'low']).default(
      defaultLiveMicSettings.endSensitivity,
    ),
    prefixPaddingMs: z
      .number()
      .int()
      .min(100)
      .max(1000)
      .default(defaultLiveMicSettings.prefixPaddingMs),
    silenceDurationMs: z
      .number()
      .int()
      .min(250)
      .max(2000)
      .default(defaultLiveMicSettings.silenceDurationMs),
  })
  .default(defaultLiveMicSettings)

export const createLiveSessionToken = createServerFn({ method: 'POST' })
  .inputValidator(liveMicSettingsInput)
  .handler(async ({ data }) => {
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
            realtimeInputConfig: buildRealtimeInputConfig(data),
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
  })

function logTryOnGeminiImages({
  requestedProductIds,
  products: orderedProducts,
  userPhoto,
  referenceImages,
}: {
  requestedProductIds: string[]
  products: Product[]
  userPhoto: { mimeType: string; base64: string }
  referenceImages: Array<{ mimeType: string; base64: string }>
}) {
  const imageLog = {
    requestedProductIds,
    orderedProductIds: orderedProducts.map((product) => product.id),
    customerCameraImage: describeInlineImage(userPhoto),
    garmentReferenceImages: orderedProducts.map((product, index) => ({
      index: index + 1,
      productId: product.id,
      productName: product.name,
      category: product.category,
      imageUrl: product.imageUrl,
      imageDescription: product.imageDescription,
      inlineImage: describeInlineImage(referenceImages[index]),
    })),
  }

  console.info('[try-on] Gemini image request payload', imageLog)
}

function describeInlineImage(image?: { mimeType: string; base64: string }) {
  if (!image) {
    return {
      mimeType: '',
      bytes: 0,
      sha256: '',
      base64Prefix: '',
    }
  }

  const bytes = Buffer.from(image.base64, 'base64')

  return {
    mimeType: image.mimeType,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    base64Prefix: image.base64.slice(0, 48),
  }
}

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
