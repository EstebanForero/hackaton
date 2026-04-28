import {
  ActivityHandling,
  EndSensitivity,
  StartSensitivity,
  TurnCoverage,
} from '@google/genai'

export type LiveMicSettings = {
  startSensitivity: 'high' | 'low'
  endSensitivity: 'high' | 'low'
  prefixPaddingMs: number
  silenceDurationMs: number
}

export const defaultLiveMicSettings: LiveMicSettings = {
  startSensitivity: 'high',
  endSensitivity: 'high',
  prefixPaddingMs: 400,
  silenceDurationMs: 700,
}

export function buildRealtimeInputConfig(
  micSettings: LiveMicSettings = defaultLiveMicSettings,
) {
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

export function getChatModel() {
  return normalizeGeminiModel(
    process.env.GEMINI_CHAT_MODEL,
    'gemini-3-flash-preview',
  )
}

export function getLiveModel() {
  return normalizeGeminiModel(
    process.env.GEMINI_LIVE_MODEL,
    'gemini-3.1-flash-live-preview',
  )
}

export function getImageModel() {
  return normalizeGeminiModel(
    process.env.GEMINI_IMAGE_MODEL,
    'gemini-3.1-flash-image-preview',
  )
}

export function getTtsModel() {
  return normalizeGeminiModel(
    process.env.GEMINI_TTS_MODEL,
    'gemini-3.1-flash-tts-preview',
  )
}

export function supportsNonBlockingLiveTools(model: string) {
  return !model.startsWith('gemini-3.1-')
}

function normalizeGeminiModel(model: string | undefined, fallback: string) {
  if (!model) return fallback

  const aliases: Record<string, string> = {
    'gemini-3-flash': 'gemini-3-flash-preview',
    'gemini-3-flash-live-preview': 'gemini-3.1-flash-live-preview',
  }

  return aliases[model] ?? model
}
