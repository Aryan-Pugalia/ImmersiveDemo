// ── Time formatting ───────────────────────────────────────────────────────────

export function msToTimecode(ms: number): string {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const cs = Math.floor((ms % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function secToMs(sec: number): number {
  return Math.round(sec * 1000)
}

export function msToSec(ms: number): number {
  return ms / 1000
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export interface DiffToken {
  text:  string
  type:  'equal' | 'insert' | 'delete'
}

/** Very simple word-level diff between two strings. */
export function wordDiff(ref: string, ann: string): DiffToken[] {
  const refWords = ref.split(/\s+/).filter(Boolean)
  const annWords = ann.split(/\s+/).filter(Boolean)

  // LCS-based diff
  const m = refWords.length
  const n = annWords.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = refWords[i - 1] === annWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const tokens: DiffToken[] = []
  let i = m, j = n
  const ops: DiffToken[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refWords[i - 1] === annWords[j - 1]) {
      ops.unshift({ text: refWords[i - 1], type: 'equal' })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ text: annWords[j - 1], type: 'insert' })
      j--
    } else {
      ops.unshift({ text: refWords[i - 1], type: 'delete' })
      i--
    }
  }
  return ops
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function escape(val: string): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// ── RTL detection ─────────────────────────────────────────────────────────────

export function isRTL(lang: string): boolean {
  return lang === 'ar' || lang === 'he' || lang === 'fa'
}

// ── Colour helpers ────────────────────────────────────────────────────────────

export const SPEAKER_COLORS: Record<string, string> = {
  S1:      '#818cf8',  // indigo-400
  S2:      '#34d399',  // emerald-400
  OVERLAP: '#fb923c',  // orange-400
  UNK:     '#94a3b8',  // slate-400
}

export const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900 text-blue-300',
  submitted:   'bg-yellow-900 text-yellow-300',
  returned:    'bg-red-900 text-red-300',
  approved:    'bg-green-900 text-green-300',
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  submitted:   'Submitted',
  returned:    'Returned',
  approved:    'Approved',
}

export const LANG_FLAGS: Record<string, string> = {
  zh: '🇨🇳',
  ar: '🇸🇦',
  hi: '🇮🇳',
  ko: '🇰🇷',
  fr: '🇫🇷',
  ja: '🇯🇵',
}
