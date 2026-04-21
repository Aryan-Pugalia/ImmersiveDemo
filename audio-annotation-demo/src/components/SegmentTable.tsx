import { useAnnotationStore } from '../store/annotationStore'
import { msToTimecode, SPEAKER_COLORS } from '../lib/utils'
import type { Speaker, NonSpeech, AudioIssue } from '../lib/schema'
import { Trash2, SplitSquareHorizontal, Merge, Plus, AlertTriangle, MessageSquare } from 'lucide-react'

interface Props {
  onSeek:      (ms: number) => void
  currentMs:   number
  readOnly?:   boolean
}

const SPEAKERS: Speaker[]   = ['S1', 'S2', 'OVERLAP', 'UNK']
const NON_SPEECH: NonSpeech[] = ['NONE', 'NOISE', 'MUSIC', 'SILENCE', 'CROSSTALK']
const AUDIO_ISSUES: AudioIssue[] = ['NONE', 'CLIPPING', 'BACKGROUND_NOISE', 'DROP_OUT', 'DISTORTION']

export default function SegmentTable({ onSeek, currentMs, readOnly = false }: Props) {
  const {
    annotation, selectedSegmentId, setSelectedSegment,
    updateSegmentSpeaker, updateSegmentNonSpeech, updateSegmentText,
    updateSegmentFlag, updateSegmentAudioIssue,
    deleteSegment, splitSegmentAtMs, mergeSegments, addSegment,
    addSegmentComment, role,
  } = useAnnotationStore()

  if (!annotation) return null
  const { segments } = annotation

  const handleRowClick = (id: string, startMs: number) => {
    setSelectedSegment(id)
    onSeek(startMs)
  }

  const handleAddComment = (id: string) => {
    const text = window.prompt('Add comment:')
    if (text?.trim()) addSegmentComment(id, role, text.trim())
  }

  const handleMergeWithNext = (idx: number) => {
    if (idx < segments.length - 1) {
      mergeSegments(segments[idx].segmentId, segments[idx + 1].segmentId)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => addSegment(currentMs, currentMs + 2000)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-700 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
            title="Add segment at playhead (A)"
          >
            <Plus size={12} /> Add Segment
          </button>
          {selectedSegmentId && (
            <>
              <button
                onClick={() => splitSegmentAtMs(selectedSegmentId, currentMs)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
                title="Split at playhead (S)"
              >
                <SplitSquareHorizontal size={12} /> Split at Playhead
              </button>
              <button
                onClick={() => deleteSegment(selectedSegmentId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-900 hover:bg-red-800 text-red-200 text-xs font-medium transition-colors"
                title="Delete selected (D)"
              >
                <Trash2 size={12} /> Delete
              </button>
            </>
          )}
          <span className="text-xs text-slate-500 ml-auto">{segments.length} segments</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left w-12">#</th>
              <th className="px-2 py-2 text-left w-28">Start / End</th>
              <th className="px-2 py-2 text-left w-24">Speaker</th>
              <th className="px-2 py-2 text-left w-24">Non-Speech</th>
              <th className="px-2 py-2 text-left">Source Text</th>
              <th className="px-2 py-2 text-left">English Text</th>
              <th className="px-2 py-2 text-left w-36">Audio Issue</th>
              <th className="px-2 py-2 text-left w-20">Flags</th>
              <th className="px-2 py-2 text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500">
                  No segments yet. Drag on the waveform or click "Add Segment".
                </td>
              </tr>
            )}
            {segments.map((seg, idx) => {
              const isActive    = seg.segmentId === selectedSegmentId
              const isPlaying   = currentMs >= seg.startMs && currentMs <= seg.endMs
              const speakerColor = SPEAKER_COLORS[seg.speaker] || '#94a3b8'

              return (
                <tr
                  key={seg.segmentId}
                  onClick={() => handleRowClick(seg.segmentId, seg.startMs)}
                  className={`border-t border-slate-800 cursor-pointer transition-colors ${
                    isActive  ? 'bg-brand-900/40' :
                    isPlaying ? 'bg-slate-800/60'  : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* # */}
                  <td className="px-2 py-2 text-slate-500 font-mono">{idx + 1}</td>

                  {/* Times */}
                  <td className="px-2 py-2 font-mono text-slate-400">
                    <div>{msToTimecode(seg.startMs)}</div>
                    <div>{msToTimecode(seg.endMs)}</div>
                  </td>

                  {/* Speaker */}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                            style={{ color: speakerColor, background: speakerColor + '22' }}>
                        {seg.speaker}
                      </span>
                    ) : (
                      <select
                        value={seg.speaker}
                        onChange={e => updateSegmentSpeaker(seg.segmentId, e.target.value as Speaker)}
                        className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs w-full"
                        style={{ color: speakerColor }}
                      >
                        {SPEAKERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>

                  {/* Non-speech */}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="text-slate-400">{seg.nonSpeech !== 'NONE' ? seg.nonSpeech : '—'}</span>
                    ) : (
                      <select
                        value={seg.nonSpeech}
                        onChange={e => updateSegmentNonSpeech(seg.segmentId, e.target.value as NonSpeech)}
                        className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs w-full text-slate-300"
                      >
                        {NON_SPEECH.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>

                  {/* Source Text */}
                  <td className="px-2 py-2 min-w-[160px]" onClick={e => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="text-slate-200 whitespace-pre-wrap">{seg.sourceText || <em className="text-slate-600">empty</em>}</span>
                    ) : (
                      <textarea
                        value={seg.sourceText}
                        onChange={e => updateSegmentText(seg.segmentId, 'sourceText', e.target.value)}
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs resize-none focus:outline-none focus:border-brand-500"
                        placeholder="Source text…"
                      />
                    )}
                  </td>

                  {/* English Text */}
                  <td className="px-2 py-2 min-w-[160px]" onClick={e => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="text-slate-200 whitespace-pre-wrap">{seg.englishText || <em className="text-slate-600">empty</em>}</span>
                    ) : (
                      <textarea
                        value={seg.englishText}
                        onChange={e => updateSegmentText(seg.segmentId, 'englishText', e.target.value)}
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs resize-none focus:outline-none focus:border-brand-500"
                        placeholder="English translation…"
                      />
                    )}
                  </td>

                  {/* Audio Issue */}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    {readOnly ? (
                      <span className={`text-xs ${seg.flags.audioIssue !== 'NONE' ? 'text-amber-400' : 'text-slate-600'}`}>
                        {seg.flags.audioIssue}
                      </span>
                    ) : (
                      <select
                        value={seg.flags.audioIssue}
                        onChange={e => updateSegmentAudioIssue(seg.segmentId, e.target.value as AudioIssue)}
                        className={`bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs w-full ${
                          seg.flags.audioIssue !== 'NONE' ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {AUDIO_ISSUES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>

                  {/* Flags */}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={seg.flags.lowConfidence}
                          disabled={readOnly}
                          onChange={e => updateSegmentFlag(seg.segmentId, 'lowConfidence', e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span className={`text-xs ${seg.flags.lowConfidence ? 'text-amber-400' : 'text-slate-500'}`}>Low conf</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={seg.flags.needsSecondPass}
                          disabled={readOnly}
                          onChange={e => updateSegmentFlag(seg.segmentId, 'needsSecondPass', e.target.checked)}
                          className="accent-red-500"
                        />
                        <span className={`text-xs ${seg.flags.needsSecondPass ? 'text-red-400' : 'text-slate-500'}`}>2nd pass</span>
                      </label>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => handleAddComment(seg.segmentId)}
                        title="Add comment"
                        className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors relative"
                      >
                        <MessageSquare size={12} />
                        {seg.comments.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-brand-500 rounded-full text-white text-[8px] flex items-center justify-center">
                            {seg.comments.length}
                          </span>
                        )}
                      </button>
                      {!readOnly && idx < segments.length - 1 && (
                        <button
                          onClick={() => handleMergeWithNext(idx)}
                          title="Merge with next"
                          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <Merge size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Comments panel for selected segment */}
      {selectedSegmentId && (() => {
        const seg = segments.find(s => s.segmentId === selectedSegmentId)
        if (!seg || seg.comments.length === 0) return null
        return (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Comments on {seg.segmentId}
            </div>
            <div className="flex flex-col gap-1.5">
              {seg.comments.map((c, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className={`font-medium ${c.by === 'reviewer' ? 'text-green-400' : 'text-brand-400'}`}>
                    {c.by}:
                  </span>
                  <span className="text-slate-300 flex-1">{c.text}</span>
                  <span className="text-slate-600 shrink-0">
                    {new Date(c.at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
