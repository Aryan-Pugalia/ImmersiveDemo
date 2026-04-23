import { useState } from 'react'
import { X, Download, Copy, Check } from 'lucide-react'
import { useAnnotationStore } from '../store/annotationStore'
import { escape } from '../lib/utils'

interface Props { onClose: () => void }

export default function ExportModal({ onClose }: Props) {
  const { annotation, manifest } = useAnnotationStore()
  const [format, setFormat]     = useState<'json' | 'csv'>('json')
  const [copied, setCopied]     = useState(false)

  if (!annotation || !manifest) return null

  // ── Build outputs ──────────────────────────────────────────────────────────
  const jsonOutput = JSON.stringify(annotation, null, 2)

  const csvRows = [
    ['segmentId', 'startMs', 'endMs', 'speaker', 'nonSpeech', 'sourceText', 'englishText',
     'lowConfidence', 'needsSecondPass', 'audioIssue', 'commentsCount'].join(','),
    ...annotation.segments.map(s => [
      escape(s.segmentId),
      s.startMs, s.endMs,
      escape(s.speaker),
      escape(s.nonSpeech),
      escape(s.sourceText),
      escape(s.englishText),
      s.flags.lowConfidence,
      s.flags.needsSecondPass,
      escape(s.flags.audioIssue),
      s.comments.length,
    ].join(',')),
  ]
  const csvOutput = csvRows.join('\n')

  const preview  = format === 'json' ? jsonOutput : csvOutput
  const filename = `${annotation.taskId}_annotation.${format}`

  const handleDownload = () => {
    const blob = new Blob([preview], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const schemaSnippet = `{
  "project": "audio_transcribe_translate_demo",
  "taskId":  "...",
  "sourceLanguage": "zh|ar|hi|ko|fr|ja",
  "status":  "draft|submitted|returned|approved",
  "segments": [{
    "segmentId":  "seg_001",
    "startMs":    1200,
    "endMs":      5200,
    "speaker":    "S1|S2|OVERLAP|UNK",
    "nonSpeech":  "NONE|NOISE|MUSIC|SILENCE|CROSSTALK",
    "sourceText": "…",
    "englishText":"…",
    "flags": {
      "lowConfidence":   boolean,
      "needsSecondPass": boolean,
      "audioIssue": "NONE|CLIPPING|BACKGROUND_NOISE|DROP_OUT|DISTORTION"
    },
    "comments": [{ "by": "annotator|reviewer", "text": "…", "at": "ISO" }]
  }],
  "taskLevel": {
    "overallAudioQuality": "good|ok|bad",
    "piiPresent":          "none|possible|confirmed",
    "reviewOutcome":       "pending|approved|needs_rework"
  }
}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">Export Annotations</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">
          {/* Task info */}
          <div className="flex gap-4 text-xs text-slate-400">
            <span>Task: <strong className="text-slate-200">{manifest.title}</strong></span>
            <span>Language: <strong className="text-slate-200">{manifest.languageLabel}</strong></span>
            <span>Segments: <strong className="text-slate-200">{annotation.segments.length}</strong></span>
            <span>Status: <strong className="text-slate-200">{annotation.status}</strong></span>
          </div>

          {/* Format selector */}
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('json')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                format === 'json' ? 'bg-brand-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                format === 'csv' ? 'bg-brand-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              CSV
            </button>
          </div>

          {/* Preview */}
          <div className="relative">
            <div className="text-xs text-slate-500 mb-1.5">Preview — {filename}</div>
            <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-auto max-h-56 font-mono">
              {preview.slice(0, 3000)}{preview.length > 3000 ? '\n\n…(truncated for preview)' : ''}
            </pre>
          </div>

          {/* Schema */}
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
              Output Schema Reference ▶
            </summary>
            <pre className="mt-2 bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-400 font-mono overflow-auto max-h-48">
              {schemaSnippet}
            </pre>
          </details>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
          >
            <Download size={15} /> Download {filename}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
          >
            {copied ? <><Check size={15} className="text-green-400" /> Copied!</> : <><Copy size={15} /> Copy</>}
          </button>
          <span className="ml-auto text-xs text-slate-500">All data is stored locally — no server upload</span>
        </div>
      </div>
    </div>
  )
}
