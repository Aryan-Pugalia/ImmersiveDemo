import { useAnnotationStore } from '../store/annotationStore'
import type { AudioQuality, PIILevel } from '../lib/schema'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'

export default function QCPanel() {
  const {
    annotation, manifest, role,
    setAudioQuality, setPIILevel, setReviewNotes,
    approveTask, returnTask,
  } = useAnnotationStore()

  if (!annotation || !manifest) return null

  const isReviewer       = role === 'reviewer'
  const canAct           = isReviewer && annotation.status === 'submitted'
  const alreadyReviewed  = ['approved', 'returned'].includes(annotation.status)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-700">
        Task-level Quality Control
      </div>

      {/* Audio quality */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Overall Audio Quality</label>
        <div className="flex gap-2">
          {(['good', 'ok', 'bad'] as AudioQuality[]).map(q => (
            <button
              key={q}
              disabled={!isReviewer && annotation.status === 'approved'}
              onClick={() => setAudioQuality(q)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                annotation.taskLevel.overallAudioQuality === q
                  ? q === 'good' ? 'bg-green-800 text-green-200'
                  : q === 'ok'   ? 'bg-yellow-800 text-yellow-200'
                  :                'bg-red-900 text-red-200'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* PII */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">PII Present</label>
        <div className="flex gap-2">
          {(['none', 'possible', 'confirmed'] as PIILevel[]).map(p => (
            <button
              key={p}
              onClick={() => setPIILevel(p)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                annotation.taskLevel.piiPresent === p
                  ? p === 'none'      ? 'bg-green-900 text-green-300'
                  : p === 'possible'  ? 'bg-yellow-900 text-yellow-300'
                  :                     'bg-red-900 text-red-300'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Review notes */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">
          <MessageSquare size={12} className="inline mr-1" />
          Review Notes
        </label>
        <textarea
          value={annotation.reviewNotes || ''}
          onChange={e => setReviewNotes(e.target.value)}
          rows={3}
          placeholder="Add reviewer notes, e.g. 'Segment 3 translation is too literal'…"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-brand-500 placeholder-slate-600"
        />
      </div>

      {/* Review outcome */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">Review Outcome</div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${
            annotation.taskLevel.reviewOutcome === 'approved'     ? 'text-green-400' :
            annotation.taskLevel.reviewOutcome === 'needs_rework' ? 'text-red-400'   : 'text-slate-400'
          }`}>
            {annotation.taskLevel.reviewOutcome.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={approveTask}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-800 hover:bg-green-700 text-green-100 text-sm font-semibold transition-colors"
          >
            <CheckCircle size={16} /> Approve
          </button>
          <button
            onClick={returnTask}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-900 hover:bg-red-800 text-red-100 text-sm font-semibold transition-colors"
          >
            <XCircle size={16} /> Return for Rework
          </button>
        </div>
      )}

      {alreadyReviewed && (
        <div className={`text-center py-2 rounded-lg text-sm font-medium ${
          annotation.status === 'approved' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
        }`}>
          {annotation.status === 'approved' ? '✓ Task approved' : '↩ Returned for rework'}
        </div>
      )}

      {!isReviewer && (
        <p className="text-xs text-slate-500 text-center">
          Switch to Reviewer role to approve or return this task.
        </p>
      )}

      {isReviewer && annotation.status !== 'submitted' && !alreadyReviewed && (
        <p className="text-xs text-slate-500 text-center">
          Task must be submitted by annotator before review.
        </p>
      )}
    </div>
  )
}
