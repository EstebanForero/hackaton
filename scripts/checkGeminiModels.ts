import { GoogleGenAI, Modality } from '@google/genai'
import { readFileSync } from 'node:fs'
import {
  buildRealtimeInputConfig,
  defaultLiveMicSettings,
  getChatModel,
  getImageModel,
  getLiveModel,
  getTtsModel,
  supportsNonBlockingLiveTools,
} from '../src/server/ai/geminiConfig'

loadDotEnv()

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('GEMINI_API_KEY is missing.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })

async function main() {
  const models = {
    chat: getChatModel(),
    live: getLiveModel(),
    image: getImageModel(),
    tts: getTtsModel(),
  }

  console.info('Testing Gemini models:', models)

  await testModelInfo('chat', models.chat)
  await testModelInfo('live', models.live)
  await testModelInfo('image', models.image)
  await testModelInfo('tts', models.tts)
  await testChat(models.chat)
  await testTts(models.tts)
  await testImage(models.image)
  await testLiveToken(models.live)

  console.info('All configured Gemini model checks passed.')
}

async function testModelInfo(label: string, model: string) {
  const info = await ai.models.get({ model })
  console.info(`[${label}] model found:`, info.name ?? model)
}

async function testChat(model: string) {
  const response = await ai.models.generateContent({
    model,
    contents: 'Reply with exactly: ok',
    config: {
      responseMimeType: 'application/json',
    },
  })

  console.info('[chat] response length:', response.text?.length ?? 0)
}

async function testTts(model: string) {
  const response = await ai.models.generateContent({
    model,
    contents: 'Say warmly: model check complete.',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: process.env.GEMINI_TTS_VOICE ?? 'Sulafat',
          },
        },
      },
    },
  })
  const audio = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData

  if (!audio?.data) throw new Error('[tts] no audio returned')
  console.info('[tts] audio:', audio.mimeType ?? 'unknown', audio.data.length)
}

async function testImage(model: string) {
  const response = await ai.models.generateContent({
    model,
    contents: 'Generate a simple 256px product-style image of a plain white t-shirt on a neutral background.',
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  })
  const image = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.mimeType?.startsWith('image/'),
  )?.inlineData

  if (!image?.data) throw new Error('[image] no image returned')
  console.info('[image] image:', image.mimeType ?? 'unknown', image.data.length)
}

async function testLiveToken(model: string) {
  const expireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          realtimeInputConfig: buildRealtimeInputConfig(defaultLiveMicSettings),
          systemInstruction: {
            parts: [{ text: 'You are a concise voice assistant.' }],
          },
          tools: [
            {
              functionDeclarations: [
                supportsNonBlockingLiveTools(model)
                  ? {
                      name: 'ping',
                      behavior: 'NON_BLOCKING',
                      parameters: { type: 'OBJECT', properties: {} },
                    }
                  : {
                      name: 'ping',
                      parameters: { type: 'OBJECT', properties: {} },
                    },
              ],
            },
          ],
        },
      },
      httpOptions: {
        apiVersion: 'v1alpha',
      },
    },
  })

  if (!token.name) throw new Error('[live] no auth token returned')
  console.info('[live] token created:', token.name.slice(0, 18) + '...')
}

function loadDotEnv() {
  const env = readFileSync('.env', 'utf8')

  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    process.env[key] = value
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
