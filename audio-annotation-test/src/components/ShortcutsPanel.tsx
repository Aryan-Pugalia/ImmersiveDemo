import { useState } from 'react'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS = [
  { key: 'Space',   desc: 'Play / Pause' },
  { key: 'A',       desc: 'Add segment at playhead (2s)' },
  { key: 'S',       desc: 'Split selected segment at playhead' },
  { key: 'D',       desc: 'Delete selected segment' },
  { key: 'J',       desc: 'Seek back 2 seconds' },
  { key: 'K',       desc: 'Play / Pause (alt)' },
  { key: 'L',       desc: 'Seek forward 2 seconds' },
  { key: '1',       desc: 'Set speaker → S1' },
  { key: '2',       desc: 'Set speaker → S2' },
  { key: '3',       desc: 'Set speaker → OVERLAP' },
  { key: '4',       desc: 'Set speaker → UNK' },
  { key: 'Escape',  desc: 'Deselect segment' },
  { key: '?',       desc: 'Toggle shortcuts panel' },
]

export default function ShortcutsPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Keyboard shortcuts"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors border border-slate-700"
      >
        <Keyboard size={12} /> Shortcuts
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {SHORTCUTS.map(({ key, desc }) => (
                <div key={key} className="flex items-center gap-3">
                  <kbd className="min-w-[2.5rem] text-center px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs font-mono text-slate-300">
                    {key}
                  </kbd>
                  <span className="text-xs text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
