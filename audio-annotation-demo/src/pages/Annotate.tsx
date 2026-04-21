import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnnotationStore } from '../store/annotationStore'
import WaveformPlayer, { type WaveformHandle } from '../components/WaveformPlayer'
import SegmentTable from '../components/SegmentTable'
import TranscriptEditor from '../components/TranscriptEditor'
import TranslationEditor from '../components/TranslationEditor'
import QCPanel from '../components/QCPanel'
import ExportModal from '../components/ExportModal'
import ShortcutsPanel from '../components/ShortcutsPanel'
import { LANG_FLAGS } from '../lib/utils'
import { BookOpen, Send, Save, Download, ArrowLeft } from 'lucide-react'

type RightTab = 'transcript' | 'translation' | 'guidelines' | 'qc'

const GUIDELINES = `
**Transcription Rules**
• Represent speech exactly as heard — no corrections.
• Use [inaudible] for unintelligible speech.
• Keep punctuation minimal; use commas and periods only.
• Numbers: write as digits where natural ("3 items", not "three items").
• Proper nouns: transcribe as heard, do not translate in source field.
• Speaker changes: create a new segment; do not combine turns.
• Non-speech sounds: mark with the Non-Speech dropdown (Noise/Music/Silence/Crosstalk).

**Translation Rules**
• Faithful meaning over literal word-for-word.
• Keep proper names as heard (do not anglicize).
• Do not add or omit content.
• [inaudible] in source → [inaudible] in translation.
• Maintain the same formality register as the source.

**Quality Flags**
• Low Confidence: you're uncertain about a word or phrase.
• 2nd Pass: segment requires a second annotator to verify.
• Audio Issue: clipping, dropout, background noise, or distortion.

**Timing**
• Segment start/end should be tight around speech onset and offset.
• Allow ~100ms padding before/after.
`.trim()

