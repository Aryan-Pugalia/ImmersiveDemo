import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import manifestData from '../../public/manifest.json'
import type { TaskManifest, LanguageCode, TaskType } from '../lib/schema'
import { loadAnnotation } from '../lib/storage'
import { LANG_FLAGS, STATUS_COLORS, STATUS_LABELS, formatDuration } from '../lib/utils'
import { useAnnotationStore } from '../store/annotationStore'
import { Filter, BarChart3, Clock, Tag, ChevronRight } from 'lucide-react'

const MANIFESTS = manifestData as TaskManifest[]

const LANG_OPTIONS: { value: '' | LanguageCode; label: string }[] = [
  { value: '', label: 'All Languages' },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'pt', label: '🇧🇷 Portuguese' },
]

const TYPE_OPTIONS: { value: '' | TaskType; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'transcribe', label: 'Transcription only' },
  { value: 'translate',  label: 'Translation only' },
  { value: 'both',       label: 'Transcription + Translation' },
]

const STATUS_OPTIONS = [
  { value: '',             label: 'All Statuses' },
  { value: 'not_started',  label: 'Not Started' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'submitted',    label: 'Submitted' },
  { value: 'returned',     label: 'Returned' },
  { value: 'approved',     label: 'Approved' },
]

export default function Queue() {
  const nav       = useNavigate()
  const { initTask } = useAnnotationStore()

  const [langFilter,   setLangFilter]   = useState<'' | LanguageCode>('')
  const [typeFilter,   setTypeFilter]   = useState<'' | TaskType>('')
  const [statusFilter, setStatusFilter] = useState('')

  // Compute live statuses from localStorage
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  useEffect(() => {
    const map: Record<string, string> = {}
    MANIFESTS.forEach(m => {
      const ann = loadAnnotation(m.id)
      map[m.id] = ann?.status ?? 'not_started'
    })
    setStatuses(map)
  }, [])

  const filtered = MANIFESTS.filter(m => {
    if (langFilter   && m.language !== langFilter)                    return false
    if (typeFilter   && m.taskType !== typeFilter)                    return false
    if (statusFilter && (statuses[m.id] ?? 'not_started') !== statusFilter) return false
    return true
  })

  // Dashboard counts
  const counts = {
    total:       MANIFESTS.length,
    not_started: MANIFESTS.filter(m => (statuses[m.id] ?? 'not_started') === 'not_started').length,
    in_progress: MANIFESTS.filter(m => statuses[m.id] === 'in_progress').length,
    submitted:   MANIFESTS.filter(m => statuses[m.id] === 'submitted').length,
    approved:    MANIFESTS.filter(m => statuses[m.id] === 'approved').length,
    returned:    MANIFESTS.filter(m => statuses[m.id] === 'returned').length,
  }

  const handleOpen = (m: TaskManifest) => {
    initTask(m)
    nav('/annotate')
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Task Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">Audio Transcription + Translation · {MANIFESTS.length} tasks</p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <DashCard label="Total"       value={counts.total}       color="text-slate-300" bg="bg-slate-800" />
        <DashCard label="Not Started" value={counts.not_started} color="text-slate-400" bg="bg-slate-800" />
        <DashCard label="In Progress" value={counts.in_progress} color="text-blue-400"  bg="bg-blue-950/40" />
        <DashCard label="Submitted"   value={counts.submitted}   color="text-yellow-400"bg="bg-yellow-950/40" />
        <DashCard label="Approved"    value={counts.approved}    color="text-green-400" bg="bg-green-950/40" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-slate-500" />
        <Select value={langFilter}   onChange={v => setLangFilter(v as LanguageCode | '')}   options={LANG_OPTIONS} />
        <Select value={typeFilter}   onChange={v => setTypeFilter(v as TaskType | '')}        options={TYPE_OPTIONS} />
        <Select value={statusFilter} onChange={v => setStatusFilter(v)}                       options={STATUS_OPTIONS} />
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} tasks shown</span>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {filtered.map(m => {
          const status = statuses[m.id] ?? 'not_started'
          const ann    = loadAnnotation(m.id)
          const segs   = ann?.segments.length ?? (m.reference?.transcriptSegments.length ?? 0)

          return (
            <div
              key={m.id}
              onClick={() => handleOpen(m)}
              className="group flex items-center gap-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-xl px-5 py-4 cursor-pointer transition-all"
            >
              {/* Language */}
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                {LANG_FLAGS[m.language]}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-white">{m.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{m.languageLabel} → English</span>
                  <span className="flex items-center gap-1"><Clock size={10} />{formatDuration(m.durationSec)}</span>
                  <span className="flex items-center gap-1"><BarChart3 size={10} />{segs} segments</span>
                  <span className="flex items-center gap-1"><Tag size={10} />{m.domainTag}</span>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  m.difficulty === 'easy'
                    ? 'border-green-700 text-green-400 bg-green-950/30'
                    : 'border-amber-700 text-amber-400 bg-amber-950/30'
                }`}>
                  {m.difficulty}
                </span>
                <span className="text-xs text-slate-600 bg-slate-800 rounded px-2 py-0.5">
                  {m.taskType === 'both' ? 'Transcribe + Translate' : m.taskType}
                </span>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No tasks match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}

function DashCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-lg p-3 text-center border border-slate-800`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
