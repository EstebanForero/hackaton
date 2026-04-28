import { useMutation } from '@tanstack/react-query'
import * as React from 'react'
import type { Product } from '#/db/schema'
import {
  createVirtualTryOn,
  generateAssistantSpeech,
  createLiveSessionToken,
  processTextCommand,
  processVoiceCommand,
} from '#/server/products'

type StudioProps = {
  products: Product[]
}

type OutfitSlot =
  | 'outerwear'
  | 'top'
  | 'bottom'
  | 'dress'
  | 'footwear'
  | 'accessory'

type OutfitGroup = {
  slot: OutfitSlot
  selected: Product
  alternatives: Product[]
  reason: string
}

type VoiceDebugInfo = {
  transcript: string
  reply: string
  addProductIds: string[]
  visibleProductIds: string[]
  expandedProductId: string
  clearOutfit: boolean
  tryOnRequested: boolean
  needsClarification: boolean
  question: string
  model: string
}

type LiveEvent = {
  id: number
  text: string
}

const slotLabels: Record<OutfitSlot, string> = {
  outerwear: 'Outerwear',
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  footwear: 'Footwear',
  accessory: 'Accessory',
}

function getSlot(product: Product): OutfitSlot {
  if (product.category === 'tops') return 'top'
  if (product.category === 'bottoms') return 'bottom'
  if (product.category === 'dresses') return 'dress'
  if (product.category === 'accessories') return 'accessory'
  return product.category
}

function buildRenderableOutfit(
  selectedProducts: Product[],
  immediateProducts: Product[],
) {
  const productsBySlot = new Map<OutfitSlot, Product>()

  for (const product of selectedProducts) {
    productsBySlot.set(getSlot(product), product)
  }

  for (const product of immediateProducts) {
    productsBySlot.set(getSlot(product), product)
  }

  return Array.from(productsBySlot.values())
}