export default function Annotate() {
  const nav = useNavigate()
  const {
    manifest, annotation, role,
    selectedSegmentId, setSelectedSegment,
    addSegment, updateSegmentTimes, splitSegmentAtMs, deleteSegment,
    updateSegmentSpeaker, submitTask, saveDraft,
  } = useAnnotationStore()

  const waveRef   = useRef<WaveformHandle>(null)
  const [currentMs, setCurrentMs] = useState(0)
  const [rightTab, setRightTab]   = useState<RightTab>('transcript')
  const [showExport, setShowExport] = useState(false)

  // Redirect if no task loaded
  useEffect(() => {
    if (!manifest) nav('/queue')
  }, [manifest])

  // Update currentMs from waveform
  const updateCurrentMs = useCallback(() => {
    if (waveRef.current) setCurrentMs(waveRef.current.getCurrentMs())
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ms = waveRef.current?.getCurrentMs() ?? 0

      switch (e.key) {
        case ' ':
          e.preventDefault()
          // WaveSurfer handles play/pause via its own listener on the container
          // We trigger via the player button click
          document.querySelector<HTMLButtonElement>('[aria-label="Play"], [aria-label="Pause"]')?.click()
          break
        case 'a': case 'A':
          e.preventDefault()
          addSegment(ms, ms + 2000)
          break
        case 's': case 'S':
          if (selectedSegmentId) { e.preventDefault(); splitSegmentAtMs(selectedSegmentId, ms) }
          break
        case 'd': case 'D':
          if (selectedSegmentId) { e.preventDefault(); deleteSegment(selectedSegmentId) }
          break
        case 'j': case 'J':
          e.preventDefault()
          waveRef.current?.seekToMs(Math.max(0, ms - 2000))
          break
        case 'k': case 'K':
          e.preventDefault()
          document.querySelector<HTMLButtonElement>('[aria-label="Play"], [aria-label="Pause"]')?.click()
          break
        case 'l': case 'L':
          e.preventDefault()
          waveRef.current?.seekToMs(ms + 2000)
          break
        case '1':
          if (selectedSegmentId) { e.preventDefault(); updateSegmentSpeaker(selectedSegmentId, 'S1') }
          break
        case '2':
          if (selectedSegmentId) { e.preventDefault(); updateSegmentSpeaker(selectedSegmentId, 'S2') }
          break
        case '3':
          if (selectedSegmentId) { e.preventDefault(); updateSegmentSpeaker(selectedSegmentId, 'OVERLAP') }
          break
        case '4':
          if (selectedSegmentId) { e.preventDefault(); updateSegmentSpeaker(selectedSegmentId, 'UNK') }
          break
        case 'Escape':
          setSelectedSegment(null)
          break
        case '?':
          e.preventDefault()
          document.querySelector<HTMLButtonElement>('[aria-label="Keyboard shortcuts"]')?.click()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedSegmentId, addSegment, splitSegmentAtMs, deleteSegment, updateSegmentSpeaker, setSelectedSegment])

  if (!manifest || !annotation) return null

  const isReviewer = role === 'reviewer'
  const readOnly   = isReviewer

  const seekToMs = (ms: number) => {
    waveRef.current?.seekToMs(ms)
    setCurrentMs(ms)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
        <button
          onClick={() => nav('/queue')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={12} /> Queue
        </button>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-sm font-semibold text-white">
          {LANG_FLAGS[manifest.language]} {manifest.title}
        </span>
        <span className="text-xs text-slate-500">·</span>
        <span className="text-xs text-slate-500">{manifest.languageLabel} → English</span>
        <div className="flex-1" />
        <ShortcutsPanel />
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
        >
          <Download size={12} /> Export
        </button>
        {!isReviewer && (
          <>
            <button
              onClick={saveDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
            >
              <Save size={12} /> Save Draft
            </button>
            <button
              onClick={() => { submitTask(); nav('/review') }}
              disabled={annotation.segments.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-700 hover:bg-brand-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              <Send size={12} /> Submit to Review
            </button>
          </>
        )}
        {isReviewer && (
          <button
            onClick={() => setRightTab('qc')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-800 hover:bg-green-700 text-green-100 text-xs font-medium transition-colors"
          >
            Open QC Panel
          </button>
        )}
      </div>

      {/* Main 2-col layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Waveform + Segment Table */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-slate-800 overflow-hidden">
          {/* Waveform */}
          <div className="p-4 border-b border-slate-800 shrink-0">
            <WaveformPlayer
              ref={waveRef}
              audioUrl={manifest.audioPath}
              durationSec={manifest.durationSec}
              segments={annotation.segments}
              selectedId={selectedSegmentId}
              onRegionCreated={(start, end) => !readOnly && addSegment(start, end)}
              onRegionUpdated={(id, start, end) => !readOnly && updateSegmentTimes(id, start, end)}
              onSegmentSelect={id => setSelectedSegment(id)}
              readOnly={readOnly}
            />
          </div>

          {/* Segment Table */}
          <div className="flex-1 overflow-y-auto p-4">
            <SegmentTable
              onSeek={seekToMs}
              currentMs={currentMs}
              readOnly={readOnly}
            />
          </div>
        </div>

        {/* RIGHT: Tabs */}
        <div className="w-96 flex flex-col shrink-0 overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
            {[
              { id: 'transcript',   label: 'Transcript' },
              { id: 'translation',  label: 'Translation' },
              { id: 'guidelines',   label: 'Guidelines' },
              { id: 'qc',           label: 'QC' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id as RightTab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  rightTab === tab.id
                    ? 'border-brand-500 text-brand-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === 'transcript' && <TranscriptEditor onSeek={seekToMs} />}
            {rightTab === 'translation' && <TranslationEditor onSeek={seekToMs} />}
            {rightTab === 'guidelines' && (
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-3 text-slate-400">
                  <BookOpen size={14} /> <span className="font-semibold uppercase tracking-wide">Annotation Guidelines</span>
                </div>
                {GUIDELINES}
              </div>
            )}
            {rightTab === 'qc' && <QCPanel />}
          </div>
        </div>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  )
}
