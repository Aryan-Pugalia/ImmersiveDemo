import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnnotationStore } from '../store/annotationStore'
import WaveformPlayer from '../components/WaveformPlayer'
import SegmentTable from '../components/SegmentTable'
import DiffView from '../components/DiffView'
import QCPanel from '../components/QCPanel'
import ExportModal from '../components/ExportModal'
import { LANG_FLAGS } from '../lib/utils'
import { ArrowLeft, Download, Shuffle } from 'lucide-react'

type ReviewTab = 'segments' | 'diff_source' | 'diff_translation' | 'qc'

export default function Review() {
  const nav = useNavigate()
  const { manifest, annotation, setSelectedSegment } = useAnnotationStore()
  const [currentMs,   setCurrentMs]   = useState(0)
  const [activeTab,   setActiveTab]   = useState<ReviewTab>('segments')
  const [showExport,  setShowExport]  = useState(false)
  const [editMode,    setEditMode]    = useState(false)

  if (!manifest || !annotation) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        No task loaded. <button className="ml-2 underline" onClick={() => nav('/queue')}>Go to Queue</button>
      </div>
    )
  }

  const refSegs   = manifest.reference?.transcriptSegments  ?? []
  const refTrans  = manifest.reference?.translationSegments ?? []

  const handleSpotCheck = () => {
    if (annotation.segments.length === 0) return
    const idx = Math.floor(Math.random() * annotation.segments.length)
    const seg = annotation.segments[idx]
    setSelectedSegment(seg.segmentId)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 flex-wrap">
        <button
          onClick={() => nav('/queue')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft size={12} /> Queue
        </button>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-sm font-semibold text-white">
          {LANG_FLAGS[manifest.language]} {manifest.title}
        </span>
        <span className="text-xs text-slate-500">· Reviewer QC</span>

        <div className="flex-1" />

        <button
          onClick={handleSpotCheck}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
        >
          <Shuffle size={12} /> Spot Check
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
          <div
            onClick={() => setEditMode(e => !e)}
            className={`w-8 h-4 rounded-full transition-colors relative ${editMode ? 'bg-brand-600' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${editMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          Edit Mode
        </label>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: waveform */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 shrink-0">
            <WaveformPlayer
              audioUrl={manifest.audioPath}
              durationSec={manifest.durationSec}
              segments={annotation.segments}
              selectedId={null}
              onRegionCreated={() => {}}
              onRegionUpdated={() => {}}
              onSegmentSelect={id => setSelectedSegment(id)}
              readOnly={!editMode}
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
            {[
              { id: 'segments',        label: 'Segments' },
              { id: 'diff_source',     label: 'Diff (Source)' },
              { id: 'diff_translation',label: 'Diff (English)' },
              { id: 'qc',              label: 'QC Panel' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as ReviewTab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === t.id
                    ? 'border-green-500 text-green-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'segments' && (
              <SegmentTable
                onSeek={ms => setCurrentMs(ms)}
                currentMs={currentMs}
                readOnly={!editMode}
              />
            )}
            {activeTab === 'diff_source' && (
              <DiffView segments={annotation.segments} refSegments={refSegs}   field="sourceText" />
            )}
            {activeTab === 'diff_translation' && (
              <DiffView segments={annotation.segments} refSegments={refTrans}  field="englishText" />
            )}
            {activeTab === 'qc' && <QCPanel />}
          </div>
        </div>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  )
}
