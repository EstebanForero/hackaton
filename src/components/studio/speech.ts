import { generateAssistantSpeech } from '#/server/products'

export async function speakAssistantReply(
  message: string,
  audioElement: HTMLAudioElement | null,
  setSpeechStatus: (status: string) => void,
  callbacks: {
    onStart?: (durationMs?: number) => void
    onEnd?: () => void
  } = {},
) {
  try {
    setSpeechStatus('Generating model voice...')
    const speech = await generateAssistantSpeech({ data: { text: message } })

    if (speech.status === 'ok' && speech.audioDataUrl) {
      if (!audioElement) throw new Error('Audio element is not ready')
      audioElement.pause()
      audioElement.src = speech.audioDataUrl
      audioElement.currentTime = 0
      audioElement.onplaying = () => {
        callbacks.onStart?.(
          Number.isFinite(audioElement.duration)
            ? audioElement.duration * 1000 + 600
            : undefined,
        )
      }
      audioElement.onended = callbacks.onEnd ?? null
      audioElement.onerror = callbacks.onEnd ?? null
      audioElement.load()
      await audioElement.play()
      setSpeechStatus(
        `Playing Gemini TTS voice ${speech.voice} as ${speech.mimeType}.`,
      )
      return
    }
    setSpeechStatus(
      `Model voice unavailable: ${speech.reason || 'unknown reason'}. Falling back to browser voice.`,
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    setSpeechStatus(
      `Audio playback failed: ${reason}. Trying browser voice.`,
    )
  }

  if (!('speechSynthesis' in window)) {
    setSpeechStatus('Browser speech synthesis is unavailable.')
    return
  }

  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.onstart = () => {
      callbacks.onStart?.(estimateSpeechDurationMs(message))
      setSpeechStatus('Playing browser voice.')
    }
    utterance.onend = () => {
      callbacks.onEnd?.()
      setSpeechStatus('Browser voice finished.')
    }
    utterance.onerror = () => {
      callbacks.onEnd?.()
      setSpeechStatus('Browser voice failed.')
    }
    window.speechSynthesis.speak(utterance)
  } catch {
    setSpeechStatus('No speech playback method succeeded.')
  }
}

function estimateSpeechDurationMs(message: string) {
  const words = message.trim().split(/\s+/).filter(Boolean).length
  return Math.max(3500, Math.ceil((words / 155) * 60_000) + 800)
}
