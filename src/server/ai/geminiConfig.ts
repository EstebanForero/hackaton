import {
  ActivityHandling,
  EndSensitivity,
  StartSensitivity,
  TurnCoverage,
} from '@google/genai'

export function buildRealtimeInputConfig() {
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
