// ── Manifest types ──────────────────────────────────────────────────────────

export type LanguageCode = 'es' | 'en' | 'fr' | 'pt'
export type TaskType     = 'transcribe' | 'translate' | 'both'
export type Difficulty   = 'easy' | 'medium'
export type DomainTag    = 'business' | 'conversational' | 'customer_support' | 'travel' | 'healthcare-lite'

export interface RefSegment {
  startMs:  number
  endMs:    number
  speaker:  string
  text?:    string
  textEn?:  string
}

export interface TaskManifest {
  id:            string
  language:      LanguageCode
  languageLabel: string
  title:         string
  audioPath:     string
  durationSec:   number
  taskType:      TaskType
  difficulty:    Difficulty
  domainTag:     DomainTag
  reference?: {
    transcriptSegments:  RefSegment[]
    translationSegments: RefSegment[]
  }
}

// ── Annotation types ─────────────────────────────────────────────────────────

export type Speaker     = 'S1' | 'S2' | 'OVERLAP' | 'UNK'
export type NonSpeech   = 'NONE' | 'NOISE' | 'MUSIC' | 'SILENCE' | 'CROSSTALK'
export type AudioIssue  = 'NONE' | 'CLIPPING' | 'BACKGROUND_NOISE' | 'DROP_OUT' | 'DISTORTION'
export type TaskStatus  = 'not_started' | 'in_progress' | 'submitted' | 'returned' | 'approved'
export type AudioQuality = 'good' | 'ok' | 'bad'
export type PIILevel    = 'none' | 'possible' | 'confirmed'
export type ReviewOutcome = 'pending' | 'approved' | 'needs_rework'

export interface SegmentComment {
  by:   'annotator' | 'reviewer'
  text: string
  at:   string
}

export interface SegmentFlags {
  lowConfidence:   boolean
  needsSecondPass: boolean
  audioIssue:      AudioIssue
}

export interface Segment {
  segmentId:  string
  startMs:    number
  endMs:      number
  speaker:    Speaker
  nonSpeech:  NonSpeech
  sourceText: string
  englishText: string
  flags:      SegmentFlags
  comments:   SegmentComment[]
}

export interface TaskLevelAnnotation {
  overallAudioQuality: AudioQuality
  piiPresent:          PIILevel
  reviewOutcome:       ReviewOutcome
}

export interface TaskAnnotation {
  project:        string
  taskId:         string
  sourceLanguage: LanguageCode
  createdAt:      string
  updatedAt:      string
  status:         TaskStatus
  segments:       Segment[]
  taskLevel:      TaskLevelAnnotation
  reviewNotes:    string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const EMPTY_FLAGS: SegmentFlags = {
  lowConfidence:   false,
  needsSecondPass: false,
  audioIssue:      'NONE',
}

export const EMPTY_TASK_LEVEL: TaskLevelAnnotation = {
  overallAudioQuality: 'good',
  piiPresent:          'none',
  reviewOutcome:       'pending',
}

let _segCounter = 0
export function makeSegmentId(): string {
  _segCounter++
  return `seg_${String(_segCounter).padStart(3, '0')}`
}

export function makeSegment(startMs: number, endMs: number): Segment {
  return {
    segmentId:   makeSegmentId(),
    startMs,
    endMs,
    speaker:     'S1',
    nonSpeech:   'NONE',
    sourceText:  '',
    englishText: '',
    flags:       { ...EMPTY_FLAGS },
    comments:    [],
  }
}

export function seedAnnotationFromRef(manifest: TaskManifest): TaskAnnotation {
  const segs: Segment[] = (manifest.reference?.transcriptSegments ?? []).map((ref, i) => {
    const trans = manifest.reference?.translationSegments[i]
    return {
      segmentId:   `seg_${String(i + 1).padStart(3, '0')}`,
      startMs:     ref.startMs,
      endMs:       ref.endMs,
      speaker:     (ref.speaker as Speaker) || 'S1',
      nonSpeech:   'NONE',
      sourceText:  ref.text || '',
      englishText: trans?.textEn || '',
      flags:       { ...EMPTY_FLAGS },
      comments:    [],
    }
  })

  const now = new Date().toISOString()
  return {
    project:        'audio_transcribe_translate_demo',
    taskId:         manifest.id,
    sourceLanguage: manifest.language,
    createdAt:      now,
    updatedAt:      now,
    status:         'not_started',
    segments:       segs,
    taskLevel:      { ...EMPTY_TASK_LEVEL },
    reviewNotes:    '',
  }
}
