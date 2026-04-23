import { useAnnotationStore } from '../store/annotationStore'
import { isRTL, SPEAKER_COLORS, msToTimecode } from '../lib/utils'

interface Props {
  onSeek: (ms: number) => void
}

export default function TranscriptEditor({ onSeek }: Props) {
  const { annotation, manifest, selectedSegmentId, setSelectedSegment, updateSegmentText } = useAnnotationStore()
  if (!annotation || !manifest) return null

  const rtl = isRTL(manifest.language)

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          {manifest.languageLabel} Transcript
        </span>
        {rtl && (
          <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded">RTL</span>
        )}
      </div>

      {annotation.segments.length === 0 && (
        <p className="text-slate-500 text-xs text-center py-6">
          Add segments on the waveform to begin transcribing.
        </p>
      )}

      {annotation.segments.map(seg => {
        const isActive = seg.segmentId === selectedSegmentId
        const color    = SPEAKER_COLORS[seg.speaker]

        return (
          <div
            key={seg.segmentId}
            className={`rounded-lg border transition-colors ${
              isActive ? 'border-brand-500 bg-brand-950/30' : 'border-slate-700 bg-slate-900'
            }`}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b border-slate-800"
              onClick={() => { setSelectedSegment(seg.segmentId); onSeek(seg.startMs) }}
            >
              <span className="text-xs font-bold rounded px-1.5 py-0.5"
                    style={{ color, background: color + '22' }}>
                {seg.speaker}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {msToTimecode(seg.startMs)} → {msToTimecode(seg.endMs)}
              </span>
              {seg.flags.lowConfidence && (
                <span className="ml-auto text-xs text-amber-500">⚠ low conf</span>
              )}
              {seg.nonSpeech !== 'NONE' && (
                <span className="text-xs text-orange-400">[{seg.nonSpeech}]</span>
              )}
            </div>
            <div className="px-3 py-2">
              <textarea
                dir={rtl ? 'rtl' : 'ltr'}
                value={seg.sourceText}
                onChange={e => updateSegmentText(seg.segmentId, 'sourceText', e.target.value)}
                onClick={() => { setSelectedSegment(seg.segmentId); onSeek(seg.startMs) }}
                rows={2}
                className="w-full bg-transparent text-sm text-slate-200 resize-none focus:outline-none placeholder-slate-600"
                placeholder={`Transcribe ${manifest.languageLabel} here…`}
                style={{ fontFamily: rtl ? 'Noto Sans Arabic, Segoe UI, sans-serif' : undefined }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
