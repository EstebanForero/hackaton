import type * as React from 'react'
import type { Product } from '#/db/schema'
import { slotLabels } from './outfit'
import type {
  LiveEvent,
  LiveInputMode,
  LiveMicSettings,
  OutfitGroup,
  OutfitSlot,
  TryOnResult,
  VoiceDebugInfo,
} from './types'

type TopBarProps = {
  alwaysListening: boolean
  liveStatus: string
  aiIsProcessing: boolean
  aiProcessingLabel: string
  liveInputMode: LiveInputMode
  liveInputLabel: string
  recordingState: 'idle' | 'recording' | 'processing'
  bigScreenMode: boolean
  onToggleLive: () => void
  onToggleBigScreen: () => void
  onOpenOptions: () => void
}

export function StudioTopBar({
  alwaysListening,
  liveStatus,
  aiIsProcessing,
  aiProcessingLabel,
  liveInputMode,
  liveInputLabel,
  recordingState,
  bigScreenMode,
  onToggleLive,
  onToggleBigScreen,
  onOpenOptions,
}: TopBarProps) {
  return (
    <div className="live-topbar">
      <button
        className={`play-live-button ${alwaysListening ? 'active' : ''}`}
        type="button"
        onClick={onToggleLive}
        aria-label={alwaysListening ? 'Stop Gemini Live' : 'Start Gemini Live'}
      >
        {alwaysListening ? 'Stop' : 'Play'}
      </button>
      <div>
        <strong>{alwaysListening ? 'Gemini Live active' : 'Gemini Live ready'}</strong>
        <span>{liveStatus}</span>
      </div>
      {aiIsProcessing ? (
        <StatusPill className="ai-processing-pill" label={aiProcessingLabel} />
      ) : null}
      {alwaysListening || recordingState !== 'idle' ? (
        <StatusPill
          className={`ai-processing-pill input-${liveInputMode}`}
          dotClassName="input-state-dot"
          label={liveInputLabel}
        />
      ) : null}
      <button className="top-options-button" type="button" onClick={onToggleBigScreen}>
        {bigScreenMode ? 'Normal' : 'Big screen'}
      </button>
      <button className="top-options-button" type="button" onClick={onOpenOptions}>
        Options
      </button>
    </div>
  )
}

type CameraPanelProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  cameraReady: boolean
  selectedOutfitCount: number
  floatingChoices: Product[]
  selectedAndVisibleAreEmpty: boolean
  expandedProduct: Product | null
  tryOnResult: TryOnResult | null
  onViewProduct: (product: Product) => void
  onAddProduct: (product: Product, reason: string) => void
  onCloseExpanded: () => void
  onReturnToCamera: () => void
  topBar: React.ReactNode
}

