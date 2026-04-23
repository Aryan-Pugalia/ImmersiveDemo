import { wordDiff } from '../lib/utils'
import type { Segment, RefSegment } from '../lib/schema'

interface Props {
  segments:    Segment[]
  refSegments: RefSegment[]
  field:       'sourceText' | 'englishText'
}

export default function DiffView({ segments, refSegments, field }: Props) {
  const pairs = segments.map((seg, i) => ({
    seg,
    ref: refSegments[i] ?? null,
  }))

  const totalSegs     = segments.length
  const filledSegs    = segments.filter(s => s[field].trim()).length
  const completeness  = totalSegs > 0 ? Math.round((filledSegs / totalSegs) * 100) : 0
  const emptyTs       = segments.filter(s => s.startMs === 0 && s.endMs === 0).length

  return (
    <div className="flex flex-col gap-4">
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Completeness" value={`${completeness}%`} ok={completeness === 100} />
        <Metric label="Filled Segments" value={`${filledSegs}/${totalSegs}`} ok={filledSegs === totalSegs} />
        <Metric label="Empty Timestamps" value={String(emptyTs)} ok={emptyTs === 0} />
      </div>

      {/* Per-segment diff */}
      <div className="flex flex-col gap-3">
        {pairs.map(({ seg, ref }, i) => {
          const ann    = field === 'sourceText' ? seg.sourceText : seg.englishText
          const refTxt = field === 'sourceText' ? (ref?.text ?? '') : (ref?.textEn ?? '')

          if (!refTxt) {
            return (
              <div key={seg.segmentId} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Seg {i + 1} — no reference</div>
                <p className="text-sm text-slate-300">{ann || <em className="text-slate-600">empty</em>}</p>
              </div>
            )
          }

          const tokens = wordDiff(refTxt, ann)
          const hasChanges = tokens.some(t => t.type !== 'equal')

          return (
            <div key={seg.segmentId} className={`rounded-lg border p-3 ${
              hasChanges ? 'border-amber-700 bg-amber-950/20' : 'border-green-800 bg-green-950/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-500">Seg {i + 1}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${hasChanges ? 'bg-amber-900 text-amber-300' : 'bg-green-900 text-green-300'}`}>
                  {hasChanges ? 'Differences' : 'Match'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-1">Reference:</div>
              <p className="text-sm text-slate-400 italic mb-2">{refTxt}</p>
              <div className="text-xs text-slate-400 mb-1">Annotated:</div>
              <p className="text-sm leading-relaxed">
                {tokens.map((t, ti) => (
                  <span key={ti} className={
                    t.type === 'insert' ? 'bg-green-900/60 text-green-300 rounded px-0.5' :
                    t.type === 'delete' ? 'bg-red-900/60 text-red-300 line-through rounded px-0.5' :
                    'text-slate-200'
                  }>
                    {t.text}{' '}
                  </span>
                ))}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${ok ? 'border-green-800 bg-green-950/20' : 'border-slate-700 bg-slate-900'}`}>
      <div className={`text-xl font-bold ${ok ? 'text-green-400' : 'text-amber-400'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
