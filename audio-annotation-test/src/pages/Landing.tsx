import { useNavigate } from 'react-router-dom'
import { Mic2, Languages, ArrowRight, CheckCircle, Layers, FileDown } from 'lucide-react'

export default function Landing() {
  const nav = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 bg-brand-900/40 border border-brand-700/40 rounded-full px-4 py-1.5 text-brand-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          Local-only demo · No data leaves your machine
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
          Audio <span className="text-brand-400">Transcription</span><br />
          & <span className="text-brand-400">Translation</span> Studio
        </h1>
        <p className="text-slate-400 text-lg mb-10 max-w-xl">
          A production-quality annotation workspace for labeling multilingual audio —
          transcription, translation, speaker diarization, and QC review in one place.
        </p>

        <button
          onClick={() => nav('/queue')}
          className="flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-base font-bold transition-colors shadow-lg shadow-brand-900/40"
        >
          Open Task Queue <ArrowRight size={18} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-16 w-full text-left">
          <WorkflowStep icon={<Mic2 size={18} />}     step="1" title="Select Task"
            desc="Pick an audio task from the queue — filtered by language, type, and status." />
          <WorkflowStep icon={<Layers size={18} />}   step="2" title="Annotate"
            desc="Segment audio, transcribe in source language, translate to English, flag issues." />
          <WorkflowStep icon={<CheckCircle size={18}/>} step="3" title="QC Review"
            desc="Reviewer checks diff vs reference, approves or returns with comments." />
          <WorkflowStep icon={<FileDown size={18}/>}  step="4" title="Export"
            desc="Download annotations as JSON or CSV matching the platform output schema." />
        </div>
      </div>

      {/* Languages */}
      <div className="border-t border-slate-800 py-8 text-center">
        <p className="text-xs text-slate-500 mb-4 uppercase tracking-widest">Supported source languages</p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {[
            { flag: '🇨🇳', name: 'Chinese' }, { flag: '🇸🇦', name: 'Arabic' },
            { flag: '🇮🇳', name: 'Hindi' },  { flag: '🇰🇷', name: 'Korean' },
            { flag: '🇫🇷', name: 'French' }, { flag: '🇯🇵', name: 'Japanese' },
          ].map(l => (
            <div key={l.name} className="flex items-center gap-1.5 text-slate-300 text-sm">
              <span className="text-lg">{l.flag}</span> {l.name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-brand-400 text-sm font-medium">
            <Languages size={14} /> → English
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowStep({ icon, step, title, desc }: {
  icon: React.ReactNode; step: string; title: string; desc: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-700/40 flex items-center justify-center text-brand-400">
          {icon}
        </div>
        <div>
          <span className="text-xs text-slate-500">Step {step}</span>
          <div className="text-sm font-semibold text-white">{title}</div>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}
