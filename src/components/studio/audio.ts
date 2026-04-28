import type { PCMPlayer } from '@speechmatics/web-pcm-player'
import type * as React from 'react'

export function getSupportedAudioMimeType() {
  const preferredTypes = [
    'audio/ogg;codecs=vorbis',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/webm',
  ]

  return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
}

export function buildAudioConstraints(deviceId: string): MediaTrackConstraints {
  return {
    channelCount: 1,
    sampleRate: { ideal: 48_000 },
    sampleSize: { ideal: 16 },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId && deviceId !== 'default'
      ? { deviceId: { exact: deviceId } }
      : {}),
  }
}

export function formatAudioInputLabel(input: MediaDeviceInfo, index: number) {
  if (input.deviceId === 'default') return 'System default microphone'
  if (input.label) return input.label
  return `Microphone ${index + 1}`
}

export function resampleFloat32ToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Int16Array(outputLength)

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(leftIndex + 1, input.length - 1)
    const fraction = sourceIndex - leftIndex
    const left = input[leftIndex] ?? 0
    const right = input[rightIndex] ?? left
    const interpolated = left + (right - left) * fraction
    const cleaned = Math.abs(interpolated) < 0.0015 ? 0 : interpolated
    const sample = softLimit(cleaned * 1.03)
    output[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff)
  }

  return output
}

export function readRms(input: Float32Array) {
  let sum = 0

  for (const sample of input) {
    sum += sample * sample
  }

  return Math.sqrt(sum / input.length)
}

function softLimit(sample: number) {
  return Math.tanh(Math.max(-1.4, Math.min(1.4, sample)))
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

export function fingerprintLiveAudioChunk(base64Pcm: string) {
  const head = base64Pcm.slice(0, 96)
  const tail = base64Pcm.slice(-96)
  return `${base64Pcm.length}:${head}:${tail}`
}

export function playLivePcm(
  base64Pcm: string,
  mimeType: string,
  playerRef: React.RefObject<PCMPlayer | null>,
  contextRef: React.RefObject<AudioContext | null>,
  queueEndTimeRef: React.MutableRefObject<number>,
  sourcesRef?: React.RefObject<Set<AudioBufferSourceNode>>,
) {
  const context = contextRef.current
  if (!context) return 0

  const sourceSampleRate = readPcmSampleRate(mimeType)
  const targetSampleRate = context.sampleRate
  const pcm = base64ToInt16Array(base64Pcm)
  const audio = sourceSampleRate === targetSampleRate
    ? pcm16ToFloat32(pcm)
    : resamplePcm16ToFloat32(pcm, sourceSampleRate, targetSampleRate)
  if (!audio.length) return 0

  const buffer = context.createBuffer(1, audio.length, targetSampleRate)
  buffer.copyToChannel(audio, 0)
  const source = context.createBufferSource()
  source.buffer = buffer

  const volume = playerRef.current?.volumePercentage ?? 72
  const gain = context.createGain()
  gain.gain.value = volume / 100
  source.connect(gain)
  gain.connect(context.destination)

  const startAt = Math.max(queueEndTimeRef.current, context.currentTime + 0.045)
  sourcesRef?.current.add(source)
  source.onended = () => {
    sourcesRef?.current.delete(source)
    gain.disconnect()
  }
  source.start(startAt)
  queueEndTimeRef.current =
    startAt + buffer.duration
  return Math.max(0, queueEndTimeRef.current - context.currentTime)
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function base64ToInt16Array(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Int16Array(bytes.buffer)
}

function readPcmSampleRate(mimeType: string) {
  const rate = mimeType.match(/rate=(\d+)/i)?.[1]
  return rate ? Number(rate) : 24_000
}

function pcm16ToFloat32(input: Int16Array) {
  const output = new Float32Array(input.length)

  for (let i = 0; i < input.length; i += 1) {
    output[i] = (input[i] ?? 0) / 32768
  }

  return output
}

function resamplePcm16ToFloat32(
  input: Int16Array,
  sourceSampleRate: number,
  targetSampleRate: number,
) {
  if (!input.length || sourceSampleRate <= 0 || targetSampleRate <= 0) {
    return new Float32Array()
  }

  const outputLength = Math.max(
    1,
    Math.round(input.length * (targetSampleRate / sourceSampleRate)),
  )
  const output = new Float32Array(outputLength)
  const ratio = sourceSampleRate / targetSampleRate

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(leftIndex + 1, input.length - 1)
    const fraction = sourceIndex - leftIndex
    const left = input[leftIndex] ?? 0
    const right = input[rightIndex] ?? left
    output[i] = (left + (right - left) * fraction) / 32768
  }

  return output
}
