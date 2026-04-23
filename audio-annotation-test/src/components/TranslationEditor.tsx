import { useAnnotationStore } from '../store/annotationStore'
import { SPEAKER_COLORS, msToTimecode } from '../lib/utils'

// Simple demo glossary hints per language
const GLOSSARY: Record<string, Record<string, string>> = {
  zh: { '拿铁': 'latte', '微信': 'WeChat', '高速': 'expressway' },
  ar: { 'موعد': 'appointment', 'ريال': 'riyal', 'شكراً': 'thank you' },
  hi: { 'नमस्ते': 'hello', 'ट्रेन': 'train', 'एक्सप्रेस': 'express' },
  ko: { '예약': 'reservation', '배송': 'delivery', '감사합니다': 'thank you' },
  fr: { 'bonjour': 'hello/good morning', 'réservation': 'reservation', 'petit-déjeuner': 'breakfast' },
  ja: { 'いらっしゃいませ': 'welcome', 'ありがとう': 'thank you', '合計': 'total' },
}

interface Props {
  onSeek: (ms: number) => void
}

export default function TranslationEditor({ onSeek }: Props) {
  const { annotation, manifest, selectedSegmentId, setSelectedSegment, updateSegmentText } = useAnnotationStore()
  if (!annotation || !manifest) return null

  const glossary = GLOSSARY[manifest.language] ?? {}
  const glossaryEntries = Object.entries(glossary)

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          English Translation
        </span>
      </div>

      {/* Glossary hints */}
      {glossaryEntries.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2">
          <div className="text-xs font-medium text-slate-500 mb-1.5">Glossary hints</div>
          <div className="flex flex-wrap gap-2">
            {glossaryEntries.map(([src, en]) => (
              <span key={src} className="text-xs bg-slate-800 rounded px-2 py-0.5 text-slate-300">
                <span className="text-slate-500">{src}</span> → <span className="text-brand-300">{en}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {annotation.segments.length === 0 && (
        <p className="text-slate-500 text-xs text-center py-6">
          Add segments to begin translating.
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
                {msToTimecode(seg.startMs)}
              </span>
              {seg.sourceText && (
                <span className="text-xs text-slate-500 truncate max-w-[140px] italic">
                  "{seg.sourceText.slice(0, 30)}{seg.sourceText.length > 30 ? '…' : ''}"
                </span>
              )}
            </div>
            <div className="px-3 py-2">
              <textarea
                value={seg.englishText}
                onChange={e => updateSegmentText(seg.segmentId, 'englishText', e.target.value)}
                onClick={() => { setSelectedSegment(seg.segmentId); onSeek(seg.startMs) }}
                rows={2}
                className="w-full bg-transparent text-sm text-slate-200 resize-none focus:outline-none placeholder-slate-600"
                placeholder="English translation…"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
