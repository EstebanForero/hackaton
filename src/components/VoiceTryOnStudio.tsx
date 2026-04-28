import { useMutation } from '@tanstack/react-query'
import { PCMPlayer } from '@speechmatics/web-pcm-player'
import * as React from 'react'
import type { Product } from '#/db/schema'
import {
  createVirtualTryOn,
  createLiveSessionToken,
  processTextCommand,
  processVoiceCommand,
} from '#/server/products'
import {
  arrayBufferToBase64,
  blobToDataUrl,
  buildAudioConstraints,
  fingerprintLiveAudioChunk,
  getSupportedAudioMimeType,
  playLivePcm,
  readRms,
  resampleFloat32ToPcm16,
} from './studio/audio'
import { buildRenderableOutfit, getSlot } from './studio/outfit'
import {
  AssistantPanel,
  CameraPanel,
  OptionsModal,
  StudioTopBar,
} from './studio/StudioPanels'
import {
  buildLiveRealtimeInputConfig,
  buildLiveSystemInstruction,
  buildLiveTools,
} from './studio/live'
import { speakAssistantReply } from './studio/speech'
import type {
  LiveEvent,
  LiveInputMode,
  LiveMicSettings,
  OutfitGroup,
  OutfitSlot,
  TryOnResult,
  VoiceDebugInfo,
} from './studio/types'
import { defaultLiveMicSettings } from './studio/types'

type StudioProps = {
  products: Product[]
}

