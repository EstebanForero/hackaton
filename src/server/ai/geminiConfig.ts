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
  return process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash'
}

export function getLiveModel() {
  return (
    process.env.GEMINI_LIVE_MODEL ??
    'gemini-2.5-flash-native-audio-preview-12-2025'
  )
}

export function getImageModel() {
  return process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image'
}

export function getTtsModel() {
  return process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts'
}