export function VoiceTryOnStudio({ products }: StudioProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const micStreamRef = React.useRef<MediaStream | null>(null)
  const recordingTimeoutRef = React.useRef<number | null>(null)
  const liveSessionRef = React.useRef<{
    close: () => void
    sendRealtimeInput: (params: never) => void
    sendToolResponse: (params: never) => void
  } | null>(null)
  const liveInputContextRef = React.useRef<AudioContext | null>(null)
  const liveOutputContextRef = React.useRef<AudioContext | null>(null)
  const liveProcessorRef = React.useRef<ScriptProcessorNode | null>(null)
  const liveSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
  const liveSinkRef = React.useRef<GainNode | null>(null)
  const liveNextStartTimeRef = React.useRef(0)
  const liveChunksSentRef = React.useRef(0)
  const liveLastMeterUpdateRef = React.useRef(0)
  const liveEventIdRef = React.useRef(0)
  const liveLastFinishedTranscriptRef = React.useRef('')
  const recentLiveToolCallsRef = React.useRef(new Map<string, number>())
  const audioChunksRef = React.useRef<BlobPart[]>([])
  const micTestRecorderRef = React.useRef<MediaRecorder | null>(null)
  const micTestChunksRef = React.useRef<BlobPart[]>([])
  const selectedOutfitRef = React.useRef<Product[]>([])
  const visibleItemsRef = React.useRef<Product[]>([])
  const cameraReadyRef = React.useRef(false)
  const [cameraReady, setCameraReady] = React.useState(false)
  const [recordingState, setRecordingState] = React.useState<
    'idle' | 'recording' | 'processing'
  >('idle')
  const [alwaysListening, setAlwaysListening] = React.useState(false)
  const [liveStatus, setLiveStatus] = React.useState('Live API disconnected.')
  const [liveEvents, setLiveEvents] = React.useState<LiveEvent[]>([])
  const [liveMicLevel, setLiveMicLevel] = React.useState(0)
  const [liveChunksSent, setLiveChunksSent] = React.useState(0)
  const [audioInputs, setAudioInputs] = React.useState<MediaDeviceInfo[]>([])
  const [selectedAudioInputId, setSelectedAudioInputId] = React.useState('')
  const [micTestStatus, setMicTestStatus] = React.useState(
    'Mic test has not run.',
  )
  const [micTrackSettings, setMicTrackSettings] = React.useState('')
  const [assistantReply, setAssistantReply] = React.useState(
    'Hold the voice button, ask for clothes, then release. Try “build a business outfit”, “add a blazer”, or “try on this outfit”.',
  )
  const [outfitGroups, setOutfitGroups] = React.useState<OutfitGroup[]>([])
  const [visibleItems, setVisibleItems] = React.useState<Product[]>([])
  const [expandedProduct, setExpandedProduct] = React.useState<Product | null>(
    null,
  )
  const [tryOnResult, setTryOnResult] = React.useState<{
    imageUrl: string
    message: string
    generationPrompt: string
    imageModel: string
    status: 'generated' | 'failed' | 'mock'
    references: Array<{
      id: string
      name: string
      category: Product['category']
      imageUrl: string
      imageDescription: string
    }>
  } | null>(null)
  const [debugOpen, setDebugOpen] = React.useState(false)
  const [optionsOpen, setOptionsOpen] = React.useState(false)
  const [bigScreenMode, setBigScreenMode] = React.useState(false)
  const [voiceDebugInfo, setVoiceDebugInfo] =
    React.useState<VoiceDebugInfo | null>(null)
  const [speechStatus, setSpeechStatus] = React.useState(
    'Speech has not played yet.',
  )
  const [renderDebugStatus, setRenderDebugStatus] = React.useState(
    'No render requested yet.',
  )

  function applyPlannerResult(result: VoiceDebugInfo) {
    setVoiceDebugInfo(result)

    if (result.clearOutfit) {
      setVisibleItems([])
      setOutfitGroups([])
      setExpandedProduct(null)
      setTryOnResult(null)
    }

    const visibleProducts = products.filter((product) =>
      result.visibleProductIds.includes(product.id),
    )
    const addProducts = products.filter((product) =>
      result.addProductIds.includes(product.id),
    )
    const productToExpand = products.find(
      (product) => product.id === result.expandedProductId,
    )

    setVisibleItems(visibleProducts)
    if (visibleProducts.length) {
      setExpandedProduct(null)
      setTryOnResult(null)
    }

    if (addProducts.length) {
      addMatchesToOutfit(addProducts, result.transcript || result.reply)
    }

    if (productToExpand) {
      setExpandedProduct(productToExpand)
    }

    const spokenReply =
      result.needsClarification && result.question ? result.question : result.reply
    setAssistantReply(spokenReply)

    if (result.tryOnRequested) {
      requestTryOn(result.transcript || result.reply, addProducts)
    }
  }

  const appendLiveEvent = React.useCallback((event: string) => {
    const timestamp = new Date().toLocaleTimeString()
    liveEventIdRef.current += 1
    setLiveEvents((events) =>
      [{ id: liveEventIdRef.current, text: `${timestamp} ${event}` }, ...events].slice(0, 12),
    )
  }, [])

  React.useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          cameraReadyRef.current = true
          setCameraReady(true)
        }
      } catch {
        setAssistantReply(
          'Camera access is blocked. Enable camera permissions to use virtual try-on.',
        )
      }
    }

    void startCamera()

    return () => {
      cameraReadyRef.current = false
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const refreshAudioInputs = React.useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput')
      setAudioInputs(inputs)
      setSelectedAudioInputId((currentId) => {
        if (currentId === 'default') return currentId

        if (currentId && inputs.some((input) => input.deviceId === currentId)) {
          return currentId
        }

        return 'default'
      })
      appendLiveEvent(
        `Found ${inputs.length} browser microphone input${inputs.length === 1 ? '' : 's'} plus system default.`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      appendLiveEvent(`Could not enumerate microphones: ${reason}`)
    }
  }, [appendLiveEvent])

  React.useEffect(() => {
    void refreshAudioInputs()
    navigator.mediaDevices.addEventListener?.('devicechange', refreshAudioInputs)

    return () => {
      navigator.mediaDevices.removeEventListener?.(
        'devicechange',
        refreshAudioInputs,
      )
    }
  }, [refreshAudioInputs])

  const tryOnMutation = useMutation({
    mutationFn: (input: {
      productIds: string[]
      prompt: string
      photoDataUrl: string
    }) => createVirtualTryOn({ data: input }),
    onSuccess: (result) => {
      setTryOnResult(result)
      setRenderDebugStatus(result.message)
      setAssistantReply(result.message)
      appendLiveEvent(
        `Try-on returned ${result.status}; references: ${result.references
          .map((reference) => reference.name)
          .join(', ') || 'none'}.`,
      )
    },
    onError: () => {
      const message = 'Try-on failed. Check server logs and AI configuration.'
      setRenderDebugStatus(message)
      setAssistantReply(message)
    },
  })

  const voiceMutation = useMutation({
    mutationFn: (input: { audioDataUrl: string; currentProductIds: string[] }) =>
      processVoiceCommand({ data: input }),
    onSuccess: (result) => {
      const plannerResult = {
        transcript: result.transcript,
        reply: result.reply,
        addProductIds: result.addProductIds,
        visibleProductIds: result.visibleProductIds,
        expandedProductId: result.expandedProductId,
        clearOutfit: result.clearOutfit,
        tryOnRequested: result.tryOnRequested,
        needsClarification: result.needsClarification,
        question: result.question,
        model: result.model,
      }
      applyPlannerResult(plannerResult)
      const spokenReply =
        result.needsClarification && result.question
          ? result.question
          : result.reply
      speak(spokenReply)
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Voice command failed. Check microphone permissions and Gemini configuration.'
      setAssistantReply(message)
      speak(message)
    },
    onSettled: () => setRecordingState('idle'),
  })

  const liveTextMutation = useMutation({
    mutationFn: (input: {
      text: string
      currentProductIds: string[]
      visibleProductIds: string[]
    }) =>
      processTextCommand({ data: input }),
    onSuccess: (result) => {
      appendLiveEvent(`DB planner returned ${result.visibleProductIds.length} visible and ${result.addProductIds.length} add item(s).`)
      applyPlannerResult({
        transcript: result.transcript,
        reply: result.reply,
        addProductIds: result.addProductIds,
        visibleProductIds: result.visibleProductIds,
        expandedProductId: result.expandedProductId,
        clearOutfit: result.clearOutfit,
        tryOnRequested: result.tryOnRequested,
        needsClarification: result.needsClarification,
        question: result.question,
        model: result.model,
      })
    },
    onError: (error) => {
      const reason = error instanceof Error ? error.message : 'unknown error'
      appendLiveEvent(`DB planner failed: ${reason}`)
    },
  })

  const speak = React.useCallback((message: string) => {
    void speakAssistantReply(message, audioRef.current, setSpeechStatus)
  }, [])

  const replayAssistant = React.useCallback(() => {
    void speakAssistantReply(assistantReply, audioRef.current, setSpeechStatus)
  }, [assistantReply])

  const capturePhoto = React.useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return null
    if (!cameraReadyRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null
    }

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const context = canvas.getContext('2d')
    context?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.88)
  }, [])

  const selectedOutfit = React.useMemo(
    () => outfitGroups.map((group) => group.selected),
    [outfitGroups],
  )

  React.useEffect(() => {
    selectedOutfitRef.current = selectedOutfit
  }, [selectedOutfit])

  React.useEffect(() => {
    cameraReadyRef.current = cameraReady
  }, [cameraReady])

  const selectedProductIds = React.useMemo(
    () => new Set(selectedOutfit.map((product) => product.id)),
    [selectedOutfit],
  )
  const floatingChoices = React.useMemo(
    () =>
      visibleItems
        .filter((product) => !selectedProductIds.has(product.id))
        .slice(0, 4),
    [selectedProductIds, visibleItems],
  )

  React.useEffect(() => {
    visibleItemsRef.current = visibleItems
  }, [visibleItems])

  const addMatchesToOutfit = React.useCallback((matches: Product[], reason: string) => {
    const matchedIds = new Set(matches.map((product) => product.id))
    setExpandedProduct(null)
    setTryOnResult(null)
    selectedOutfitRef.current = buildRenderableOutfit(
      selectedOutfitRef.current,
      matches,
    )
    setVisibleItems((currentItems) =>
      currentItems.filter((product) => !matchedIds.has(product.id)),
    )
    setOutfitGroups((currentGroups) => {
      const groupsBySlot = new Map<OutfitSlot, OutfitGroup>()

      for (const group of currentGroups) {
        groupsBySlot.set(group.slot, group)
      }

      for (const product of matches) {
        const slot = getSlot(product)
        const existing = groupsBySlot.get(slot)

        if (!existing) {
          groupsBySlot.set(slot, {
            slot,
            selected: product,
            alternatives: [],
            reason,
          })
          continue
        }

        if (existing.selected.id === product.id) continue

        const alreadyAlternative = existing.alternatives.some(
          (alternative) => alternative.id === product.id,
        )

        if (!alreadyAlternative) {
          groupsBySlot.set(slot, {
            ...existing,
            alternatives: [...existing.alternatives, product],
            reason,
          })
        }
      }

      return Array.from(groupsBySlot.values())
    })
  }, [])

  const selectAlternative = React.useCallback((slot: OutfitSlot, product: Product) => {
    setExpandedProduct(null)
    setTryOnResult(null)
    selectedOutfitRef.current = buildRenderableOutfit(
      selectedOutfitRef.current.filter((selected) => getSlot(selected) !== slot),
      [product],
    )
    setOutfitGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.slot !== slot) return group

        return {
          ...group,
          selected: product,
          alternatives: [
            group.selected,
            ...group.alternatives.filter(
              (alternative) => alternative.id !== product.id,
            ),
          ],
        }
      }),
    )
  }, [])

  const removeOutfitGroup = React.useCallback((slot: OutfitSlot) => {
    setTryOnResult(null)
    selectedOutfitRef.current = selectedOutfitRef.current.filter(
      (product) => getSlot(product) !== slot,
    )
    setOutfitGroups((currentGroups) =>
      currentGroups.filter((group) => group.slot !== slot),
    )
  }, [])

  const requestTryOn = React.useCallback(
    (prompt: string, immediateProducts: Product[] = []) => {
      const photoDataUrl = capturePhoto()
      const finalOutfit = buildRenderableOutfit(
        selectedOutfit.length ? selectedOutfit : selectedOutfitRef.current,
        immediateProducts,
      )

      if (!photoDataUrl || !finalOutfit.length) {
        const selectedCount = selectedOutfit.length || selectedOutfitRef.current.length
        const immediateCount = immediateProducts.length
        const cameraState = cameraReadyRef.current ? 'ready' : 'not ready'
        const message = !photoDataUrl
          ? `I cannot render yet because the camera frame is missing. Camera is ${cameraState}, selected outfit items: ${selectedCount}, immediate items: ${immediateCount}.`
          : `I cannot render yet because no outfit item is available in the render request. Selected outfit items: ${selectedCount}, immediate items: ${immediateCount}.`
        setRenderDebugStatus(message)
        appendLiveEvent(`Render blocked: ${message}`)
        setAssistantReply(message)
        if (!liveSessionRef.current) speak(message)
        return
      }

      const outfitNames = finalOutfit.map((product) => product.name).join(', ')
      const message = `Taking a photo and preparing a virtual try-on with ${outfitNames}.`
      setExpandedProduct(null)
      setRenderDebugStatus(
        `Render request sent with ${finalOutfit.length} item(s): ${outfitNames}.`,
      )
      appendLiveEvent(`Render request sent with ${finalOutfit.length} item(s).`)
      appendLiveEvent(
        `Reference URLs: ${finalOutfit.map((product) => product.imageUrl).join(' | ')}`,
      )
      setTryOnResult(null)
      setAssistantReply(message)
      if (!liveSessionRef.current) speak(message)
      tryOnMutation.mutate({
        productIds: finalOutfit.map((product) => product.id),
        prompt,
        photoDataUrl,
      })
    },
    [appendLiveEvent, capturePhoto, selectedOutfit, speak, tryOnMutation],
  )

  const sendLiveToolResponse = React.useCallback(
    (
      functionCall: { id?: string; name?: string },
      productIds: string[],
      output: Record<string, unknown>,
    ) => {
      liveSessionRef.current?.sendToolResponse({
        functionResponses: [
          {
            id: functionCall.id,
            name: functionCall.name,
            response: {
              output: {
                ...output,
                productIds,
              },
            },
          },
        ],
      } as never)
    },
    [],
  )

  const handleLiveToolCall = React.useCallback(
    (functionCall: { id?: string; name?: string; args?: Record<string, unknown> }) => {
      const productIds = Array.isArray(functionCall.args?.productIds)
        ? functionCall.args.productIds.filter((id): id is string => typeof id === 'string')
        : []
      const matchedProducts = products.filter((product) => productIds.includes(product.id))
      const callKey = `${functionCall.name}-${productIds.join(',')}`
      const now = Date.now()
      const lastCallAt = recentLiveToolCallsRef.current.get(callKey) ?? 0
      const isImmediateDuplicate = now - lastCallAt < 1200

      if (isImmediateDuplicate) {
        appendLiveEvent(`Skipped immediate duplicate tool effect: ${functionCall.name}.`)
        sendLiveToolResponse(functionCall, productIds, {
          ok: true,
          duplicate: true,
          skippedEffect: true,
        })
        return
      }

      recentLiveToolCallsRef.current.set(callKey, now)
      for (const [key, timestamp] of recentLiveToolCallsRef.current) {
        if (now - timestamp > 10_000) recentLiveToolCallsRef.current.delete(key)
      }

      if (functionCall.name === 'show_items') {
        setExpandedProduct(null)
        setTryOnResult(null)
        setVisibleItems(matchedProducts)
      }

      if (functionCall.name === 'add_items') {
        addMatchesToOutfit(matchedProducts, 'Selected by Gemini Live.')
      }

      if (functionCall.name === 'expand_item') {
        setExpandedProduct(matchedProducts[0] ?? null)
      }

      if (functionCall.name === 'clear_outfit') {
        setVisibleItems([])
        setOutfitGroups([])
        setExpandedProduct(null)
        setTryOnResult(null)
      }

      if (functionCall.name === 'render_try_on') {
        requestTryOn('Render the current live-selected outfit.', matchedProducts)
      }

      sendLiveToolResponse(functionCall, productIds, { ok: true })
    },
    [addMatchesToOutfit, appendLiveEvent, products, requestTryOn, sendLiveToolResponse],
  )

  const startLiveSession = React.useCallback(async () => {
    if (liveSessionRef.current) return

    try {
      setLiveStatus('Requesting ephemeral Live token...')
      const [{ GoogleGenAI, Modality }, tokenResult] = await Promise.all([
        import('@google/genai'),
        createLiveSessionToken(),
      ])
      appendLiveEvent(
        `Received ephemeral token for ${tokenResult.model} with tools: ${tokenResult.toolNames.join(', ')}.`,
      )
      const ai = new GoogleGenAI({
        apiKey: tokenResult.token,
        httpOptions: { apiVersion: 'v1alpha' },
      })
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(selectedAudioInputId),
      })
      await refreshAudioInputs()
      micStreamRef.current = stream
      const outputContext = new AudioContext({ sampleRate: 24_000 })
      await outputContext.resume()
      liveOutputContextRef.current = outputContext
      liveNextStartTimeRef.current = outputContext.currentTime
      recentLiveToolCallsRef.current.clear()

      const session = await ai.live.connect({
        model: tokenResult.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: tokenResult.voice },
            },
          },
        },
        callbacks: {
          onopen: () => {
            setLiveStatus(`Live API connected: ${tokenResult.model}`)
            appendLiveEvent('WebSocket opened.')
          },
          onmessage: (message) => {
            if (message.setupComplete) appendLiveEvent('Setup complete.')
            if (message.voiceActivity) appendLiveEvent('Voice activity event.')
            if (message.serverContent?.interrupted) {
              appendLiveEvent('Model response interrupted.')
              liveNextStartTimeRef.current = liveOutputContextRef.current?.currentTime ?? 0
            }

            const inputText = message.serverContent?.inputTranscription?.text
            if (inputText) {
              appendLiveEvent(`Heard: ${inputText}`)
              if (
                message.serverContent?.inputTranscription?.finished &&
                inputText !== liveLastFinishedTranscriptRef.current
              ) {
                liveLastFinishedTranscriptRef.current = inputText
                appendLiveEvent('Sending heard transcript to DB planner.')
                liveTextMutation.mutate({
                  text: inputText,
                  currentProductIds: selectedOutfitRef.current.map((product) => product.id),
                  visibleProductIds: visibleItemsRef.current.map((product) => product.id),
                })
              }
            }

            const outputText = message.serverContent?.outputTranscription?.text
            if (outputText) {
              appendLiveEvent(`Live model said, ignored for inventory: ${outputText}`)
            }

            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                appendLiveEvent(`Received audio: ${part.inlineData.mimeType ?? 'pcm'}.`)
                playLivePcm(part.inlineData.data, liveOutputContextRef, liveNextStartTimeRef)
              }
            }

            for (const functionCall of message.toolCall?.functionCalls ?? []) {
              appendLiveEvent(`Tool call: ${functionCall.name}.`)
              handleLiveToolCall(functionCall)
            }
          },
          onerror: (event) => {
            setLiveStatus(`Live API error: ${String(event.error ?? 'unknown error')}`)
            appendLiveEvent(`Error: ${String(event.error ?? 'unknown error')}`)
          },
          onclose: () => {
            setLiveStatus('Live API disconnected.')
            appendLiveEvent('WebSocket closed.')
            liveSessionRef.current = null
          },
        },
      })
      liveSessionRef.current = session

      const inputContext = new AudioContext()
      await inputContext.resume()
      liveInputContextRef.current = inputContext
      const source = inputContext.createMediaStreamSource(stream)
      const processor = inputContext.createScriptProcessor(4096, 1, 1)
      liveSourceRef.current = source
      liveProcessorRef.current = processor
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const now = performance.now()
        if (now - liveLastMeterUpdateRef.current > 120) {
          liveLastMeterUpdateRef.current = now
          setLiveMicLevel(readRms(input))
        }
        const pcm16 = resampleFloat32ToPcm16(
          input,
          inputContext.sampleRate,
          16_000,
        )
        session.sendRealtimeInput({
          audio: {
            data: arrayBufferToBase64(pcm16.buffer),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
        liveChunksSentRef.current += 1
        if (liveChunksSentRef.current % 25 === 0) {
          setLiveChunksSent(liveChunksSentRef.current)
          appendLiveEvent(`Sent ${liveChunksSentRef.current} audio chunks.`)
        }
      }
      source.connect(processor)
      const sink = inputContext.createGain()
      sink.gain.value = 0
      liveSinkRef.current = sink
      processor.connect(sink)
      sink.connect(inputContext.destination)
      appendLiveEvent('Microphone streaming started.')
      setAlwaysListening(true)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      setLiveStatus(`Live API failed: ${reason}`)
      appendLiveEvent(`Start failed: ${reason}`)
      stopLiveSession()
    }
  }, [
    appendLiveEvent,
    handleLiveToolCall,
    products,
    refreshAudioInputs,
    selectedAudioInputId,
  ])

  const stopLiveSession = React.useCallback(() => {
    liveProcessorRef.current?.disconnect()
    liveSourceRef.current?.disconnect()
    liveSinkRef.current?.disconnect()
    liveProcessorRef.current = null
    liveSourceRef.current = null
    liveSinkRef.current = null
    liveInputContextRef.current?.close()
      liveOutputContextRef.current?.close()
      recentLiveToolCallsRef.current.clear()
    liveInputContextRef.current = null
    liveOutputContextRef.current = null
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true } as never)
    liveSessionRef.current?.close()
    liveSessionRef.current = null
    setAlwaysListening(false)
    setLiveMicLevel(0)
    setLiveChunksSent(0)
    liveChunksSentRef.current = 0
    setLiveStatus('Live API disconnected.')
    appendLiveEvent('Live session stopped.')
  }, [appendLiveEvent])

  const sendLiveTextTest = React.useCallback(() => {
    if (!liveSessionRef.current) {
      appendLiveEvent('Text test skipped: Live session is not connected.')
      return
    }

    appendLiveEvent('Sending Live text test with explicit tool instruction.')
    liveSessionRef.current.sendRealtimeInput({
      text: 'Use the add_items tool now. Show me business clothes and add one complete outfit to the board.',
    } as never)
  }, [appendLiveEvent])

  const startMicTest = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(selectedAudioInputId),
      })
      const [track] = stream.getAudioTracks()
      setMicTrackSettings(JSON.stringify(track?.getSettings() ?? {}, null, 2))
      await refreshAudioInputs()
      const mimeType = getSupportedAudioMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      micTestChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) micTestChunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop())
        const blob = new Blob(micTestChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        })
        const dataUrl = await blobToDataUrl(blob)
        if (!audioRef.current) {
          setMicTestStatus(`Recorded ${blob.size} bytes, but audio element is unavailable.`)
          return
        }
        audioRef.current.src = dataUrl
        audioRef.current.load()
        await audioRef.current.play()
        setMicTestStatus(`Recorded and replaying ${blob.size} bytes from selected mic.`)
      }
      micTestRecorderRef.current = recorder
      recorder.start()
      setMicTestStatus('Recording mic test for 3 seconds...')
      window.setTimeout(() => recorder.stop(), 3000)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      setMicTestStatus(`Mic test failed: ${reason}`)
    }
  }, [refreshAudioInputs, selectedAudioInputId])

  const startRecording = React.useCallback(async () => {
    if (recordingState !== 'idle' || voiceMutation.isPending) return

    try {
      const stream =
        micStreamRef.current ??
        (await navigator.mediaDevices.getUserMedia({
          audio: buildAudioConstraints(selectedAudioInputId),
        }))
      micStreamRef.current = stream
      await refreshAudioInputs()
      const mimeType = getSupportedAudioMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )

      audioChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setRecordingState('processing')
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        })
        const audioDataUrl = await blobToDataUrl(blob)
        voiceMutation.mutate({
          audioDataUrl,
          currentProductIds: selectedOutfit.map((product) => product.id),
        })
      }

      recorderRef.current = recorder
      recorder.start()
      setRecordingState('recording')
      setAssistantReply(
        alwaysListening
          ? 'Listening for your next instruction.'
          : 'Recording. Release the button when you finish speaking.',
      )
    } catch {
      const message =
        'Microphone access is blocked. Enable microphone permissions to use model voice commands.'
      setAssistantReply(message)
      speak(message)
    }
  }, [
    alwaysListening,
    recordingState,
    refreshAudioInputs,
    selectedAudioInputId,
    selectedOutfit,
    speak,
    voiceMutation,
  ])

  const stopRecording = React.useCallback(() => {
    if (recordingState !== 'recording') return
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    recorderRef.current?.stop()
  }, [recordingState])

  React.useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current)
      stopLiveSession()
    }
  }, [stopLiveSession])

  return (
    <section className={`studio-shell ${bigScreenMode ? 'big-screen' : ''}`}>
      <div className="camera-panel">
        <video ref={videoRef} autoPlay muted playsInline suppressHydrationWarning />
        <div className="futuristic-grid" aria-hidden="true" />
        <div className="live-topbar">
          <button
            className={`play-live-button ${alwaysListening ? 'active' : ''}`}
            type="button"
            onClick={() => {
              if (alwaysListening) {
                stopLiveSession()
              } else {
                void startLiveSession()
              }
            }}
            aria-label={alwaysListening ? 'Stop Gemini Live' : 'Start Gemini Live'}
          >
            {alwaysListening ? 'Stop' : 'Play'}
          </button>
          <div>
            <strong>{alwaysListening ? 'Gemini Live active' : 'Gemini Live ready'}</strong>
            <span>{liveStatus}</span>
          </div>
          <button
            className="top-options-button"
            type="button"
            onClick={() => setBigScreenMode((enabled) => !enabled)}
          >
            {bigScreenMode ? 'Normal' : 'Big screen'}
          </button>
          <button className="top-options-button" type="button" onClick={() => setOptionsOpen(true)}>
            Options
          </button>
        </div>
        <div className="camera-overlay">
          <span>{cameraReady ? 'Live fitting room camera' : 'Waiting for camera'}</span>
          <strong>
            {selectedOutfit.length
              ? `${selectedOutfit.length} outfit item${selectedOutfit.length === 1 ? '' : 's'} selected`
              : 'No outfit selected'}
          </strong>
        </div>
        {floatingChoices.length || (!selectedOutfit.length && !visibleItems.length) ? (
          <div
            className={`floating-products ${floatingChoices.length ? 'has-items' : ''}`}
            aria-label="AI product choices"
          >
            {floatingChoices.length ? (
              floatingChoices.map((product) => (
                <article
                  className="floating-product-card"
                  key={product.id}
                >
                  <img src={product.imageUrl} alt={product.imageAlt} />
                  <span>{product.category}</span>
                  <strong>{product.name}</strong>
                  <div className="floating-product-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setTryOnResult(null)
                        setExpandedProduct(product)
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => addMatchesToOutfit([product], 'Manually selected')}
                    >
                      Add
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="floating-empty">
                Products the AI asks you to choose from will appear here.
              </div>
            )}
          </div>
        ) : null}
        {expandedProduct ? (
          <div className="expanded-product" aria-live="polite">
            <div className="expanded-product-copy">
              <span>{expandedProduct.category}</span>
              <strong>{expandedProduct.name}</strong>
              <p>{expandedProduct.imageDescription}</p>
            </div>
            <img src={expandedProduct.imageUrl} alt={expandedProduct.imageAlt} />
            <div className="expanded-product-actions">
              <button
                type="button"
                onClick={() => addMatchesToOutfit([expandedProduct], 'Expanded product selected')}
              >
                Add to outfit
              </button>
              <button type="button" onClick={() => setExpandedProduct(null)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
        {tryOnResult ? (
          <div className="camera-try-on-preview" aria-live="polite">
            <img src={tryOnResult.imageUrl} alt="Virtual try-on preview" />
            <button
              className="camera-return-button"
              type="button"
              onClick={() => setTryOnResult(null)}
              aria-label="Return to camera"
            >
              Camera
            </button>
          </div>
        ) : null}
        <canvas ref={canvasRef} hidden />
      </div>

      <aside className="assistant-panel">
        <div>
          <p className="eyebrow">Selected clothes</p>
          <h2>Render outfit</h2>
        </div>

        <div className="live-meter" aria-label="Microphone level">
          <span style={{ width: `${Math.min(100, liveMicLevel * 260)}%` }} />
        </div>

        <div className="assistant-card">
          <span>Selected render outfit</span>
          <p className="render-debug">{renderDebugStatus}</p>
          {outfitGroups.length ? (
            <div className="outfit-board compact">
              {outfitGroups.map((group) => (
                <article className="outfit-group" key={group.slot}>
                  <div className="outfit-group-header">
                    <strong>{slotLabels[group.slot]}</strong>
                    <button type="button" onClick={() => removeOutfitGroup(group.slot)}>
                      Remove
                    </button>
                  </div>
                  <button
                    className="selected-outfit-item"
                    type="button"
                    onClick={() => {
                      setExpandedProduct(null)
                      setTryOnResult(null)
                      setVisibleItems([group.selected, ...group.alternatives])
                    }}
                  >
                    <img src={group.selected.imageUrl} alt={group.selected.imageAlt} />
                    <span>{group.selected.name}</span>
                  </button>
                  {group.alternatives.length ? (
                    <div className="alternative-list">
                      <span>Alternatives</span>
                      {group.alternatives.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectAlternative(group.slot, product)}
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p>No items selected. Ask the assistant to add clothes.</p>
          )}
        </div>

        {tryOnMutation.isPending ? (
          <div className="try-on-result is-loading">
            <div className="render-loader" aria-hidden="true" />
            <strong>Generating virtual try-on</strong>
            <p>
              Gemini is editing your camera photo with the selected garment
              references. This can take a few seconds.
            </p>
          </div>
        ) : null}

        <audio ref={audioRef} preload="auto" suppressHydrationWarning />
      </aside>

      {optionsOpen ? (
        <div className="options-backdrop" role="presentation">
          <div className="options-modal" role="dialog" aria-modal="true" aria-label="Kiosk options">
            <div className="options-header">
              <div>
                <p className="eyebrow">Diagnostics</p>
                <h3>Voice and Live controls</h3>
              </div>
              <button type="button" onClick={() => setOptionsOpen(false)}>
                Close
              </button>
            </div>

            <button
              className={`voice-button ${recordingState}`}
              disabled={recordingState === 'processing' || alwaysListening}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchEnd={stopRecording}
              onTouchStart={startRecording}
              type="button"
            >
              <span className="recording-dot" />
              {recordingState === 'recording'
                ? 'Recording... release to send'
                : recordingState === 'processing'
                  ? 'Processing with Gemini...'
                  : 'Fallback: hold to talk'}
            </button>

        <label className="mic-picker">
          <span>Microphone</span>
          <select
            value={selectedAudioInputId}
            onChange={(event) => setSelectedAudioInputId(event.target.value)}
            disabled={alwaysListening || recordingState !== 'idle'}
          >
            {audioInputs.length ? (
              <>
                <option value="default">System default microphone</option>
                {audioInputs.map((input, index) => (
                <option
                  key={`${input.deviceId || 'empty'}-${input.groupId || 'group'}-${index}`}
                  value={input.deviceId}
                >
                  {formatAudioInputLabel(input, index)}
                </option>
                ))}
              </>
            ) : (
              <option value="default">System default microphone</option>
            )}
          </select>
        </label>
        <button className="listen-toggle" type="button" onClick={refreshAudioInputs}>
          Refresh microphones
        </button>
        <button className="listen-toggle" type="button" onClick={startMicTest}>
          Test selected mic
        </button>
        <small className="live-status">{micTestStatus}</small>
        {micTrackSettings ? (
          <details className="debug-panel">
            <summary>Selected mic track settings</summary>
            <pre className="track-settings">{micTrackSettings}</pre>
          </details>
        ) : null}
        <small className="live-status">Mic level {liveMicLevel.toFixed(3)} · chunks sent {liveChunksSent}</small>
        <button className="listen-toggle" type="button" onClick={sendLiveTextTest}>
          Send Live text test
        </button>
        <details className="debug-panel">
          <summary>Live API events</summary>
          {liveEvents.length ? (
            <ul className="live-events">
              {liveEvents.map((event) => (
                <li key={event.id}>{event.text}</li>
              ))}
            </ul>
          ) : (
            <p>No Live events yet.</p>
          )}
        </details>

        <div className="assistant-card">
          <span>Assistant</span>
          <p>{assistantReply}</p>
          <div className="speech-controls">
            <button type="button" onClick={replayAssistant}>
              Replay voice
            </button>
            <small>{speechStatus}</small>
          </div>
        </div>

        <details
          className="debug-panel"
          open={debugOpen}
          onToggle={(event) => setDebugOpen(event.currentTarget.open)}
        >
          <summary>Debug voice understanding</summary>
          {voiceDebugInfo ? (
            <dl>
              <dt>Model</dt>
              <dd>{voiceDebugInfo.model}</dd>
              <dt>Transcript</dt>
              <dd>{voiceDebugInfo.transcript || 'No transcript returned.'}</dd>
              <dt>Reply</dt>
              <dd>{voiceDebugInfo.reply}</dd>
              <dt>Add product IDs</dt>
    <dd>{voiceDebugInfo.addProductIds.join(', ') || 'none'}</dd>
    <dt>Visible product IDs</dt>
    <dd>{voiceDebugInfo.visibleProductIds.join(', ') || 'none'}</dd>
    <dt>Expanded ID</dt>
    <dd>{voiceDebugInfo.expandedProductId || 'none'}</dd>
    <dt>Flags</dt>
              <dd>
                clear={String(voiceDebugInfo.clearOutfit)}, tryOn=
                {String(voiceDebugInfo.tryOnRequested)}, clarification=
                {String(voiceDebugInfo.needsClarification)}
              </dd>
              <dt>Question</dt>
              <dd>{voiceDebugInfo.question || 'none'}</dd>
            </dl>
          ) : (
            <p>No voice request processed yet.</p>
          )}
        </details>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function getSupportedAudioMimeType() {
  const preferredTypes = [
    'audio/ogg;codecs=vorbis',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/webm',
  ]

  return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
}

function buildAudioConstraints(deviceId: string): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId && deviceId !== 'default'
      ? { deviceId: { exact: deviceId } }
      : {}),
  }
}

function formatAudioInputLabel(input: MediaDeviceInfo, index: number) {
  if (input.deviceId === 'default') return 'System default microphone'
  if (input.label) return input.label
  return `Microphone ${index + 1}`
}

function buildLiveSystemInstruction(products: Product[]) {
  const catalog = products
    .map(
      (product) =>
        `${product.id}: ${product.name}, category=${product.category}, tags=${product.styleTags.join(', ')}, colors=${product.colors.join(', ')}, ${product.shortDescription}`,
    )
    .join('\n')

  return `
You are Atelier AI, a real-time voice stylist inside a physical clothing store.
Speak naturally and briefly, but do not invent or name products from memory.
When the customer asks for clothes, options, recommendations, or to choose an option, say a short acknowledgement like "I am checking the store inventory" or ask one style question.
The kiosk backend will decide exact products from the database and show them on screen.
Use tools to update the kiosk screen whenever possible, but if tools are unavailable, do not list product names yourself.
Never add multiple final products from the same clothing group unless they are alternatives.
If the customer asks to render, try on, or take a photo, call render_try_on.
If the customer asks to see an item better, larger, closer, zoomed, opened, or with details, call expand_item with one product id.

Catalog:
${catalog}
`.trim()
}

function buildLiveTools(Type: typeof import('@google/genai').Type) {
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
          'Show products on the kiosk screen as search results or alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'add_items',
        description:
          'Add selected products to the outfit board. Same-category products become alternatives.',
        parameters: productIdsSchema,
      },
      {
        name: 'expand_item',
        description:
          'Expand one product on the camera view. Use when the user asks to see it better, bigger, closer, zoomed, opened, or with details.',
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
          'Take the current camera frame and generate the try-on using the selected outfit.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ],
  }
}

function resampleFloat32ToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(input.length / ratio)
  const output = new Int16Array(outputLength)

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = Math.floor(i * ratio)
    const sample = Math.max(-1, Math.min(1, input[sourceIndex] ?? 0))
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

function readRms(input: Float32Array) {
  let sum = 0

  for (const sample of input) {
    sum += sample * sample
  }

  return Math.sqrt(sum / input.length)
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function base64ToInt16Array(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Int16Array(bytes.buffer)
}

function playLivePcm(
  base64Pcm: string,
  contextRef: React.RefObject<AudioContext | null>,
  nextStartTimeRef: React.MutableRefObject<number>,
) {
  const context = contextRef.current
  if (!context) return

  const pcm = base64ToInt16Array(base64Pcm)
  const audioBuffer = context.createBuffer(1, pcm.length, 24_000)
  const channel = audioBuffer.getChannelData(0)

  for (let i = 0; i < pcm.length; i += 1) {
    channel[i] = pcm[i] / 0x8000
  }

  const source = context.createBufferSource()
  source.buffer = audioBuffer
  source.connect(context.destination)
  const startTime = Math.max(context.currentTime, nextStartTimeRef.current)
  source.start(startTime)
  nextStartTimeRef.current = startTime + audioBuffer.duration
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function speakAssistantReply(
  message: string,
  audioElement: HTMLAudioElement | null,
  setSpeechStatus: (status: string) => void,
) {
  try {
    setSpeechStatus('Generating model voice...')
    const speech = await generateAssistantSpeech({ data: { text: message } })

    if (speech.status === 'ok' && speech.audioDataUrl) {
      if (!audioElement) throw new Error('Audio element is not ready')
      audioElement.pause()
      audioElement.src = speech.audioDataUrl
      audioElement.currentTime = 0
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
    utterance.onstart = () => setSpeechStatus('Playing browser voice.')
    utterance.onend = () => setSpeechStatus('Browser voice finished.')
    utterance.onerror = () => setSpeechStatus('Browser voice failed.')
    window.speechSynthesis.speak(utterance)
  } catch {
    setSpeechStatus('No speech playback method succeeded.')
  }
}
