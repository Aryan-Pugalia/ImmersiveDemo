import { Link, useLocation } from 'react-router-dom'
import { useAnnotationStore } from '../store/annotationStore'
import { LANG_FLAGS } from '../lib/utils'

export default function NavBar() {
  const { role, setRole, manifest, annotation } = useAnnotationStore()
  const loc = useLocation()

  const progress = annotation
    ? annotation.segments.filter(s => s.sourceText.trim()).length + '/' + annotation.segments.length + ' segs'
    : null

  return (
    <nav className="h-12 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-4 shrink-0 z-50">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 shrink-0">
        <span className="text-brand-400 font-bold text-sm tracking-widest uppercase">TP.ai</span>
        <span className="text-slate-400 text-xs hidden sm:block">· Audio Annotation</span>
      </Link>

      <div className="h-5 w-px bg-slate-700" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
        <Link to="/queue" className="hover:text-white transition-colors">Queue</Link>
        {manifest && (
          <>
            <span>/</span>
            <span className="text-slate-200 truncate max-w-[140px]">
              {LANG_FLAGS[manifest.language]} {manifest.title}
            </span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Progress */}
      {progress && (
        <span className="text-xs text-slate-500 hidden md:block">{progress} annotated</span>
      )}

      {/* Role Toggle */}
      <div className="flex rounded-md overflow-hidden border border-slate-600 text-xs">
        <button
          onClick={() => setRole('annotator')}
          className={`px-3 py-1 transition-colors ${
            role === 'annotator'
              ? 'bg-brand-700 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Annotator
        </button>
        <button
          onClick={() => setRole('reviewer')}
          className={`px-3 py-1 transition-colors ${
            role === 'reviewer'
              ? 'bg-green-800 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Reviewer
        </button>
      </div>

      {/* Annotation status pill */}
      {annotation && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          annotation.status === 'approved'    ? 'bg-green-900 text-green-300' :
          annotation.status === 'submitted'   ? 'bg-yellow-900 text-yellow-300' :
          annotation.status === 'returned'    ? 'bg-red-900 text-red-300' :
          annotation.status === 'in_progress' ? 'bg-blue-900 text-blue-300' :
          'bg-slate-700 text-slate-400'
        }`}>
          {annotation.status.replace('_', ' ')}
        </span>
      )}
    </nav>
  )
}