export function CameraPanel({
  videoRef,
  canvasRef,
  cameraReady,
  selectedOutfitCount,
  floatingChoices,
  selectedAndVisibleAreEmpty,
  expandedProduct,
  tryOnResult,
  onViewProduct,
  onAddProduct,
  onCloseExpanded,
  onReturnToCamera,
  topBar,
}: CameraPanelProps) {
  return (
    <div className="camera-panel">
      <video ref={videoRef} autoPlay muted playsInline suppressHydrationWarning />
      <div className="futuristic-grid" aria-hidden="true" />
      {topBar}
      <div className="camera-overlay">
        <span>{cameraReady ? 'Live fitting room camera' : 'Waiting for camera'}</span>
        <strong>
          {selectedOutfitCount
            ? `${selectedOutfitCount} outfit item${selectedOutfitCount === 1 ? '' : 's'} selected`
            : 'No outfit selected'}
        </strong>
      </div>
      {floatingChoices.length || selectedAndVisibleAreEmpty ? (
        <div
          className={`floating-products ${floatingChoices.length ? 'has-items' : ''}`}
          aria-label="AI product choices"
        >
          {floatingChoices.length ? (
            floatingChoices.map((product) => (
              <article className="floating-product-card" key={product.id}>
                <img src={product.imageUrl} alt={product.imageAlt} />
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                <div className="floating-product-actions">
                  <button type="button" onClick={() => onViewProduct(product)}>
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddProduct(product, 'Manually selected')}
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
              onClick={() => onAddProduct(expandedProduct, 'Expanded product selected')}
            >
              Add to outfit
            </button>
            <button type="button" onClick={onCloseExpanded}>
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
            onClick={onReturnToCamera}
            aria-label="Return to camera"
          >
            Camera
          </button>
        </div>
      ) : null}
      <canvas ref={canvasRef} hidden />
    </div>
  )
}

type AssistantPanelProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  liveMicLevel: number
  liveInputMode: LiveInputMode
  liveInputLabel: string
  liveToolLabel: string
  aiIsProcessing: boolean
  aiProcessingLabel: string
  renderDebugStatus: string
  outfitGroups: OutfitGroup[]
  tryOnPending: boolean
  onRemoveOutfitGroup: (slot: OutfitSlot) => void
  onShowAlternatives: (products: Product[]) => void
  onSelectAlternative: (slot: OutfitSlot, product: Product) => void
}

export function AssistantPanel({
  audioRef,
  liveMicLevel,
  liveInputMode,
  liveInputLabel,
  liveToolLabel,
  aiIsProcessing,
  aiProcessingLabel,
  renderDebugStatus,
  outfitGroups,
  tryOnPending,
  onRemoveOutfitGroup,
  onShowAlternatives,
  onSelectAlternative,
}: AssistantPanelProps) {
  return (
    <aside className="assistant-panel">
      <div>
        <p className="eyebrow">Selected clothes</p>
        <h2>Render outfit</h2>
      </div>

      <div className="live-meter" aria-label="Microphone level">
        <span style={{ width: `${Math.min(100, liveMicLevel * 260)}%` }} />
      </div>
      <StatusGrid
        liveInputMode={liveInputMode}
        liveInputLabel={liveInputLabel}
        liveToolLabel={liveToolLabel}
        aiIsProcessing={aiIsProcessing}
        aiProcessingLabel={aiProcessingLabel}
      />
      {aiIsProcessing ? (
        <div className="assistant-processing-card" role="status" aria-live="polite">
          <div className="render-loader compact" aria-hidden="true" />
          <span>{aiProcessingLabel}</span>
        </div>
      ) : null}

      <div className="assistant-card">
        <span>Selected render outfit</span>
        <p className="render-debug">{renderDebugStatus}</p>
        {outfitGroups.length ? (
          <div className="outfit-board compact">
            {outfitGroups.map((group) => (
              <article className="outfit-group" key={group.slot}>
                <div className="outfit-group-header">
                  <strong>{slotLabels[group.slot]}</strong>
                  <button type="button" onClick={() => onRemoveOutfitGroup(group.slot)}>
                    Remove
                  </button>
                </div>
                <button
                  className="selected-outfit-item"
                  type="button"
                  onClick={() => onShowAlternatives([group.selected, ...group.alternatives])}
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
                        onClick={() => onSelectAlternative(group.slot, product)}
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

      {tryOnPending ? (
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
  )
}

type OptionsModalProps = {
  recordingState: 'idle' | 'recording' | 'processing'
  alwaysListening: boolean
  selectedAudioInputId: string
  audioInputs: MediaDeviceInfo[]
  liveMicSettings: LiveMicSettings
  micTestStatus: string
  micTrackSettings: string
  liveMicLevel: number
  liveChunksSent: number
  liveEvents: LiveEvent[]
  assistantReply: string
  speechStatus: string
  debugOpen: boolean
  voiceDebugInfo: VoiceDebugInfo | null
  onClose: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onSelectAudioInput: (deviceId: string) => void
  onChangeLiveMicSettings: (settings: Partial<LiveMicSettings>) => void
  onRefreshAudioInputs: () => void
  onStartMicTest: () => void
  onSendLiveTextTest: () => void
  onReplayAssistant: () => void
  onToggleDebug: (open: boolean) => void
}

export function OptionsModal({
  recordingState,
  alwaysListening,
  selectedAudioInputId,
  audioInputs,
  liveMicSettings,
  micTestStatus,
  micTrackSettings,
  liveMicLevel,
  liveChunksSent,
  liveEvents,
  assistantReply,
  speechStatus,
  debugOpen,
  voiceDebugInfo,
  onClose,
  onStartRecording,
  onStopRecording,
  onSelectAudioInput,
  onChangeLiveMicSettings,
  onRefreshAudioInputs,
  onStartMicTest,
  onSendLiveTextTest,
  onReplayAssistant,
  onToggleDebug,
}: OptionsModalProps) {
  return (
    <div className="options-backdrop" role="presentation">
      <div className="options-modal" role="dialog" aria-modal="true" aria-label="Kiosk options">
        <div className="options-header">
          <div>
            <p className="eyebrow">Diagnostics</p>
            <h3>Voice and Live controls</h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <button
          className={`voice-button ${recordingState}`}
          disabled={recordingState === 'processing' || alwaysListening}
          onMouseDown={onStartRecording}
          onMouseUp={onStopRecording}
          onMouseLeave={onStopRecording}
          onTouchEnd={onStopRecording}
          onTouchStart={onStartRecording}
          type="button"
        >
          <span className="recording-dot" />
          {recordingState === 'recording'
            ? 'Recording... release to send'
            : recordingState === 'processing'
              ? 'Processing with Gemini...'
              : 'Fallback: hold to talk'}
        </button>

        <div className="options-layout">
          <div className="options-main">
            <label className="mic-picker">
              <span>Microphone</span>
              <select
                value={selectedAudioInputId}
                onChange={(event) => onSelectAudioInput(event.target.value)}
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
            <button className="listen-toggle" type="button" onClick={onRefreshAudioInputs}>
              Refresh microphones
            </button>
            <button className="listen-toggle" type="button" onClick={onStartMicTest}>
              Test selected mic
            </button>
            <small className="live-status">{micTestStatus}</small>
            {micTrackSettings ? (
              <details className="debug-panel">
                <summary>Selected mic track settings</summary>
                <pre className="track-settings">{micTrackSettings}</pre>
              </details>
            ) : null}
            <small className="live-status">
              Mic level {liveMicLevel.toFixed(3)} · chunks sent {liveChunksSent}
            </small>
            <button className="listen-toggle" type="button" onClick={onSendLiveTextTest}>
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
                <button type="button" onClick={onReplayAssistant}>
                  Replay voice
                </button>
                <small>{speechStatus}</small>
              </div>
            </div>

            <details
              className="debug-panel"
              open={debugOpen}
              onToggle={(event) => onToggleDebug(event.currentTarget.open)}
            >
              <summary>Debug voice understanding</summary>
              {voiceDebugInfo ? <DebugVoiceInfo info={voiceDebugInfo} /> : <p>No voice request processed yet.</p>}
            </details>
          </div>

          <aside className="settings-sidebar" aria-label="Live mic sensitivity">
            <div className="sidebar-heading">
              <span>Gemini Live mic</span>
              <strong>Sensitivity</strong>
            </div>
            <label className="mic-picker">
              <span>Start sensitivity</span>
              <select
                value={liveMicSettings.startSensitivity}
                onChange={(event) =>
                  onChangeLiveMicSettings({
                    startSensitivity: event.target.value as LiveMicSettings['startSensitivity'],
                  })
                }
                disabled={alwaysListening}
              >
                <option value="high">High - hear speech sooner</option>
                <option value="low">Low - avoid false starts</option>
              </select>
            </label>
            <label className="mic-picker">
              <span>End sensitivity</span>
              <select
                value={liveMicSettings.endSensitivity}
                onChange={(event) =>
                  onChangeLiveMicSettings({
                    endSensitivity: event.target.value as LiveMicSettings['endSensitivity'],
                  })
                }
                disabled={alwaysListening}
              >
                <option value="high">High - answer sooner</option>
                <option value="low">Low - wait through pauses</option>
              </select>
            </label>
            <label className="mic-slider">
              <span>Speech padding {liveMicSettings.prefixPaddingMs} ms</span>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={liveMicSettings.prefixPaddingMs}
                onChange={(event) =>
                  onChangeLiveMicSettings({
                    prefixPaddingMs: Number(event.target.value),
                  })
                }
                disabled={alwaysListening}
              />
            </label>
            <label className="mic-slider">
              <span>Silence before answer {liveMicSettings.silenceDurationMs} ms</span>
              <input
                type="range"
                min="250"
                max="2000"
                step="50"
                value={liveMicSettings.silenceDurationMs}
                onChange={(event) =>
                  onChangeLiveMicSettings({
                    silenceDurationMs: Number(event.target.value),
                  })
                }
                disabled={alwaysListening}
              />
            </label>
            {alwaysListening ? (
              <small className="live-status">
                Stop Gemini Live to change mic sensitivity.
              </small>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}

function StatusPill({
  className,
  dotClassName = 'thinking-dot',
  label,
}: {
  className: string
  dotClassName?: string
  label: string
}) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className={dotClassName} />
      {label}
    </div>
  )
}

function StatusGrid({
  liveInputMode,
  liveInputLabel,
  liveToolLabel,
  aiIsProcessing,
  aiProcessingLabel,
}: {
  liveInputMode: LiveInputMode
  liveInputLabel: string
  liveToolLabel: string
  aiIsProcessing: boolean
  aiProcessingLabel: string
}) {
  return (
    <div className="assistant-status-grid" aria-live="polite">
      <span className={`status-chip input-${liveInputMode}`}>
        {liveInputLabel}
      </span>
      {liveToolLabel ? (
        <span className="status-chip tool-active">Tool: {liveToolLabel}</span>
      ) : null}
      {aiIsProcessing ? (
        <span className="status-chip processing-active">{aiProcessingLabel}</span>
      ) : null}
    </div>
  )
}

function DebugVoiceInfo({ info }: { info: VoiceDebugInfo }) {
  return (
    <dl>
      <dt>Model</dt>
      <dd>{info.model}</dd>
      <dt>Transcript</dt>
      <dd>{info.transcript || 'No transcript returned.'}</dd>
      <dt>Reply</dt>
      <dd>{info.reply}</dd>
      <dt>Add product IDs</dt>
      <dd>{info.addProductIds.join(', ') || 'none'}</dd>
      <dt>Visible product IDs</dt>
      <dd>{info.visibleProductIds.join(', ') || 'none'}</dd>
      <dt>Expanded ID</dt>
      <dd>{info.expandedProductId || 'none'}</dd>
      <dt>Flags</dt>
      <dd>
        clear={String(info.clearOutfit)}, tryOn={String(info.tryOnRequested)},
        clarification={String(info.needsClarification)}
      </dd>
      <dt>Question</dt>
      <dd>{info.question || 'none'}</dd>
    </dl>
  )
}

function formatAudioInputLabel(input: MediaDeviceInfo, index: number) {
  if (input.deviceId === 'default') return 'System default microphone'
  if (input.label) return input.label
  return `Microphone ${index + 1}`
}