export function VoiceTryOnStudio({ products }: StudioProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const micStreamRef = React.useRef<MediaStream | null>(null)
  const recordingTimeoutRef = React.useRef<number | null>(null)
  const processingClearTimeoutRef = React.useRef<number | null>(null)
  const liveSessionRef = React.useRef<{
    close: () => void
    sendRealtimeInput: (params: never) => void
    sendToolResponse: (params: never) => void
  } | null>(null)
  const liveInputContextRef = React.useRef<AudioContext | null>(null)
  const liveOutputContextRef = React.useRef<AudioContext | null>(null)
  const livePcmPlayerRef = React.useRef<PCMPlayer | null>(null)
  const liveOutputQueueEndTimeRef = React.useRef(0)
  const liveProcessorRef = React.useRef<ScriptProcessorNode | null>(null)
  const liveSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
  const liveSinkRef = React.useRef<GainNode | null>(null)
  const liveChunksSentRef = React.useRef(0)
  const liveLastMeterUpdateRef = React.useRef(0)
  const liveEventIdRef = React.useRef(0)
  const liveLastFinishedTranscriptRef = React.useRef('')
  const liveLastFinishedTranscriptAtRef = React.useRef(0)
  const assistantSpeakingUntilRef = React.useRef(0)
  const liveInputModeRef = React.useRef<LiveInputMode>('idle')
  const suppressLiveAudioRef = React.useRef(false)
  const awaitingTryOnFeedbackRef = React.useRef(false)
  const recentLiveAudioChunksRef = React.useRef(new Map<string, number>())
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
  const [liveInputMode, setLiveInputModeState] =
    React.useState<LiveInputMode>('idle')
  const [liveProcessingLabel, setLiveProcessingLabel] = React.useState('')
  const [liveToolLabel, setLiveToolLabel] = React.useState('')
  const [liveEvents, setLiveEvents] = React.useState<LiveEvent[]>([])
  const [liveMicLevel, setLiveMicLevel] = React.useState(0)
  const [liveChunksSent, setLiveChunksSent] = React.useState(0)
  const [liveMicSettings, setLiveMicSettings] =
    React.useState<LiveMicSettings>(defaultLiveMicSettings)
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
  const [tryOnResult, setTryOnResult] = React.useState<TryOnResult | null>(null)
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

  const setLiveInputMode = React.useCallback((mode: LiveInputMode) => {
    if (liveInputModeRef.current === mode) return
    liveInputModeRef.current = mode
    setLiveInputModeState(mode)
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
      const feedbackQuestion =
        result.status === 'generated'
          ? 'How do you feel about this look? Would you keep it, or should I try a different direction?'
          : result.message
      setTryOnResult(result)
      setRenderDebugStatus(result.message)
      setAssistantReply(feedbackQuestion)
      awaitingTryOnFeedbackRef.current = result.status === 'generated'
      suppressLiveAudioRef.current = false
      setLiveProcessingLabel('')
      speak(feedbackQuestion)
      appendLiveEvent(
        `Try-on returned ${result.status}; references: ${result.references
          .map((reference) => reference.name)
          .join(', ') || 'none'}.`,
      )
    },
    onError: () => {
      const message = 'Try-on failed. Check server logs and AI configuration.'
      suppressLiveAudioRef.current = false
      awaitingTryOnFeedbackRef.current = false
      setLiveProcessingLabel('')
      setRenderDebugStatus(message)
      setAssistantReply(message)
    },
    onSettled: () => {
      suppressLiveAudioRef.current = false
    },
  })

  const voiceMutation = useMutation({
    mutationFn: (input: { audioDataUrl: string; currentProductIds: string[] }) =>
      processVoiceCommand({ data: input }),
    onMutate: () => {
      setLiveProcessingLabel('Understanding voice')
    },
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
    onSettled: () => {
      setRecordingState('idle')
      setLiveInputMode(alwaysListening ? 'listening' : 'idle')
      setLiveProcessingLabel('')
    },
  })

  const liveTextMutation = useMutation({
    mutationFn: (input: {
      text: string
      currentProductIds: string[]
      visibleProductIds: string[]
    }) =>
      processTextCommand({ data: input }),
    onMutate: () => {
      setLiveProcessingLabel('Checking inventory')
    },
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
    onSettled: () => {
      setLiveProcessingLabel('')
    },
  })

  const blockMicWhileAssistantSpeaks = React.useCallback(
    (durationMs = 5000) => {
      assistantSpeakingUntilRef.current = Math.max(
        assistantSpeakingUntilRef.current,
        Date.now() + durationMs,
      )
    },
    [],
  )

  const releaseAssistantMicBlock = React.useCallback(() => {
    assistantSpeakingUntilRef.current = Math.min(
      assistantSpeakingUntilRef.current,
      Date.now() + 250,
    )
  }, [])

  const speak = React.useCallback((message: string) => {
    void speakAssistantReply(message, audioRef.current, setSpeechStatus, {
      onStart: (durationMs) => blockMicWhileAssistantSpeaks(durationMs ?? 8000),
      onEnd: releaseAssistantMicBlock,
    })
  }, [blockMicWhileAssistantSpeaks, releaseAssistantMicBlock])

  const replayAssistant = React.useCallback(() => {
    void speakAssistantReply(assistantReply, audioRef.current, setSpeechStatus, {
      onStart: (durationMs) => blockMicWhileAssistantSpeaks(durationMs ?? 8000),
      onEnd: releaseAssistantMicBlock,
    })
  }, [assistantReply, blockMicWhileAssistantSpeaks, releaseAssistantMicBlock])

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
        selectedOutfitRef.current,
        immediateProducts,
      )

      if (!photoDataUrl || !finalOutfit.length) {
        const selectedCount = selectedOutfitRef.current.length
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
      const message = `Taking a photo and preparing a virtual try-on with ${outfitNames}. Please wait a moment while the outfit finishes rendering.`
      setExpandedProduct(null)
      suppressLiveAudioRef.current = true
      awaitingTryOnFeedbackRef.current = false
      setLiveProcessingLabel('Rendering outfit')
      setRenderDebugStatus(
        `Render request sent with ${finalOutfit.length} item(s): ${outfitNames}.`,
      )
      appendLiveEvent(`Render request sent with ${finalOutfit.length} item(s).`)
      appendLiveEvent(
        `Reference URLs: ${finalOutfit.map((product) => product.imageUrl).join(' | ')}`,
      )
      setTryOnResult(null)
      setAssistantReply(message)
      speak(message)
      tryOnMutation.mutate({
        productIds: finalOutfit.map((product) => product.id),
        prompt,
        photoDataUrl,
      })
    },
    [appendLiveEvent, capturePhoto, speak, tryOnMutation],
  )

  const sendLiveToolResponse = React.useCallback(
    (
      functionCall: { id?: string; name?: string },
      productIds: string[],
      output: Record<string, unknown>,
      scheduling?: string,
    ) => {
      liveSessionRef.current?.sendToolResponse({
        functionResponses: [
          {
            id: functionCall.id,
            name: functionCall.name,
            scheduling,
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
      const visibleIndex =
        typeof functionCall.args?.visibleIndex === 'number'
          ? functionCall.args.visibleIndex
          : undefined
      const productsById = new Map(products.map((product) => [product.id, product]))
      const matchedProducts = productIds
        .map((productId) => productsById.get(productId))
        .filter((product): product is Product => Boolean(product))
      const visibleIndexedProduct =
        visibleIndex && visibleIndex > 0
          ? visibleItemsRef.current[visibleIndex - 1]
          : undefined
      const resolvedProducts =
        matchedProducts.length || functionCall.name === 'show_items'
          ? matchedProducts
          : visibleIndexedProduct
            ? [visibleIndexedProduct]
            : visibleItemsRef.current.length === 1
              ? [visibleItemsRef.current[0]]
              : []
      const resolvedProductIds = resolvedProducts.map((product) => product.id)
      const callTargetKey =
        resolvedProductIds.join(',') || productIds.join(',') || String(visibleIndex ?? 'none')
      const callKey = `${functionCall.name}-${callTargetKey}`
      const now = Date.now()
      const lastCallAt = recentLiveToolCallsRef.current.get(callKey) ?? 0
      const isImmediateDuplicate = now - lastCallAt < 1200

      if (isImmediateDuplicate) {
        appendLiveEvent(`Skipped immediate duplicate tool effect: ${functionCall.name}.`)
        sendLiveToolResponse(functionCall, resolvedProductIds, {
          ok: true,
          duplicate: true,
          skippedEffect: true,
        }, 'SILENT')
        return
      }

      recentLiveToolCallsRef.current.set(callKey, now)
      for (const [key, timestamp] of recentLiveToolCallsRef.current) {
        if (now - timestamp > 10_000) recentLiveToolCallsRef.current.delete(key)
      }

      if (functionCall.name === 'show_items') {
        setExpandedProduct(null)
        setTryOnResult(null)
        setVisibleItems(resolvedProducts)
      }

      if (functionCall.name === 'add_items') {
        addMatchesToOutfit(resolvedProducts, 'Selected by Gemini Live.')
      }

      if (functionCall.name === 'expand_item') {
        setExpandedProduct(resolvedProducts[0] ?? null)
      }

      if (functionCall.name === 'clear_outfit') {
        setVisibleItems([])
        setOutfitGroups([])
        setExpandedProduct(null)
        setTryOnResult(null)
      }

      if (functionCall.name === 'render_try_on') {
        requestTryOn('Render the current live-selected outfit.', resolvedProducts)
      }

      appendLiveEvent(
        `${functionCall.name} resolved ${resolvedProductIds.length} product(s): ${resolvedProductIds.join(', ') || 'none'}.`,
      )
      sendLiveToolResponse(
        functionCall,
        resolvedProductIds,
        { ok: true, visibleIndex: visibleIndex ?? null },
        'SILENT',
      )
    },
    [addMatchesToOutfit, appendLiveEvent, products, requestTryOn, sendLiveToolResponse],
  )

  const startLiveSession = React.useCallback(async () => {
    if (liveSessionRef.current) return

    try {
      setLiveStatus('Requesting ephemeral Live token...')
      const [
        {
          ActivityHandling,
          Behavior,
          EndSensitivity,
          GoogleGenAI,
          Modality,
          StartSensitivity,
          TurnCoverage,
          Type,
        },
        tokenResult,
      ] = await Promise.all([
        import('@google/genai'),
        createLiveSessionToken({ data: liveMicSettings }),
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
      const pcmPlayer = new PCMPlayer(outputContext)
      pcmPlayer.volumePercentage = 72
      livePcmPlayerRef.current = pcmPlayer
      liveOutputQueueEndTimeRef.current = outputContext.currentTime
      recentLiveToolCallsRef.current.clear()
      recentLiveAudioChunksRef.current.clear()

      const session = await ai.live.connect({
        model: tokenResult.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: buildLiveRealtimeInputConfig({
            ActivityHandling,
            EndSensitivity,
            StartSensitivity,
            TurnCoverage,
          }, liveMicSettings),
          systemInstruction: {
            parts: [{ text: buildLiveSystemInstruction(products) }],
          },
          tools: [buildLiveTools(Type, Behavior)],
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
              liveOutputQueueEndTimeRef.current =
                liveOutputContextRef.current?.currentTime ?? 0
              recentLiveAudioChunksRef.current.clear()
            }

            const inputText = message.serverContent?.inputTranscription?.text
            if (inputText) {
              appendLiveEvent(`Heard: ${inputText}`)
              const now = Date.now()
              const isImmediateDuplicateTranscript =
                inputText === liveLastFinishedTranscriptRef.current &&
                now - liveLastFinishedTranscriptAtRef.current < 1800
              if (
                message.serverContent?.inputTranscription?.finished &&
                !isImmediateDuplicateTranscript
              ) {
                if (Date.now() < assistantSpeakingUntilRef.current) {
                  appendLiveEvent('Ignored transcript while assistant audio was playing.')
                } else {
                  liveLastFinishedTranscriptRef.current = inputText
                  liveLastFinishedTranscriptAtRef.current = now
                  if (awaitingTryOnFeedbackRef.current) {
                    awaitingTryOnFeedbackRef.current = false
                    suppressLiveAudioRef.current = false
                    appendLiveEvent('Customer responded to try-on feedback prompt; Live audio resumed.')
                  }
                  setLiveProcessingLabel('Thinking')
                  appendLiveEvent('Sending heard transcript to DB planner.')
                  liveTextMutation.mutate({
                    text: inputText,
                    currentProductIds: selectedOutfitRef.current.map((product) => product.id),
                    visibleProductIds: visibleItemsRef.current.map((product) => product.id),
                  })
                }
              }
            }

            const outputText = message.serverContent?.outputTranscription?.text
            if (outputText) {
              setLiveProcessingLabel('Speaking')
              appendLiveEvent(
                suppressLiveAudioRef.current
                  ? `Live model said while muted: ${outputText}`
                  : `Live model said, ignored for inventory: ${outputText}`,
              )
            }

            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                if (suppressLiveAudioRef.current) {
                  appendLiveEvent('Muted Live audio while waiting for rendered-preview feedback.')
                } else {
                  setLiveProcessingLabel('Speaking')
                  const audioKey = fingerprintLiveAudioChunk(part.inlineData.data)
                  const now = Date.now()
                  const lastPlayedAt = recentLiveAudioChunksRef.current.get(audioKey) ?? 0

                  if (now - lastPlayedAt < 15_000) {
                    appendLiveEvent('Skipped repeated Live audio chunk.')
                    continue
                  }

                  recentLiveAudioChunksRef.current.set(audioKey, now)
                  for (const [key, timestamp] of recentLiveAudioChunksRef.current) {
                    if (now - timestamp > 30_000) {
                      recentLiveAudioChunksRef.current.delete(key)
                    }
                  }

                  appendLiveEvent(`Received audio: ${part.inlineData.mimeType ?? 'pcm'}.`)
                  const playbackDurationSeconds = playLivePcm(
                    part.inlineData.data,
                    part.inlineData.mimeType ?? 'audio/pcm;rate=24000',
                    livePcmPlayerRef,
                    liveOutputContextRef,
                    liveOutputQueueEndTimeRef,
                  )
                  blockMicWhileAssistantSpeaks(
                    Math.max(650, playbackDurationSeconds * 1000 + 450),
                  )
                }
              }
            }

            for (const functionCall of message.toolCall?.functionCalls ?? []) {
              const toolLabel = formatLiveToolLabel(functionCall.name)
              setLiveToolLabel(toolLabel)
              setLiveProcessingLabel(
                functionCall.name === 'render_try_on'
                  ? 'Rendering outfit'
                  : toolLabel,
              )
              appendLiveEvent(`Tool call: ${functionCall.name}.`)
              handleLiveToolCall(functionCall)
              if (functionCall.name !== 'render_try_on') {
                if (processingClearTimeoutRef.current) {
                  window.clearTimeout(processingClearTimeoutRef.current)
                }
                processingClearTimeoutRef.current = window.setTimeout(() => {
                  setLiveProcessingLabel('')
                  setLiveToolLabel('')
                  processingClearTimeoutRef.current = null
                }, 900)
              }
            }

            if (message.serverContent?.turnComplete && !tryOnMutation.isPending) {
              setLiveProcessingLabel('')
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
        const assistantIsSpeaking = Date.now() < assistantSpeakingUntilRef.current
        if (now - liveLastMeterUpdateRef.current > 120) {
          liveLastMeterUpdateRef.current = now
          const rms = assistantIsSpeaking ? 0 : readRms(input)
          setLiveMicLevel(rms)
          if (assistantIsSpeaking) {
            setLiveInputMode('muted')
          } else if (rms > 0.018) {
            setLiveInputMode('hearing')
          } else {
            setLiveInputMode('listening')
          }
        }
        if (assistantIsSpeaking) {
          return
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
      setLiveInputMode('listening')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      setLiveStatus(`Live API failed: ${reason}`)
      appendLiveEvent(`Start failed: ${reason}`)
      stopLiveSession()
    }
  }, [
    appendLiveEvent,
    handleLiveToolCall,
    liveMicSettings,
    products,
    refreshAudioInputs,
    selectedAudioInputId,
    tryOnMutation.isPending,
  ])

  const stopLiveSession = React.useCallback(() => {
    liveProcessorRef.current?.disconnect()
    liveSourceRef.current?.disconnect()
    liveSinkRef.current?.disconnect()
    liveProcessorRef.current = null
    liveSourceRef.current = null
    liveSinkRef.current = null
    livePcmPlayerRef.current = null
    liveOutputQueueEndTimeRef.current = 0
    liveInputContextRef.current?.close()
    liveOutputContextRef.current?.close()
    suppressLiveAudioRef.current = false
    awaitingTryOnFeedbackRef.current = false
    liveLastFinishedTranscriptRef.current = ''
    liveLastFinishedTranscriptAtRef.current = 0
    assistantSpeakingUntilRef.current = 0
    recentLiveToolCallsRef.current.clear()
    recentLiveAudioChunksRef.current.clear()
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
    setLiveProcessingLabel('')
    setLiveToolLabel('')
    setLiveInputMode('idle')
    if (processingClearTimeoutRef.current) {
      window.clearTimeout(processingClearTimeoutRef.current)
      processingClearTimeoutRef.current = null
    }
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
      setLiveInputMode('recording')
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
    setLiveInputMode(alwaysListening ? 'listening' : 'idle')
  }, [alwaysListening, recordingState, setLiveInputMode])

  React.useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current)
      if (processingClearTimeoutRef.current) {
        window.clearTimeout(processingClearTimeoutRef.current)
      }
      stopLiveSession()
    }
  }, [stopLiveSession])

  const aiProcessingLabel =
    tryOnMutation.isPending
      ? 'Rendering outfit'
      : voiceMutation.isPending || recordingState === 'processing'
        ? 'Understanding voice'
        : liveTextMutation.isPending
          ? 'Checking inventory'
          : liveProcessingLabel
  const liveInputLabel = formatLiveInputLabel(liveInputMode)
  const aiIsProcessing = Boolean(aiProcessingLabel)

  return (
    <section className={`studio-shell ${bigScreenMode ? 'big-screen' : ''}`}>
      <CameraPanel
        videoRef={videoRef}
        canvasRef={canvasRef}
        cameraReady={cameraReady}
        selectedOutfitCount={selectedOutfit.length}
        floatingChoices={floatingChoices}
        selectedAndVisibleAreEmpty={!selectedOutfit.length && !visibleItems.length}
        expandedProduct={expandedProduct}
        tryOnResult={tryOnResult}
        onViewProduct={(product) => {
          setTryOnResult(null)
          setExpandedProduct(product)
        }}
        onAddProduct={(product, reason) => addMatchesToOutfit([product], reason)}
        onCloseExpanded={() => setExpandedProduct(null)}
        onReturnToCamera={() => {
          suppressLiveAudioRef.current = false
          awaitingTryOnFeedbackRef.current = false
          setLiveProcessingLabel('')
          setTryOnResult(null)
        }}
        topBar={
          <StudioTopBar
            alwaysListening={alwaysListening}
            liveStatus={liveStatus}
            aiIsProcessing={aiIsProcessing}
            aiProcessingLabel={aiProcessingLabel}
            liveInputMode={liveInputMode}
            liveInputLabel={liveInputLabel}
            recordingState={recordingState}
            bigScreenMode={bigScreenMode}
            onToggleLive={() => {
              if (alwaysListening) {
                stopLiveSession()
              } else {
                void startLiveSession()
              }
            }}
            onToggleBigScreen={() => setBigScreenMode((enabled) => !enabled)}
            onOpenOptions={() => setOptionsOpen(true)}
          />
        }
      />

      <AssistantPanel
        audioRef={audioRef}
        liveMicLevel={liveMicLevel}
        liveInputMode={liveInputMode}
        liveInputLabel={liveInputLabel}
        liveToolLabel={liveToolLabel}
        aiIsProcessing={aiIsProcessing}
        aiProcessingLabel={aiProcessingLabel}
        renderDebugStatus={renderDebugStatus}
        outfitGroups={outfitGroups}
        tryOnPending={tryOnMutation.isPending}
        onRemoveOutfitGroup={removeOutfitGroup}
        onShowAlternatives={(productsToShow) => {
          setExpandedProduct(null)
          setTryOnResult(null)
          setVisibleItems(productsToShow)
        }}
        onSelectAlternative={selectAlternative}
      />

      {optionsOpen ? (
        <OptionsModal
          recordingState={recordingState}
          alwaysListening={alwaysListening}
          selectedAudioInputId={selectedAudioInputId}
          audioInputs={audioInputs}
          liveMicSettings={liveMicSettings}
          micTestStatus={micTestStatus}
          micTrackSettings={micTrackSettings}
          liveMicLevel={liveMicLevel}
          liveChunksSent={liveChunksSent}
          liveEvents={liveEvents}
          assistantReply={assistantReply}
          speechStatus={speechStatus}
          debugOpen={debugOpen}
          voiceDebugInfo={voiceDebugInfo}
          onClose={() => setOptionsOpen(false)}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onSelectAudioInput={setSelectedAudioInputId}
          onChangeLiveMicSettings={(nextSettings) =>
            setLiveMicSettings((currentSettings) => ({
              ...currentSettings,
              ...nextSettings,
            }))
          }
          onRefreshAudioInputs={refreshAudioInputs}
          onStartMicTest={startMicTest}
          onSendLiveTextTest={sendLiveTextTest}
          onReplayAssistant={replayAssistant}
          onToggleDebug={setDebugOpen}
        />
      ) : null}
    </section>
  )
}

function formatLiveInputLabel(mode: LiveInputMode) {
  if (mode === 'hearing') return 'Hearing you'
  if (mode === 'muted') return 'Mic paused'
  if (mode === 'recording') return 'Recording'
  if (mode === 'listening') return 'Listening'
  return 'Mic idle'
}

function formatLiveToolLabel(name?: string) {
  if (name === 'show_items') return 'Showing products'
  if (name === 'add_items') return 'Adding outfit'
  if (name === 'expand_item') return 'Opening product'
  if (name === 'clear_outfit') return 'Clearing outfit'
  if (name === 'render_try_on') return 'Rendering try-on'
  return name ?? 'Tool'
}
