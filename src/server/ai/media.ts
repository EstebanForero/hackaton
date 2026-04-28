export function toPlayableAudioDataUrl(base64Audio: string, mimeType: string) {
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

export function parseAudioDataUrl(audioDataUrl: string) {
  const match = audioDataUrl.match(/^data:(audio\/[^;]+)(?:;[^,]*)?;base64,(.+)$/)

  if (!match) {
    throw new Error('Invalid audio data URL')
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

export function parseImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/[^;]+)(?:;[^,]*)?;base64,(.+)$/)

  if (!match) {
    throw new Error('Invalid image data URL')
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

export async function fetchImageAsInlineData(imageUrl: string) {
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
